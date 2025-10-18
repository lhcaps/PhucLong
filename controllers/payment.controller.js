
// controllers/payment.controller.js
const PaymentService = require("../services/payment.service");

class PaymentController {
  static async vnpayCreate(req, res) {
    try {
      const { orderId } = req.body || {};
      if (!orderId) return res.status(400).json({ ok: false, error: "INVALID_INPUT" });
      const clientIp =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.connection.remoteAddress ||
        "127.0.0.1";
      const result = await PaymentService.createVnpayPayment(Number(orderId), clientIp);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  static async vnpayReturn(req, res) {
    try {
      const result = await PaymentService.handleVnpayReturn(req.query || {});
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  static async vnpayIpn(req, res) {
    try {
      const result = await PaymentService.handleVnpayIpn(req.query || {});
      if (!result.ok) return res.status(400).json(result);
      res.json(result.data);
    } catch (err) {
      res.status(500).json({ RspCode: "99", Message: err.message });
    }
  }

  static async devConfirm(req, res) {
    try {
      const { orderId } = req.body || {};
      if (!orderId) return res.status(400).json({ ok: false, error: "INVALID_INPUT" });
      const result = await PaymentService.devConfirm(Number(orderId));
      if (!result.ok) return res.status(403).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
}

module.exports = PaymentController;
