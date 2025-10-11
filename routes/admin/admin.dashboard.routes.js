const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminDashboardController = require("../../controllers/admin/admin.dashboard.controller");

const router = express.Router();

// ✅ Lấy thống kê tổng quan
router.get("/stats", authenticateJWT, authorizeAdmin, AdminDashboardController.getStats);

module.exports = router;
