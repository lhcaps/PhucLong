const express = require('express');
const { authenticateJWT } = require('../middleware/auth.middleware');
const CartService = require('../services/cart.service');

const router = express.Router();

// Lấy giỏ hàng
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const cart = await CartService.getCart(req.user.userId);
    res.json(cart); // { items: [...], total: ... }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Thêm sản phẩm vào giỏ
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { ProductId, Quantity, Size, Sugar, Ice, Topping } = req.body;
    const result = await CartService.addItem(
      req.user.userId,
      ProductId,
      Quantity,
      Size,
      Sugar,
      Ice,
      Topping
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Update số lượng item
router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const { Quantity } = req.body;
    const result = await CartService.updateItem(
      req.user.userId,
      req.params.id,
      Quantity
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Xóa item
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const result = await CartService.removeItem(req.user.userId, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
