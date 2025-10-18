// controllers/admin/admin.voucher.controller.js
const AdminVoucherService = require("../../services/admin/admin.voucher.service");

class AdminVoucherController {
  static async getAll(req, res) {
    try {
      const data = await AdminVoucherService.getAll();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const result = await AdminVoucherService.create(req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const result = await AdminVoucherService.update(id, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async toggle(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const result = await AdminVoucherService.toggleActive(id, isActive);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await AdminVoucherService.delete(id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async stats(req, res) {
    try {
      const result = await AdminVoucherService.getStats();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = AdminVoucherController;
