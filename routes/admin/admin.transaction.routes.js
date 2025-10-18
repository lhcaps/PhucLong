// routes/admin/admin.transaction.routes.js
const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminTransactionController = require("../../controllers/admin/admin.transaction.controller");

const router = express.Router();
router.use(authenticateJWT, authorizeAdmin);

// ✅ Lấy danh sách giao dịch
router.get("/", AdminTransactionController.list);

// ✅ Xem chi tiết giao dịch
router.get("/:id", AdminTransactionController.detail);

// ✅ Thống kê tổng quan
router.get("/stats/overview", AdminTransactionController.stats);

module.exports = router;
