const AuthService = require("../services/auth.service");

class AuthController {
  static async register(req, res) {
    try {
      const { Name, Email, Phone, Password } = req.body;
      await AuthService.register({ Name, Email, Phone, Password });
      res.status(201).json({ message: "Đăng ký thành công" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async login(req, res) {
    try {
      const { Email, Password } = req.body;
      const tokens = await AuthService.login({ Email, Password });
      res.json(tokens);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  }

  static async loginWithGoogle(req, res) {
    try {
      const { idToken } = req.body;
      const data = await AuthService.loginWithGoogle(idToken);
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const msg = await AuthService.forgotPassword(email);
      res.json({ message: msg });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token } = req.params;
      const { newPassword } = req.body;
      const msg = await AuthService.resetPassword(token, newPassword);
      res.json({ message: msg });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const data = await AuthService.refreshToken(refreshToken);
      res.json(data);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  }

  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      await AuthService.revokeRefreshToken(refreshToken);
      res.json({ message: "Đã logout" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async getProfile(req, res) {
    try {
      const user = await AuthService.getProfile(req.user.userId);
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { Name, Phone } = req.body;
      await AuthService.updateProfile(req.user.userId, { Name, Phone });
      res.json({ message: "✅ Cập nhật hồ sơ thành công" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user.userId, oldPassword, newPassword);
      res.json({ message: "✅ Đổi mật khẩu thành công" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = AuthController;
