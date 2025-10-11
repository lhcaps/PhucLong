const AdminLoyaltyService = require("../../services/admin/admin.loyalty.service");

class AdminLoyaltyController {
  // Lấy lịch sử loyalty
  static async getTransactions(req, res) {
    try {
      const data = await AdminLoyaltyService.getAllTransactions();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // Admin cộng/trừ điểm
  static async adjust(req, res) {
    try {
      const result = await AdminLoyaltyService.adjustPoints(req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = AdminLoyaltyController;
