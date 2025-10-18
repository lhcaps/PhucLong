// src/controllers/auth.controller.js
const AuthService = require("../services/auth.service");

class AuthController {
  static async register(req, res) {
    try {
      const msg = await AuthService.register(req.body);
      res.status(201).json({ message: msg });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  static async verifyEmail(req, res) {
    try {
      const { token } = req.query;
      const data = await AuthService.verifyEmail(token);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  static async login(req, res) {
    try {
      const data = await AuthService.login(req.body);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const msg = await AuthService.forgotPassword(req.body.email);
      res.json({ message: msg });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token } = req.params;
      const { newPassword } = req.body;
      const msg = await AuthService.resetPassword(token, newPassword);
      res.json({ message: msg });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  static async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const data = await AuthService.refreshToken(refreshToken);
      res.json(data);
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  }

  static async logout(req, res) {
    try {
      await AuthService.revokeRefreshToken(req.body.refreshToken);
      res.json({ message: "Đã đăng xuất" });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  static async getProfile(req, res) {
    try {
      const data = await AuthService.getProfile(req.user.userId);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  static async updateProfile(req, res) {
    try {
      await AuthService.updateProfile(req.user.userId, req.body);
      res.json({ message: "Cập nhật thành công" });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  static async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user.userId, oldPassword, newPassword);
      res.json({ message: "Đổi mật khẩu thành công" });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
}

module.exports = AuthController;
