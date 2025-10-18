// routes/cart.route.js
const express = require("express");
const CartController = require("../controllers/cart.controller");
const { authenticateJWT } = require("../middleware/auth.middleware");

const router = express.Router();

// 🛒 Lấy giỏ hàng người dùng
router.get("/", authenticateJWT, CartController.get);

// ➕ Thêm sản phẩm vào giỏ
router.post("/", authenticateJWT, CartController.add);

// 🔁 Cập nhật số lượng item
router.put("/:id", authenticateJWT, CartController.update);

// 🗑️ Xóa sản phẩm khỏi giỏ
router.delete("/:id", authenticateJWT, CartController.remove);

module.exports = router;
