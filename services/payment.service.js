// services/payment.service.js
const crypto = require("crypto");
const qs = require("qs");
const { sql, getPool } = require("../config/db");

// ========================
// ⚙️ ENV Settings
// ========================
const DEV_TRUST_RETURN =
  process.env.VNPAY_TRUST_RETURN === "true" || process.env.NODE_ENV !== "production";
const ALLOW_DEV_CONFIRM =
  process.env.ALLOW_DEV_CONFIRM === "true" || process.env.NODE_ENV !== "production";

// ========================
// ⚙️ Helper Functions
// ========================
function toVndInt(x) {
  const n = Number(x);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) sorted[k] = obj[k];
  return sorted;
}
function signVnp(params) {
  const secret = process.env.VNPAY_HASH_SECRET || "";
  const signData = qs.stringify(sortObject(params), { encode: false });
  return crypto.createHmac("sha512", secret).update(signData).digest("hex");
}

// ========================
// 💳 PaymentService Class
// ========================
class PaymentService {
  // 1) Tạo URL thanh toán VNPay
  static async createVnpayPayment(orderId, clientIp) {
    const pool = await getPool();

    // Lấy đơn hàng + tính Total từ Subtotal + ShippingFee
    const orderRs = await pool
      .request()
      .input("Id", sql.Int, orderId)
      .query(`
        SELECT TOP 1
          Id,
          UserId,
          (ISNULL(Subtotal, 0) + ISNULL(ShippingFee, 0)) AS Total,
          PaymentStatus
        FROM Orders
        WHERE Id = @Id
      `);

    if (!orderRs.recordset.length) {
      return { ok: false, error: { code: "ORDER_NOT_FOUND" } };
    }

    const order = orderRs.recordset[0];
    const payStatus = (order.PaymentStatus || "").toLowerCase();
    if (payStatus === "paid") {
      return { ok: false, error: { code: "ORDER_PAID" } };
    }

    const amountVnd = toVndInt(order.Total);
    if (!amountVnd || amountVnd <= 0) {
      return { ok: false, error: { code: "AMOUNT_INVALID" } };
    }

    // Build tham số VNPay
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const vnpUrl = process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const returnUrl = process.env.VNPAY_RETURN_URL || "http://localhost:5173/payment/return";
    const ipnUrl = process.env.VNPAY_IPN_URL || "http://localhost:3000/api/payment/vnpay_ipn";

    const date = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const createDate =
      date.getFullYear().toString() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds());

    const vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Amount: amountVnd * 100, // đơn vị x100
      vnp_CreateDate: createDate,
      vnp_CurrCode: "VND",
      vnp_IpAddr: clientIp || "127.0.0.1",
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toán đơn hàng #${order.Id}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: String(order.Id),
    };
    if (ipnUrl) vnp_Params.vnp_IpnUrl = ipnUrl;

    // Ký
    vnp_Params.vnp_SecureHash = signVnp(vnp_Params);
    const url = vnpUrl + "?" + qs.stringify(vnp_Params, { encode: true });

    return { ok: true, data: { paymentUrl: url, orderId: order.Id } };
  }

  // 2) Xử lý VNPay Return (redirect về FE)
  static async handleVnpayReturn(query) {
    const pool = await getPool();
    const inputData = { ...query };
    const secureHash = inputData.vnp_SecureHash;
    delete inputData.vnp_SecureHash;
    delete inputData.vnp_SecureHashType;

    const signed = signVnp(inputData);
    const trusted = DEV_TRUST_RETURN || signed === secureHash;

    const rspCode = inputData.vnp_ResponseCode || "";
    const orderId = Number(inputData.vnp_TxnRef);
    const amountVnd = toVndInt(Number(inputData.vnp_Amount) / 100);

    if (!trusted) return { ok: false, error: { code: "INVALID_SIGNATURE" } };
    if (rspCode !== "00") return { ok: false, error: { code: "PAY_FAILED", rspCode } };

    // Update order
    await pool
      .request()
      .input("Id", sql.Int, orderId)
      .query(`
        UPDATE Orders 
        SET PaymentStatus = 'paid', Status = 'confirmed', PaymentMethod = 'VNPAY'
        WHERE Id = @Id
      `);

    // Insert transaction log
    await pool
      .request()
      .input("OrderId", sql.Int, orderId)
      .input("Provider", sql.NVarChar(32), "VNPAY")
      .input("TxnRef", sql.NVarChar(64), String(inputData.vnp_TransactionNo || ""))
      .input("Amount", sql.Int, amountVnd)
      .input("Currency", sql.NVarChar(8), "VND")
      .query(`
        INSERT INTO Transactions (OrderId, Provider, TxnRef, Amount, Currency, Status, CreatedAt)
        VALUES (@OrderId, @Provider, @TxnRef, @Amount, @Currency, 'success', SYSUTCDATETIME())
      `);

    return { ok: true, data: { status: "success", orderId, amount: amountVnd, rspCode } };
  }

  // 3) Xử lý VNPay IPN (server -> server)
  static async handleVnpayIpn(query) {
    const pool = await getPool();
    const inputData = { ...query };
    const secureHash = inputData.vnp_SecureHash;
    delete inputData.vnp_SecureHash;
    delete inputData.vnp_SecureHashType;

    const signed = signVnp(inputData);
    if (signed !== secureHash) {
      return { ok: false, error: { code: "INVALID_SIGNATURE" } };
    }

    const rspCode = inputData.vnp_ResponseCode || "";
    const orderId = Number(inputData.vnp_TxnRef);
    const amountVnd = toVndInt(Number(inputData.vnp_Amount) / 100);

    if (rspCode !== "00") {
      return { ok: false, error: { code: "PAY_FAILED", rspCode } };
    }

    // Idempotent: chỉ update nếu chưa 'paid'
    const oRs = await pool
      .request()
      .input("Id", sql.Int, orderId)
      .query("SELECT TOP 1 Id, PaymentStatus FROM Orders WHERE Id=@Id");

    if (!oRs.recordset.length) {
      return { ok: false, error: { code: "ORDER_NOT_FOUND" } };
    }

    const order = oRs.recordset[0];
    if ((order.PaymentStatus || "").toLowerCase() !== "paid") {
      await pool
        .request()
        .input("Id", sql.Int, orderId)
        .query(`
          UPDATE Orders 
          SET PaymentStatus='paid', Status='confirmed', PaymentMethod='VNPAY'
          WHERE Id=@Id
        `);

      await pool
        .request()
        .input("OrderId", sql.Int, orderId)
        .input("Provider", sql.NVarChar(32), "VNPAY")
        .input("TxnRef", sql.NVarChar(64), String(inputData.vnp_TransactionNo || ""))
        .input("Amount", sql.Int, amountVnd)
        .input("Currency", sql.NVarChar(8), "VND")
        .query(`
          INSERT INTO Transactions (OrderId, Provider, TxnRef, Amount, Currency, Status, CreatedAt)
          VALUES (@OrderId, @Provider, @TxnRef, @Amount, @Currency, 'success', SYSUTCDATETIME())
        `);
    }

    return { ok: true, data: { RspCode: "00", Message: "Success" } };
  }

  // 4) Dev Helper — ép xác nhận đơn
  static async devConfirm(orderId) {
    if (!ALLOW_DEV_CONFIRM) {
      return { ok: false, error: { code: "FORBIDDEN" } };
    }
    const pool = await getPool();
    await pool
      .request()
      .input("Id", sql.Int, orderId)
      .query(`
        UPDATE Orders 
        SET PaymentStatus='paid', Status='confirmed', PaymentMethod='VNPAY'
        WHERE Id=@Id
      `);
    return { ok: true, data: { status: "success", orderId, dev: true } };
  }
}

module.exports = PaymentService;
