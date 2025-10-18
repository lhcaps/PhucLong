// routes/admin/admin.review.routes.js
const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminReviewController = require("../../controllers/admin/admin.review.controller");

const router = express.Router();
router.use(authenticateJWT, authorizeAdmin);

// ✅ Lấy danh sách review
router.get("/", AdminReviewController.list);

// ✅ Cập nhật review
router.put("/:id", AdminReviewController.update);

// ✅ Ẩn/hiện review
router.patch("/:id/toggle", AdminReviewController.toggle);

// ✅ Xoá review
router.delete("/:id", AdminReviewController.delete);

// ✅ Thống kê tổng quan
router.get("/stats/overview", AdminReviewController.stats);

// ✅ Top sản phẩm được đánh giá cao
router.get("/stats/top-rated", AdminReviewController.topRated);

module.exports = router;
