// =============================================================
// 📦 SQL Server Connection (MSSQL + dotenv)
// -------------------------------------------------------------
// ✅ Hỗ trợ cả instance (SQLEXPRESS) lẫn cổng (1433)
// ✅ Cấu trúc an toàn: Singleton Connection Pool
// ✅ Tự động reconnect nếu mất kết nối
// ✅ Log chi tiết, phù hợp cho môi trường Production
// =============================================================

require("dotenv").config();
const sql = require("mssql");

// =============================================================
// 🧭 Load & Chuẩn hóa ENV
// =============================================================
const DB_SERVER = process.env.DB_SERVER?.trim() || "localhost\\SQLEXPRESS";
const DB_NAME = process.env.DB_NAME?.trim() || "PhucLongCNPMNC";
const DB_USER = process.env.DB_USER?.trim() || "phuclong_user";
const DB_PASSWORD = process.env.DB_PASSWORD?.trim() || "phuclong_pass";
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433;
const DB_INSTANCE = process.env.DB_INSTANCE?.trim() || null;

// =============================================================
// ⚙️ Build config động (instance / port)
// =============================================================
const config = {
  user: DB_USER,
  password: DB_PASSWORD,
  server: DB_SERVER,
  database: DB_NAME,
  pool: {
    max: 10, // số connection tối đa
    min: 1,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false, // local: false; azure: true
    trustServerCertificate: true,
  },
};

// Instance name → override port
if (DB_SERVER.includes("\\")) {
  delete config.port;
} else if (DB_INSTANCE) {
  config.options.instanceName = DB_INSTANCE;
  delete config.port;
} else {
  config.port = DB_PORT;
}

// =============================================================
// 🧩 Logging Cấu hình (ẩn mật khẩu)
// =============================================================
console.log("🛠️ SQL Config:", {
  server: config.server,
  instance: DB_INSTANCE || "(none)",
  database: config.database,
  user: config.user,
  port: config.port || "(instance mode)",
});

// =============================================================
// 🔁 Singleton Connection Pool
// =============================================================
let pool; // giữ kết nối duy nhất trong toàn hệ thống
let isConnecting = false;

// ✅ Hàm chính để lấy pool (dùng cho mọi service)
async function getPool() {
  if (pool) return pool; // nếu đã kết nối → dùng lại
  if (isConnecting) {
    // đợi nếu đang trong quá trình connect
    await new Promise((resolve) => setTimeout(resolve, 300));
    return getPool();
  }

  try {
    isConnecting = true;
    pool = await new sql.ConnectionPool(config).connect();
    console.log("✅ SQL Server: kết nối thành công!");
    isConnecting = false;

    // Nếu có sự cố kết nối → tự reset
    pool.on("error", (err) => {
      console.error("⚠️ SQL Pool error:", err);
      pool = null;
    });

    return pool;
  } catch (err) {
    console.error("❌ Lỗi kết nối SQL Server:", err.message);
    isConnecting = false;
    throw err;
  }
}

// =============================================================
// 🧠 Health Check tiện ích (optional)
// =============================================================
async function testConnection() {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT GETDATE() AS ServerTime");
    console.log("🧠 SQL Health Check:", result.recordset[0]);
  } catch (err) {
    console.error("❌ SQL Health Check Failed:", err.message);
  }
}

// testConnection(); // bật nếu muốn kiểm tra lúc khởi động

// =============================================================
// 📤 Export module
// =============================================================
module.exports = {
  sql,
  getPool,
};
