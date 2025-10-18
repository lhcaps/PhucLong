// routes/orderHistory.routes.js
const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../middleware/auth.middleware");
const OrderHistoryController = require("../controllers/orderHistory.controller");

const router = express.Router();

// 🟢 User
router.get("/my", authenticateJWT, OrderHistoryController.listMyOrders);
router.get("/my/:id", authenticateJWT, OrderHistoryController.detail);

// 🟣 Admin
router.get("/admin/all", authenticateJWT, authorizeAdmin, OrderHistoryController.adminList);

module.exports = router;
