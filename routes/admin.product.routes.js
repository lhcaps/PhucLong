const express = require('express');
const ProductService = require('../services/product.service');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// POST: Admin thêm sản phẩm
router.post('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const result = await ProductService.create(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT: Admin sửa sản phẩm
router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const result = await ProductService.update(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE: Admin xoá sản phẩm
router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const result = await ProductService.delete(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
