const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminInventoryController = require("../../controllers/admin/admin.inventory.controller");

const router = express.Router();

// ✅ Cập nhật tồn kho sản phẩm
router.put("/:id/stock", authenticateJWT, authorizeAdmin, AdminInventoryController.updateStock);

// ✅ Lấy danh sách lịch sử nhập/xuất kho (nếu có)
router.get("/history", authenticateJWT, authorizeAdmin, AdminInventoryController.getHistory);

module.exports = router;
