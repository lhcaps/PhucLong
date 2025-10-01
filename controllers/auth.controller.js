const AuthService = require('../services/auth.service');

class AuthController {
  static async register(req, res) {
    try {
      const { Name, Email, Phone, Password } = req.body;
      await AuthService.register({ Name, Email, Phone, Password });
      res.status(201).json({ message: 'Đăng ký thành công' });
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
      res.json({ message: 'Đã logout' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = AuthController;
