const express = require('express');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth.middleware');
const AdminService = require('../services/admin.service');

const router = express.Router();

// Lấy tất cả đơn hàng
router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const orders = await AdminService.getAllOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật trạng thái đơn hàng
router.put('/:id/status', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { status } = req.body; // pending | confirmed | processing | completed | cancelled
    const result = await AdminService.updateOrderStatus(req.params.id, status);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
