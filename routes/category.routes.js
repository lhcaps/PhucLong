const express = require("express");
const CategoryService = require("../services/category.service");
const { authenticateJWT, authorizeAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

// Lấy tất cả categories
router.get("/", async (req, res) => {
  try {
    const categories = await CategoryService.getAll();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy category theo id
router.get("/:id", async (req, res) => {
  try {
    const category = await CategoryService.getById(req.params.id);
    if (!category) return res.status(404).json({ error: "Không tìm thấy danh mục" });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin tạo category
router.post("/", authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { Name } = req.body;
    const result = await CategoryService.create(Name);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin update category
router.put("/:id", authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { Name } = req.body;
    const result = await CategoryService.update(req.params.id, Name);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin delete category
router.delete("/:id", authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const result = await CategoryService.delete(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
