// controllers/orderHistory.controller.js
const OrderHistoryService = require("../services/orderHistory.service");

class OrderHistoryController {
  // ✅ Lấy danh sách đơn hàng user
  static async listMyOrders(req, res) {
    try {
      const data = await OrderHistoryService.getByUser(req.user.userId);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ✅ Chi tiết đơn hàng user
  static async detail(req, res) {
    try {
      const orderId = Number(req.params.id);
      const result = await OrderHistoryService.getDetail(orderId, req.user.userId);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ✅ (Admin) Xem toàn bộ đơn hàng
  static async adminList(req, res) {
    try {
      const data = await OrderHistoryService.getAll();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
}

module.exports = OrderHistoryController;
