// routes/admin/admin.voucher.routes.js
const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminVoucherController = require("../../controllers/admin/admin.voucher.controller");

const router = express.Router();
router.use(authenticateJWT, authorizeAdmin);

// ✅ Lấy danh sách voucher
router.get("/", AdminVoucherController.getAll);

// ✅ Tạo voucher mới
router.post("/", AdminVoucherController.create);

// ✅ Cập nhật voucher
router.put("/:id", AdminVoucherController.update);

// ✅ Bật/tắt voucher
router.patch("/:id/toggle", AdminVoucherController.toggle);

// ✅ Xoá voucher
router.delete("/:id", AdminVoucherController.delete);

// ✅ Thống kê tổng quan voucher
router.get("/stats/overview", AdminVoucherController.stats);

module.exports = router;
