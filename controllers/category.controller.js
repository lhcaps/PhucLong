// src/controllers/category.controller.js
const CategoryService = require("../services/category.service");

class CategoryController {
  static async getAll(req, res) {
    try {
      const data = await CategoryService.getAll();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const data = await CategoryService.getById(req.params.id);
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }
}

module.exports = CategoryController;
