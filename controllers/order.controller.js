const OrderService = require('../services/order.service');

class OrderController {
  static async create(req, res) {
    try {
      const userId = req.user.userId;  
      const { TotalAmount, Items } = req.body;

      if (!Items || !Array.isArray(Items) || Items.length === 0) {
        return res.status(400).json({ error: 'Danh sách sản phẩm không hợp lệ' });
      }

      const order = await OrderService.create(
        { UserId: userId, TotalAmount },
        Items
      );

      res.status(201).json(order);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async list(req, res) {
    try {
      const userId = req.user.userId;
      const orders = await OrderService.getByUser(userId);
      res.json(orders);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async getByUser(req, res) {
    try {
      const { userId } = req.params;
      const orders = await OrderService.getByUser(userId);
      res.json(orders);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const order = await OrderService.getById(id);
      if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
      res.json(order);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { Status, PaymentStatus } = req.body;
      const updated = await OrderService.updateStatus(id, Status, PaymentStatus);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = OrderController;
