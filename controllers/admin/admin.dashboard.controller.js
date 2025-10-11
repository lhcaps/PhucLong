const AdminDashboardService = require("../../services/admin/admin.dashboard.service");

class AdminDashboardController {
  // ✅ Lấy thống kê tổng quan
  static async getStats(req, res) {
    try {
      const stats = await AdminDashboardService.getStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message || "Lỗi khi lấy thống kê tổng quan"
      });
    }
  }
}

module.exports = AdminDashboardController;
