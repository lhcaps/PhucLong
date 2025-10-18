// routes/review.routes.js
const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../middleware/auth.middleware");
const ReviewController = require("../controllers/review.controller");

const router = express.Router();

// 🟢 User actions
router.post("/", authenticateJWT, ReviewController.createOrUpdate);
router.get("/product/:productId", ReviewController.getProductReviews);
router.delete("/:id", authenticateJWT, ReviewController.deleteOwnReview);

// 🟣 Admin actions
router.get("/admin/all", authenticateJWT, authorizeAdmin, ReviewController.adminList);
router.put("/admin/:id", authenticateJWT, authorizeAdmin, ReviewController.adminUpdate);
router.delete("/admin/:id", authenticateJWT, authorizeAdmin, ReviewController.adminDelete);

module.exports = router;
