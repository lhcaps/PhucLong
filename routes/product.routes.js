const express = require('express');
const ProductService = require('../services/product.service');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const products = await ProductService.getAll();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await ProductService.getById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
