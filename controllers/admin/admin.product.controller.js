const AdminProductService = require("../../services/admin/admin.product.service");

class AdminProductController {
  static async getAll(req, res) {
    try {
      const products = await AdminProductService.getAll();
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const product = await AdminProductService.getById(req.params.id);
      res.json(product);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const result = await AdminProductService.create(req.body);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async update(req, res) {
    try {
      const result = await AdminProductService.update(req.params.id, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async delete(req, res) {
    try {
      const result = await AdminProductService.delete(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = AdminProductController;
