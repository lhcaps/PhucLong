// controllers/admin/admin.review.controller.js
const AdminReviewService = require("../../services/admin/admin.review.service");

class AdminReviewController {
  // ✅ Danh sách toàn bộ review
  static async list(req, res) {
    try {
      const data = await AdminReviewService.getAll();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ✅ Cập nhật review
  static async update(req, res) {
    try {
      const id = Number(req.params.id);
      const result = await AdminReviewService.update(id, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }

  // ✅ Ẩn/hiện review
  static async toggle(req, res) {
    try {
      const id = Number(req.params.id);
      const { visible } = req.body;
      const result = await AdminReviewService.toggleVisibility(id, visible);
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }

  // ✅ Xoá review
  static async delete(req, res) {
    try {
      const id = Number(req.params.id);
      const result = await AdminReviewService.delete(id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }

  // ✅ Thống kê tổng quan
  static async stats(req, res) {
    try {
      const result = await AdminReviewService.getStats();
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ✅ Top sản phẩm được đánh giá cao
  static async topRated(req, res) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 5;
      const result = await AdminReviewService.topRatedProducts(limit);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
}

module.exports = AdminReviewController;
