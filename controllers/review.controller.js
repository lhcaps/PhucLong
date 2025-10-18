// controllers/review.controller.js
const ReviewService = require("../services/review.service");

class ReviewController {
  static async createOrUpdate(req, res) {
    try {
      const { productId, rating, comment } = req.body;
      if (!productId || !rating)
        return res.status(400).json({ ok: false, error: "INVALID_INPUT" });

      const result = await ReviewService.upsert(req.user.userId, productId, rating, comment);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  static async getProductReviews(req, res) {
    try {
      const productId = Number(req.params.productId);
      const result = await ReviewService.listByProduct(productId);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  static async deleteOwnReview(req, res) {
    try {
      const id = Number(req.params.id);
      const result = await ReviewService.delete(id, req.user.userId, false);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  // 🔧 Admin
  static async adminList(req, res) {
    try {
      const data = await ReviewService.listAll();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  static async adminUpdate(req, res) {
    try {
      const id = Number(req.params.id);
      const result = await ReviewService.updateByAdmin(id, req.body);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  static async adminDelete(req, res) {
    try {
      const id = Number(req.params.id);
      const result = await ReviewService.delete(id, null, true);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
}

module.exports = ReviewController;
