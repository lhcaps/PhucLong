const express = require("express");
const {
  authenticateJWT,
  authorizeAdmin,
} = require("../middleware/auth.middleware");
const OrderService = require("../services/order.service");

const router = express.Router();

// Tạo đơn hàng từ giỏ
// routes/order.routes.js (đoạn POST "/")
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { paymentMethod, fulfillment, address, lat, lng, storeId } = req.body;
    const result = await OrderService.createOrder(
      req.user.userId,
      paymentMethod || "COD",
      { fulfillment, address, lat, lng, storeId }
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// Xem tất cả đơn hàng của user (kèm items)
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const result = await OrderService.getOrdersByUser(req.user.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Lấy chi tiết đơn theo ID
router.get("/:id", authenticateJWT, async (req, res) => {
  try {
    const result = await OrderService.getOrderById(
      req.user.userId,
      req.params.id
    );
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ✅ Cancel order (user)
router.put("/:id/cancel", authenticateJWT, async (req, res) => {
  try {
    const result = await OrderService.cancelOrder(
      req.user.userId,
      req.params.id
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin xem tất cả đơn
router.get(
  "/admin/orders",
  authenticateJWT,
  authorizeAdmin,
  async (req, res) => {
    try {
      const result = await OrderService.getAllOrders();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Admin update trạng thái đơn
router.put(
  "/admin/orders/:id/status",
  authenticateJWT,
  authorizeAdmin,
  async (req, res) => {
    try {
      const { status } = req.body; // pending | confirmed | processing | completed | cancelled
      const result = await OrderService.updateStatus(req.params.id, status);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Lấy lịch sử trạng thái đơn hàng
router.get("/:id/history", authenticateJWT, async (req, res) => {
  try {
    const history = await OrderService.getHistory(req.params.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
