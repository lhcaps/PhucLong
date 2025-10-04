const express = require('express');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth.middleware');
const AdminService = require('../services/admin.service');

const router = express.Router();

// Update stock sản phẩm
router.put('/:id/stock', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { stock } = req.body;
    const result = await AdminService.updateStock(req.params.id, stock);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
