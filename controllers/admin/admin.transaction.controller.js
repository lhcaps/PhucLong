// controllers/admin/admin.transaction.controller.js
const AdminTransactionService = require("../../services/admin/admin.transaction.service");

class AdminTransactionController {
  // ✅ Danh sách tất cả giao dịch
  static async list(req, res) {
    try {
      const filters = {
        provider: req.query.provider || null,
        status: req.query.status || null,
        userId: req.query.userId || null,
        orderId: req.query.orderId || null,
      };
      const data = await AdminTransactionService.getAll(filters);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ✅ Chi tiết 1 giao dịch
  static async detail(req, res) {
    try {
      const id = Number(req.params.id);
      const result = await AdminTransactionService.getById(id);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ✅ Thống kê tổng quan
  static async stats(req, res) {
    try {
      const result = await AdminTransactionService.getStats();
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
}

module.exports = AdminTransactionController;
