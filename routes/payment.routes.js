// routes/payment.routes.js
const express = require("express");
const crypto = require("crypto");
const qs = require("qs");
const { sql, poolPromise } = require("../config/db");
const { authenticateJWT, authorizeAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

// ====== Config flags (DEV helpers) ======
const DEV_TRUST_RETURN =
  process.env.VNPAY_TRUST_RETURN === "true" || process.env.NODE_ENV !== "production";
const ALLOW_DEV_CONFIRM =
  process.env.ALLOW_DEV_CONFIRM === "true" || process.env.NODE_ENV !== "production";

// ====== Provider constants ======
const PROVIDER = "VNPAY";

// ====== ENV guard ======
function ensureEnv() {
  const miss = [];
  if (!process.env.VNPAY_URL) miss.push("VNPAY_URL");
  if (!process.env.VNPAY_TMN_CODE) miss.push("VNPAY_TMN_CODE");
  if (!process.env.VNPAY_HASH_SECRET) miss.push("VNPAY_HASH_SECRET");
  if (!process.env.VNPAY_RETURN_URL) miss.push("VNPAY_RETURN_URL");
  if (miss.length) {
    const msg = `Thiếu ENV: ${miss.join(", ")}`;
    const err = new Error(msg);
    err.status = 500;
    throw err;
  }
}
function ensureHashOnly() {
  if (!process.env.VNPAY_HASH_SECRET) {
    const err = new Error("Thiếu ENV: VNPAY_HASH_SECRET");
    err.status = 500;
    throw err;
  }
}

// yyyyMMddHHmmss (theo VNPay)
function formatDate(date) {
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

// sort by key asc + encode values
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  }
  return sorted;
}
function vnpHash(params, secret) {
  const sorted = sortObject(params);
  const signData = qs.stringify(sorted, { encode: false });
  return crypto.createHmac("sha512", secret).update(signData, "utf-8").digest("hex");
}
function getClientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "127.0.0.1"
  );
}
function toVndInt(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}
function normStatus(s) {
  return String(s || "").trim().toLowerCase();
}
function pickVnp(obj) {
  const out = {};
  for (const k in obj) if (k.startsWith("vnp_")) out[k] = obj[k];
  return out;
}
// Map VNPay rspCode -> transaction.Status ('success' | 'failed')
function txStatusFromRsp(rspCode) {
  return String(rspCode) === "00" ? "success" : "failed";
}

/* ============================================================
  1) Tạo URL Thanh Toán VNPay (client chỉ gửi orderId)
  ============================================================ */
router.post("/vnpay", authenticateJWT, async (req, res, next) => {
  try {
    ensureEnv();

    const orderId = Number(req.body?.orderId);
    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Thiếu/ sai orderId" } });
    }

    const pool = await poolPromise;

    // Chỉ thanh toán đơn thuộc user hiện tại
    const orderRes = await pool
      .request()
      .input("Id", sql.Int, orderId)
      .input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT TOP 1 Id, UserId, Total, Status, PaymentStatus, PaymentMethod
        FROM Orders WHERE Id=@Id AND UserId=@UserId
      `);

    if (!orderRes.recordset.length) {
      return res.status(404).json({ success: false, error: { code: "ORDER_NOT_FOUND", message: "Không tìm thấy đơn hàng của bạn" } });
    }

    const order = orderRes.recordset[0];
    const status = normStatus(order.Status);
    const payStatus = normStatus(order.PaymentStatus);

    if (status === "cancelled") {
      return res.status(400).json({ success: false, error: { code: "ORDER_CANCELLED", message: "Đơn hàng đã bị hủy" } });
    }
    if (payStatus === "paid") {
      return res.status(400).json({ success: false, error: { code: "ORDER_PAID", message: "Đơn hàng đã thanh toán" } });
    }

    const amountVnd = toVndInt(order.Total);
    if (!amountVnd || amountVnd <= 0) {
      return res.status(400).json({ success: false, error: { code: "AMOUNT_INVALID", message: "Số tiền không hợp lệ" } });
    }

    const vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: process.env.VNPAY_TMN_CODE,
      vnp_Amount: amountVnd * 100, // VNPay dùng đơn vị x100
      vnp_CreateDate: formatDate(new Date()),
      vnp_CurrCode: "VND",
      vnp_IpAddr: getClientIp(req),
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toan don hang #${orderId}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
      vnp_TxnRef: `${orderId}_${Date.now()}`, // unique mỗi lần yêu cầu
    };

    const signed = vnpHash(vnp_Params, process.env.VNPAY_HASH_SECRET);
    const sortedParams = sortObject(vnp_Params);
    const query = qs.stringify(sortedParams, { encode: false });
    const paymentUrl = `${process.env.VNPAY_URL}?${query}&vnp_SecureHash=${signed}`;

    // (Optional) gắn PaymentMethod='VNPAY' để UI hiển thị nhất quán
    try {
      await pool
        .request()
        .input("Id", sql.Int, order.Id)
        .query("UPDATE Orders SET PaymentMethod='VNPAY' WHERE Id=@Id AND PaymentStatus<>'paid'");
    } catch (_) {}

    return res.json({ success: true, data: { paymentUrl, orderId, amount: amountVnd } });
  } catch (err) {
    return next(err);
  }
});

/* ============================================================
  2) VNPay Return (Frontend Redirect)
  - PROD: chỉ verify & trả JSON, KHÔNG ghi DB
  - DEV: (VNPAY_TRUST_RETURN=true hoặc NODE_ENV != 'production') có thể ghi DB idempotent
  ============================================================ */
router.get(/^\/vnpay_return(\?|&)?/, async (req, res) => {
  try {
    ensureHashOnly();

    const vnp_Params = pickVnp(req.query);
    if (!Object.keys(vnp_Params).length) {
      return res.status(400).json({ success: false, error: { code: "MISSING_PARAMS", message: "Thiếu tham số VNPay" } });
    }

    const secureHash = vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    if (!secureHash) {
      return res.status(400).json({ success: false, error: { code: "MISSING_SIGNATURE", message: "Thiếu vnp_SecureHash" } });
    }

    const checkSum = vnpHash(vnp_Params, process.env.VNPAY_HASH_SECRET);

    const [orderIdStr] = String(vnp_Params.vnp_TxnRef || "").split("_");
    const orderId = parseInt(orderIdStr, 10);
    const rspCode = String(vnp_Params.vnp_ResponseCode || "");
    const amountFromVnp = (Number(vnp_Params.vnp_Amount) || 0) / 100;

    const valid = secureHash.toLowerCase() === checkSum.toLowerCase();
    const payload = {
      success: valid && rspCode === "00",
      data: { orderId, amount: amountFromVnp, rspCode },
    };

    if (DEV_TRUST_RETURN && valid && Number.isInteger(orderId)) {
      const pool = await poolPromise;

      // Đối chiếu amount với DB
      const oRs = await pool.request().input("Id", sql.Int, orderId)
        .query("SELECT TOP 1 Id, UserId, Total, PaymentStatus FROM Orders WHERE Id=@Id");
      if (oRs.recordset.length) {
        const order = oRs.recordset[0];
        const isPaid = normStatus(order.PaymentStatus) === "paid";
        const amountVnd = toVndInt(order.Total);
        if (amountVnd === amountFromVnp) {
          const txnRef = String(vnp_Params.vnp_TxnRef || "");
          const txnNo  = String(vnp_Params.vnp_TransactionNo || "");
          const txStatus = txStatusFromRsp(rspCode);

          await pool.request()
            .input("OrderId", sql.Int, orderId)
            .input("UserId", sql.Int, order.UserId)
            .input("Amount", sql.Decimal(18,2), amountVnd)
            .input("Provider", sql.NVarChar(20), PROVIDER)
            .input("PaymentMethod", sql.NVarChar(20), 'VNPAY')
            .input("TxnRef", sql.NVarChar(64), txnRef)
            .input("TransactionNo", sql.NVarChar(64), txnNo || null)
            .input("RspCode", sql.NVarChar(5), rspCode)
            .input("Status", sql.NVarChar(20), txStatus)
            .input("Raw", sql.NVarChar(sql.MAX), JSON.stringify(vnp_Params))
            .query(`
              IF NOT EXISTS (SELECT 1 FROM Transactions WHERE Provider=@Provider AND TxnRef=@TxnRef)
              INSERT INTO Transactions (OrderId, UserId, Amount, Provider, PaymentMethod, TxnRef, TransactionNo, RspCode, Status, RawReturn, CreatedAt)
              VALUES (@OrderId, @UserId, @Amount, @Provider, @PaymentMethod, @TxnRef, @TransactionNo, @RspCode, @Status, @Raw, SYSUTCDATETIME())
              ELSE
              UPDATE Transactions
              SET TransactionNo = COALESCE(@TransactionNo, TransactionNo),
                  RspCode       = @RspCode,
                  Status        = @Status,
                  RawReturn     = @Raw,
                  PaymentMethod = @PaymentMethod
              WHERE Provider=@Provider AND TxnRef=@TxnRef;
            `);

          if (!isPaid) {
            if (rspCode === "00") {
              await pool.request().input("Id", sql.Int, orderId).query(
                "UPDATE Orders SET PaymentStatus='paid', Status='confirmed', PaymentMethod='VNPAY' WHERE Id=@Id"
              );
            } else {
              await pool.request().input("Id", sql.Int, orderId).query(
                "UPDATE Orders SET PaymentStatus='failed', Status='cancelled', PaymentMethod='VNPAY' WHERE Id=@Id"
              );
            }
          }
        }
      }
    }

    return res.json(payload);
  } catch (err) {
    console.error("VNPay return error:", err);
    if (process.env.NODE_ENV !== "production") {
      return res.status(500).json({ success: false, error: { code: "INTERNAL", message: err.message } });
    }
    return res.status(500).json({ success: false, error: { code: "INTERNAL", message: "Lỗi callback VNPay!" } });
  }
});

/* ============================================================
  3) VNPay IPN (Server xác nhận) — NGUỒN CHÂN LÝ
  ============================================================ */
router.get("/vnpay_ipn", async (req, res) => {
  try {
    ensureHashOnly();

    const inputData = pickVnp(req.query);

    const vnp_SecureHash = inputData.vnp_SecureHash;
    delete inputData.vnp_SecureHash;
    delete inputData.vnp_SecureHashType;

    const checkSum = vnpHash(inputData, process.env.VNPAY_HASH_SECRET);

    if (!vnp_SecureHash || vnp_SecureHash !== checkSum) {
      return res.json({ RspCode: "97", Message: "Invalid signature" });
    }

    const [orderIdStr] = String(inputData.vnp_TxnRef || "").split("_");
    const orderId = parseInt(orderIdStr, 10);
    if (!Number.isInteger(orderId)) {
      return res.json({ RspCode: "01", Message: "Order not found" });
    }

    const amountFromVnp = (Number(inputData.vnp_Amount) || 0) / 100;
    const rspCode = String(inputData.vnp_ResponseCode || "");
    const txnRef = String(inputData.vnp_TxnRef || "");
    const txnNo  = String(inputData.vnp_TransactionNo || "");

    const pool = await poolPromise;

    // Transaction để idempotent an toàn
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const reqTx = new sql.Request(tx);

      // Lấy đơn & kiểm tiền
      const oRs = await reqTx.input("Id", sql.Int, orderId)
        .query("SELECT TOP 1 Id, UserId, Total, PaymentStatus FROM Orders WHERE Id=@Id");
      if (!oRs.recordset.length) {
        await tx.rollback();
        return res.json({ RspCode: "01", Message: "Order not found" });
      }

      const order = oRs.recordset[0];
      const isPaid = normStatus(order.PaymentStatus) === "paid";
      const amountVnd = toVndInt(order.Total);
      if (amountVnd !== amountFromVnp) {
        await tx.rollback();
        return res.json({ RspCode: "04", Message: "Invalid amount" });
      }

      const txStatus = txStatusFromRsp(rspCode);

      // Ghi giao dịch (idempotent theo Provider+TxnRef)
      await reqTx
        .input("OrderId", sql.Int, orderId)
        .input("UserId", sql.Int, order.UserId)
        .input("Amount", sql.Decimal(18,2), amountVnd)
        .input("Provider", sql.NVarChar(20), PROVIDER)
        .input("PaymentMethod", sql.NVarChar(20), 'VNPAY')
        .input("TxnRef", sql.NVarChar(64), txnRef)
        .input("TransactionNo", sql.NVarChar(64), txnNo || null)
        .input("RspCode", sql.NVarChar(5), rspCode)
        .input("Status", sql.NVarChar(20), txStatus)
        .input("Raw", sql.NVarChar(sql.MAX), JSON.stringify(inputData))
        .query(`
          IF NOT EXISTS (SELECT 1 FROM Transactions WHERE Provider=@Provider AND TxnRef=@TxnRef)
          INSERT INTO Transactions (OrderId, UserId, Amount, Provider, PaymentMethod, TxnRef, TransactionNo, RspCode, Status, RawIpn, CreatedAt)
          VALUES (@OrderId, @UserId, @Amount, @Provider, @PaymentMethod, @TxnRef, @TransactionNo, @RspCode, @Status, @Raw, SYSUTCDATETIME())
          ELSE
          UPDATE Transactions
          SET TransactionNo = COALESCE(@TransactionNo, TransactionNo),
              RspCode       = @RspCode,
              Status        = @Status,
              RawIpn        = @Raw,
              PaymentMethod = @PaymentMethod
          WHERE Provider=@Provider AND TxnRef=@TxnRef;
        `);

      if (!isPaid) {
        if (rspCode === "00") {
          await reqTx.input("Id", sql.Int, orderId).query(
            "UPDATE Orders SET PaymentStatus='paid', Status='confirmed', PaymentMethod='VNPAY' WHERE Id=@Id"
          );
          await tx.commit();
          return res.json({ RspCode: "00", Message: "Confirm Success" });
        } else {
          await reqTx.input("Id", sql.Int, orderId).query(
            "UPDATE Orders SET PaymentStatus='failed', Status='cancelled', PaymentMethod='VNPAY' WHERE Id=@Id"
          );
          await tx.commit();
          return res.json({ RspCode: "04", Message: "Payment Failed" });
        }
      } else {
        await tx.commit();
        return res.json({ RspCode: "02", Message: "Order already confirmed" });
      }
    } catch (e) {
      try { await tx.rollback(); } catch {}
      console.error("VNPay IPN TX error:", e);
      return res.json({ RspCode: "99", Message: "Unknown error" });
    }
  } catch (err) {
    console.error("VNPay IPN error:", err);
    return res.json({ RspCode: "99", Message: "Unknown error" });
  }
});

/* ============================================================
  4) Tiện ích
  ============================================================ */

// Lịch sử giao dịch của user hiện tại
router.get("/transactions", authenticateJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT t.Id, t.OrderId, t.Amount, t.Provider, t.PaymentMethod, t.TxnRef, t.TransactionNo, t.RspCode, t.Status, t.CreatedAt
        FROM Transactions t
        WHERE t.UserId=@UserId
        ORDER BY t.CreatedAt DESC
      `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: "INTERNAL", message: err.message } });
  }
});

// Toàn bộ giao dịch (Admin)
router.get("/admin/transactions", authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT t.*, u.Name AS UserName
      FROM Transactions t
      LEFT JOIN Users u ON t.UserId = u.Id
      ORDER BY t.CreatedAt DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: "INTERNAL", message: err.message } });
  }
});

// Xem chi tiết giao dịch/đơn của chính user
router.get("/order/:id", authenticateJWT, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await poolPromise;

    const orderRes = await pool
      .request()
      .input("Id", sql.Int, id)
      .input("UserId", sql.Int, req.user.userId)
      .query(`
        SELECT TOP 1 Id, Status, PaymentStatus, Total, PaymentMethod, CreatedAt
        FROM Orders
        WHERE Id=@Id AND UserId=@UserId
      `);

    if (!orderRes.recordset.length) {
      return res.status(404).json({ success: false, error: { code: "ORDER_NOT_FOUND", message: "Không tìm thấy đơn hàng của bạn" } });
    }

    const order = orderRes.recordset[0];

    const txRes = await pool
      .request()
      .input("OrderId", sql.Int, id)
      .query(`
        SELECT TOP 1 Id, Amount, Provider, PaymentMethod, TxnRef, TransactionNo, RspCode, Status, CreatedAt
        FROM Transactions
        WHERE OrderId=@OrderId
        ORDER BY CreatedAt DESC
      `);

    order.Transaction = txRes.recordset[0] || null;
    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: "INTERNAL", message: err.message } });
  }
});

/* ============================================================
  5) (DEV) Xác nhận thủ công khi không có IPN
  ============================================================ */
router.post("/vnpay/dev/confirm", authenticateJWT, async (req, res) => {
  try {
    if (!ALLOW_DEV_CONFIRM) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not allowed in production" } });
    }

    const orderId = Number(req.body?.orderId);
    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Thiếu/ sai orderId" } });
    }

    const pool = await poolPromise;

    // Chỉ xác nhận đơn thuộc user hiện tại
    const orderRes = await pool
      .request()
      .input("Id", sql.Int, orderId)
      .input("UserId", sql.Int, req.user.userId)
      .query("SELECT TOP 1 Id, PaymentStatus, UserId, Total FROM Orders WHERE Id=@Id AND UserId=@UserId");

    if (!orderRes.recordset.length) {
      return res.status(404).json({ success: false, error: { code: "ORDER_NOT_FOUND", message: "Order not found or not owned by you" } });
    }

    const order = orderRes.recordset[0];
    const isPaid = normStatus(order.PaymentStatus) === "paid";
    const amountVnd = toVndInt(order.Total);

    if (!isPaid) {
      const txnRef = `${orderId}_${Date.now()}_DEV`;

      await pool
        .request()
        .input("OrderId", sql.Int, orderId)
        .input("UserId", sql.Int, order.UserId)
        .input("Amount", sql.Decimal(18,2), amountVnd)
        .input("Provider", sql.NVarChar(20), PROVIDER)
        .input("PaymentMethod", sql.NVarChar(20), 'VNPAY')
        .input("TxnRef", sql.NVarChar(64), txnRef)
        .input("TransactionNo", sql.NVarChar(64), null)
        .input("RspCode", sql.NVarChar(5), "00")
        .input("Status", sql.NVarChar(20), "success")
        .query(`
          IF NOT EXISTS (SELECT 1 FROM Transactions WHERE Provider=@Provider AND TxnRef=@TxnRef)
          INSERT INTO Transactions (OrderId, UserId, Amount, Provider, PaymentMethod, TxnRef, TransactionNo, RspCode, Status, CreatedAt)
          VALUES (@OrderId, @UserId, @Amount, @Provider, @PaymentMethod, @TxnRef, @TransactionNo, @RspCode, @Status, SYSUTCDATETIME())
        `);

      await pool
        .request()
        .input("Id", sql.Int, orderId)
        .query("UPDATE Orders SET PaymentStatus='paid', Status='confirmed', PaymentMethod='VNPAY' WHERE Id=@Id");
    }

    return res.json({ success: true, data: { status: "success", orderId, amount: amountVnd, rspCode: "00", dev: true } });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: "INTERNAL", message: err.message } });
  }
});

module.exports = router;
