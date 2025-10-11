const express = require("express");
const AuthController = require("../controllers/auth.controller");
const { forgotLimiter } = require("../middleware/rateLimiter");
const { validate } = require("../middleware/validate");
const { z } = require("zod");

const router = express.Router();

// Schema validation
const registerSchema = z.object({
  Name: z.string().min(2),
  Email: z.string().email(),
  Phone: z.string().regex(/^[0-9]{10,11}$/),
  Password: z.string().min(6),
});

const loginSchema = z.object({
  Email: z.string().email(),
  Password: z.string().min(6),
});

// Routes
router.post("/register", validate(registerSchema), AuthController.register);
router.post("/login", validate(loginSchema), AuthController.login);
router.post("/google", AuthController.loginWithGoogle);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
router.get("/profile", AuthController.getProfile);
router.put("/profile", AuthController.updateProfile);
router.post("/change-password", AuthController.changePassword);
router.post("/forgot-password", forgotLimiter, AuthController.forgotPassword);
router.post("/reset-password/:token", forgotLimiter, AuthController.resetPassword);

module.exports = router;
