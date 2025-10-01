const express = require('express');
const OrderController = require('../controllers/order.controller');

const router = express.Router();

router.post('/', OrderController.create);               // Tạo đơn hàng mới
router.get('/user/:userId', OrderController.getByUser); // Admin lấy theo user
router.get('/:id', OrderController.getById);            // Lấy chi tiết đơn hàng
router.put('/:id/status', OrderController.updateStatus); // Admin cập nhật trạng thái

module.exports = router;
