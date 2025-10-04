const { sql, poolPromise } = require('../config/db');

class AdminDashboardService {
  static async getStats() {
    const pool = await poolPromise;

    const users = await pool.request()
      .query("SELECT COUNT(*) as totalUsers FROM Users");

    const ordersToday = await pool.request()
      .query(`
        SELECT COUNT(*) as ordersToday
        FROM Orders
        WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
      `);

    const revenueToday = await pool.request()
      .query(`
        SELECT ISNULL(SUM(Total),0) as revenueToday
        FROM Orders
        WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
          AND PaymentStatus='paid'
      `);

    const revenueTotal = await pool.request()
      .query("SELECT ISNULL(SUM(Total),0) as revenueTotal FROM Orders WHERE PaymentStatus='paid'");

    return {
      totalUsers: users.recordset[0].totalUsers,
      ordersToday: ordersToday.recordset[0].ordersToday,
      revenueToday: revenueToday.recordset[0].revenueToday,
      revenueTotal: revenueTotal.recordset[0].revenueTotal
    };
  }
}
module.exports = AdminDashboardService;
