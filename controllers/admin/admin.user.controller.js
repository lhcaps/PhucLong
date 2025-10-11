const AdminUserService = require("../../services/admin/admin.user.service");

class AdminUserController {
  static async getAll(req, res) {
    try {
      const users = await AdminUserService.getAll();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async updateRole(req, res) {
    try {
      const { role } = req.body;
      const result = await AdminUserService.updateRole(req.params.id, role);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async delete(req, res) {
    try {
      const result = await AdminUserService.delete(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = AdminUserController;
