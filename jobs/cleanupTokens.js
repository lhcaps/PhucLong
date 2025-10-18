const cron = require("node-cron");
const { sql, getPool } = require("../config/db");


// Chạy 3h sáng mỗi ngày
cron.schedule("0 3 * * *", async () => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("Now", sql.DateTime, new Date())
      .query("DELETE FROM RefreshTokens WHERE ExpiresAt < @Now");

    console.log(`🧹 Cleanup RefreshTokens: ${result.rowsAffected[0]} rows deleted`);
  } catch (err) {
    console.error("Cleanup error:", err.message);
  }
});
