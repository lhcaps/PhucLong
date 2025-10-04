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

/* ============================================================
   Helper Functions
   ============================================================ */

// yyyyMMddHHmmss
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

// HMAC SHA512 theo chuẩn VNPay
function vnpHash(params, secret) {
  const sorted = sortObject(params);
  const signData = qs.stringify(sorted, { encode: false });
  return crypto.createHmac("sha512", secret).update(signData, "utf-8").digest("hex");
}

// Lấy IP client (đủ dùng)
function getClientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "127.0.0.1"
  );
}

/* ============================================================
   2️⃣ API: Tạo URL Thanh Toán VNPay
   ============================================================ */
router.post("/vnpay", authenticateJWT, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Thiếu orderId" });

    const pool = await poolPromise;

    // Chỉ cho phép thanh toán đơn thuộc user hiện tại
    const orderRes = await pool
      .request()
      .input("Id", sql.Int, orderId)
      .input("UserId", sql.Int, req.user.userId)
      .query(
        "SELECT Id, Total, Status, PaymentStatus, PaymentMethod FROM Orders WHERE Id=@Id AND UserId=@UserId"
      );

    if (!orderRes.recordset.length)
      return res.status(404).json({ error: "Không tìm thấy đơn hàng của bạn" });

    const order = orderRes.recordset[0];

    if (order.Status === "cancelled")
      return res.status(400).json({ error: "Đơn hàng đã bị hủy" });
    if (order.PaymentStatus === "paid")
      return res.status(400).json({ error: "Đơn hàng đã thanh toán" });

    const amount = Number(order.Total);
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Số tiền thanh toán không hợp lệ" });

    const vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: process.env.VNPAY_TMN_CODE,
      vnp_Amount: amount * 100,
      vnp_CreateDate: formatDate(new Date()),
      vnp_CurrCode: "VND",
      vnp_IpAddr: getClientIp(req),
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toan don hang #${orderId}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
      vnp_TxnRef: `${orderId}_${Date.now()}`, // unique mỗi lần thanh toán
    };

    const signed = vnpHash(vnp_Params, process.env.VNPAY_HASH_SECRET);
    const sortedParams = sortObject(vnp_Params);
    const query = qs.stringify(sortedParams, { encode: false });
    const paymentUrl = `${process.env.VNPAY_URL}?${query}&vnp_SecureHash=${signed}`;

    // (Tuỳ chọn) set PaymentMethod = 'VNPay' ngay khi tạo link để nhất quán hiển thị
    try {
      await pool
        .request()
        .input("Id", sql.Int, orderId)
        .query("UPDATE Orders SET PaymentMethod='VNPay' WHERE Id=@Id AND PaymentStatus<>'paid'");
    } catch (_) {
      // bỏ qua nếu thất bại, IPN sẽ set lại
    }

    return res.json({ paymentUrl, orderId, amount });
  } catch (err) {
    console.error("VNPay create error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   3️⃣ VNPay Return (Frontend Redirect)
   - Prod: chỉ trả JSON, KHÔNG ghi DB
   - Dev (VNPAY_TRUST_RETURN=true hoặc NODE_ENV != 'production'): ghi DB idempotent
   ============================================================ */
router.get(/^\/vnpay_return(\?|&)?/, async (req, res) => {
  try {
    const fullUrl = req.originalUrl || "";
    const marker = "/vnpay_return";
    let q = fullUrl.slice(fullUrl.indexOf(marker) + marker.length);
    if (q.startsWith("?") || q.startsWith("&")) q = q.slice(1);

    const vnp_Params = qs.parse(q);
    if (!Object.keys(vnp_Params).length)
      return res.status(400).json({ error: "Thiếu tham số VNPay" });

    const secureHash = vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    const checkSum = vnpHash(vnp_Params, process.env.VNPAY_HASH_SECRET);

    const [orderIdStr] = (vnp_Params.vnp_TxnRef || "").split("_");
    const orderId = parseInt(orderIdStr, 10);
    const rspCode = vnp_Params.vnp_ResponseCode || "";
    const amount = (Number(vnp_Params.vnp_Amount) || 0) / 100;

    const valid = !!secureHash && secureHash.toLowerCase() === checkSum.toLowerCase();
    const payload = {
      status: rspCode === "00" && valid ? "success" : "failed",
      orderId,
      amount,
      rspCode,
    };

    if (DEV_TRUST_RETURN && valid && Number.isInteger(orderId)) {
      try {
        const pool = await poolPromise;
        const orderRes = await pool
          .request()
          .input("Id", sql.Int, orderId)
          .query("SELECT Id, PaymentStatus, UserId, Total FROM Orders WHERE Id=@Id");

        if (orderRes.recordset.length) {
          const order = orderRes.recordset[0];

          if (order.PaymentStatus !== "paid") {
            // ghi log giao dịch nếu chưa có
            await pool
              .request()
              .input("OrderId", sql.Int, orderId)
              .input("UserId", sql.Int, order.UserId)
              .input("Amount", sql.Decimal(10, 2), order.Total)
              .input("PaymentMethod", sql.NVarChar, "VNPay")
              .input("RspCode", sql.NVarChar, rspCode)
              .input("CreatedAt", sql.DateTime, new Date())
              .query(`
                IF NOT EXISTS (SELECT 1 FROM Transactions WHERE OrderId=@OrderId)
                INSERT INTO Transactions (OrderId, UserId, Amount, PaymentMethod, RspCode, CreatedAt)
                VALUES (@OrderId, @UserId, @Amount, @PaymentMethod, @RspCode, @CreatedAt)
              `);

            if (rspCode === "00") {
              await pool
                .request()
                .input("Id", sql.Int, orderId)
                .query(
                  "UPDATE Orders SET PaymentStatus='paid', Status='confirmed', PaymentMethod='VNPay' WHERE Id=@Id"
                );
            } else {
              await pool
                .request()
                .input("Id", sql.Int, orderId)
                .query(
                  "UPDATE Orders SET PaymentStatus='failed', Status='cancelled', PaymentMethod='VNPay' WHERE Id=@Id"
                );
            }
          }
        }
      } catch (e) {
        console.error("VNPay return dev-write error:", e.message);
      }
    }

    return res.json(payload);
  } catch (err) {
    console.error("VNPay return error:", err);
    res.status(500).json({ error: "Lỗi callback VNPay!" });
  }
});

/* ============================================================
   4️⃣ VNPay IPN (Server xác nhận giao dịch) - Nguồn chân lý
   ============================================================ */
router.get("/vnpay_ipn", async (req, res) => {
  try {
    const inputData = {};
    for (const key in req.query) {
      if (key.startsWith("vnp_")) inputData[key] = req.query[key];
    }

    const vnp_SecureHash = inputData.vnp_SecureHash;
    delete inputData.vnp_SecureHash;
    delete inputData.vnp_SecureHashType;

    const checkSum = vnpHash(inputData, process.env.VNPAY_HASH_SECRET);

    const [orderIdStr] = (inputData.vnp_TxnRef || "").split("_");
    const orderId = parseInt(orderIdStr, 10);
    const rspCode = inputData.vnp_ResponseCode;

    if (vnp_SecureHash !== checkSum)
      return res.json({ RspCode: "97", Message: "Invalid signature" });

    const pool = await poolPromise;
    const orderRes = await pool
      .request()
      .input("Id", sql.Int, orderId)
      .query("SELECT Id, PaymentStatus, UserId, Total FROM Orders WHERE Id=@Id");

    if (!orderRes.recordset.length)
      return res.json({ RspCode: "01", Message: "Order not found" });

    const order = orderRes.recordset[0];

    // Idempotent: nếu đã paid thì trả về ok, tránh ghi trùng
    if (order.PaymentStatus === "paid")
      return res.json({ RspCode: "02", Message: "Order already confirmed" });

    // Ghi log giao dịch nếu chưa có
    await pool
      .request()
      .input("OrderId", sql.Int, orderId)
      .input("UserId", sql.Int, order.UserId)
      .input("Amount", sql.Decimal(10, 2), order.Total)
      .input("PaymentMethod", sql.NVarChar, "VNPay")
      .input("RspCode", sql.NVarChar, rspCode)
      .input("CreatedAt", sql.DateTime, new Date())
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Transactions WHERE OrderId=@OrderId)
        INSERT INTO Transactions (OrderId, UserId, Amount, PaymentMethod, RspCode, CreatedAt)
        VALUES (@OrderId, @UserId, @Amount, @PaymentMethod, @RspCode, @CreatedAt)
      `);

    if (rspCode === "00") {
      await pool
        .request()
        .input("Id", sql.Int, orderId)
        .query(
          "UPDATE Orders SET PaymentStatus='paid', Status='confirmed', PaymentMethod='VNPay' WHERE Id=@Id"
        );
      return res.json({ RspCode: "00", Message: "Confirm Success" });
    } else {
      await pool
        .request()
        .input("Id", sql.Int, orderId)
        .query(
          "UPDATE Orders SET PaymentStatus='failed', Status='cancelled', PaymentMethod='VNPay' WHERE Id=@Id"
        );
      return res.json({ RspCode: "04", Message: "Payment Failed" });
    }
  } catch (err) {
    console.error("VNPay IPN error:", err);
    res.json({ RspCode: "99", Message: "Unknown error" });
  }
});

/* ============================================================
   5️⃣ API Tiện ích cho FE & Admin
   ============================================================ */

// Lịch sử giao dịch của user hiện tại
router.get("/transactions", authenticateJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("UserId", sql.Int, req.user.userId)
      .query(
        "SELECT * FROM Transactions WHERE UserId=@UserId ORDER BY CreatedAt DESC"
      );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toàn bộ giao dịch (Admin)
router.get(
  "/admin/transactions",
  authenticateJWT,
  authorizeAdmin,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
        SELECT t.*, u.Name AS UserName
        FROM Transactions t
        LEFT JOIN Users u ON t.UserId = u.Id
        ORDER BY t.CreatedAt DESC
      `);
      res.json(result.recordset);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Xem chi tiết giao dịch/đơn của chính user
router.get("/order/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    // Bảo vệ: chỉ lấy đơn thuộc user hiện tại
    const orderRes = await pool
      .request()
      .input("Id", sql.Int, id)
      .input("UserId", sql.Int, req.user.userId)
      .query(
        "SELECT Id, Status, PaymentStatus, Total, PaymentMethod, CreatedAt FROM Orders WHERE Id=@Id AND UserId=@UserId"
      );

    if (!orderRes.recordset.length)
      return res.status(404).json({ error: "Không tìm thấy đơn hàng của bạn" });

    const order = orderRes.recordset[0];

    const txRes = await pool
      .request()
      .input("OrderId", sql.Int, id)
      .query(
        "SELECT TOP 1 * FROM Transactions WHERE OrderId=@OrderId ORDER BY CreatedAt DESC"
      );

    order.Transaction = txRes.recordset[0] || null;
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   6️⃣ (DEV tiện lợi) Xác nhận thủ công khi không có IPN
   ============================================================ */
router.post("/vnpay/dev/confirm", authenticateJWT, async (req, res) => {
  try {
    if (!ALLOW_DEV_CONFIRM)
      return res.status(403).json({ error: "Not allowed in production" });

    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Thiếu orderId" });

    const pool = await poolPromise;

    // Chỉ xác nhận đơn thuộc user hiện tại (dev route dành cho user)
    const orderRes = await pool
      .request()
      .input("Id", sql.Int, orderId)
      .input("UserId", sql.Int, req.user.userId)
      .query(
        "SELECT Id, PaymentStatus, UserId, Total FROM Orders WHERE Id=@Id AND UserId=@UserId"
      );

    if (!orderRes.recordset.length)
      return res.status(404).json({ error: "Order not found or not owned by you" });

    const order = orderRes.recordset[0];

    if (order.PaymentStatus !== "paid") {
      await pool
        .request()
        .input("OrderId", sql.Int, orderId)
        .input("UserId", sql.Int, order.UserId)
        .input("Amount", sql.Decimal(10, 2), order.Total)
        .input("PaymentMethod", sql.NVarChar, "VNPay")
        .input("RspCode", sql.NVarChar, "00")
        .input("CreatedAt", sql.DateTime, new Date())
        .query(`
          IF NOT EXISTS (SELECT 1 FROM Transactions WHERE OrderId=@OrderId)
          INSERT INTO Transactions (OrderId, UserId, Amount, PaymentMethod, RspCode, CreatedAt)
          VALUES (@OrderId, @UserId, @Amount, @PaymentMethod, @RspCode, @CreatedAt)
        `);

      await pool
        .request()
        .input("Id", sql.Int, orderId)
        .query(
          "UPDATE Orders SET PaymentStatus='paid', Status='confirmed', PaymentMethod='VNPay' WHERE Id=@Id"
        );
    }

    res.json({
      status: "success",
      orderId,
      amount: Number(order.Total),
      rspCode: "00",
      dev: true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
