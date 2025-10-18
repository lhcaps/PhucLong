// src/controllers/admin/admin.category.controller.js
const AdminCategoryService = require("../../services/admin/admin.category.service");

class AdminCategoryController {
  static async getAll(req, res) {
    try {
      const data = await AdminCategoryService.getAll();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const data = await AdminCategoryService.getById(req.params.id);
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const { Name } = req.body;
      const data = await AdminCategoryService.create(Name);
      res.status(201).json(data);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async update(req, res) {
    try {
      const { Name } = req.body;
      const data = await AdminCategoryService.update(req.params.id, Name);
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await AdminCategoryService.delete(req.params.id);
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = AdminCategoryController;
