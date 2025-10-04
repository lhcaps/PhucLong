const express = require('express');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth.middleware');
const AdminService = require('../services/admin.service');

const router = express.Router();

// Lấy tất cả user
router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const users = await AdminService.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update role user (vd: từ customer -> admin)
router.put('/:id/role', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { role } = req.body; // 'admin' | 'customer'
    const result = await AdminService.updateUserRole(req.params.id, role);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Xóa user
router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const result = await AdminService.deleteUser(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
