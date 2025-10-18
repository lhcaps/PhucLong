// controllers/voucher.controller.js
const VoucherService = require("../services/voucher.service");

class VoucherController {
  // ✅ Xem thử voucher (chưa xác nhận)
  static async preview(req, res) {
    try {
      const { code, orderId } = req.body;
      if (!code || !orderId)
        return res.status(400).json({ ok: false, error: "Thiếu dữ liệu" });

      const result = await VoucherService.preview(code, orderId);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ✅ Xác nhận voucher (áp dụng thực tế)
  static async confirm(req, res) {
    try {
      const { code, orderId } = req.body;
      if (!code || !orderId)
        return res.status(400).json({ ok: false, error: "Thiếu dữ liệu" });

      const userId = req.user?.userId || null;
      const result = await VoucherService.confirm(code, orderId, userId);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
}

module.exports = VoucherController;
