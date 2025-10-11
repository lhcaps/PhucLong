const AdminOrderService = require("../../services/admin/admin.order.service");

class AdminOrderController {
  static async getAll(req, res) {
    try {
      const orders = await AdminOrderService.getAll();
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const order = await AdminOrderService.getById(req.params.id);
      res.json(order);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const result = await AdminOrderService.updateStatus(req.params.id, status);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async delete(req, res) {
    try {
      const result = await AdminOrderService.delete(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = AdminOrderController;
