const express = require("express");
const AuthController = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/google", AuthController.loginWithGoogle);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
router.get("/profile", AuthController.getProfile);
router.put("/profile", AuthController.updateProfile);
router.post("/change-password", AuthController.changePassword);

// new features
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password/:token", AuthController.resetPassword);

module.exports = router;
