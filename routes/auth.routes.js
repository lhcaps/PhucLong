// src/routes/auth.routes.js
const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const AuthController = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", AuthController.register);
router.get("/verify-email", AuthController.verifyEmail);
router.post("/login", AuthController.login);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password/:token", AuthController.resetPassword);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
router.get("/profile", authenticateJWT, AuthController.getProfile);
router.put("/profile", authenticateJWT, AuthController.updateProfile);
router.post("/change-password", authenticateJWT, AuthController.changePassword);

module.exports = router;
