// controllers/cart.controller.js
const CartService = require("../services/cart.service");

class CartController {
  static async get(req, res) {
    try {
      const result = await CartService.getCart(req.user.userId);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  static async add(req, res) {
    try {
      const result = await CartService.addItem(req.user.userId, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }

  static async update(req, res) {
    try {
      const result = await CartService.updateItem(
        req.user.userId,
        req.params.id,
        req.body.quantity
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }

  static async remove(req, res) {
    try {
      const result = await CartService.removeItem(req.user.userId, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
}

module.exports = CartController;
