const AdminInventoryService = require("../../services/admin/admin.inventory.service");

class AdminInventoryController {
  static async updateStock(req, res) {
    try {
      const { stock } = req.body;
      const result = await AdminInventoryService.updateStock(req.params.id, stock);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async getHistory(req, res) {
    try {
      const history = await AdminInventoryService.getHistory();
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = AdminInventoryController;
