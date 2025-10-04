// routes/auth.routes.js
const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);

// routes/auth.routes.js
router.put('/profile', authenticateJWT, AuthController.updateProfile);

// routes/auth.routes.js
router.put('/change-password', authenticateJWT, AuthController.changePassword);

// ✅ New: profile
router.get('/me', authenticateJWT, AuthController.getProfile);

router.use(express.json());

module.exports = router;
