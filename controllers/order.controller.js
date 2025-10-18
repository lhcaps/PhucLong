const OrderService = require("../services/order.service");

class OrderController {
  static async create(req, res) {
    try {
      const userId = req.user.userId;
      const data = req.body;

      const result = await OrderService.create(userId, data);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async list(req, res) {
    try {
      const userId = req.user.userId;
      const result = await OrderService.listByUser(userId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = OrderController;
