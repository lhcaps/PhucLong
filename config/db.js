// =============================================================
// 📦 SQL Server Connection (mssql + dotenv)
// -------------------------------------------------------------
// - Hỗ trợ cả instance (SQLEXPRESS) lẫn port (1433)
// - Tự log cấu hình kết nối tóm tắt (không in mật khẩu)
// - Dùng trustServerCertificate cho môi trường local
// - Dừng tiến trình nếu kết nối lỗi
// =============================================================

require("dotenv").config();
const sql = require("mssql");

// ======================
// 🧭 Chuẩn hóa giá trị ENV
// ======================
const DB_SERVER = process.env.DB_SERVER?.trim() || "localhost";
const DB_NAME = process.env.DB_NAME?.trim() || "PhucLongCNPMNC";
const DB_USER = process.env.DB_USER?.trim() || "phuclong_user";
const DB_PASSWORD = process.env.DB_PASSWORD?.trim() || "phuclong_pass";
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433;
const DB_INSTANCE = process.env.DB_INSTANCE?.trim() || null;

// ======================
// ⚙️ Cấu hình cơ bản
// ======================
const config = {
  user: DB_USER,
  password: DB_PASSWORD,
  server: DB_SERVER,
  database: DB_NAME,
  options: {
    encrypt: false, // ❌ false cho local dev
    trustServerCertificate: true, // ✅ bypass self-signed SSL
  },
};

// Nếu có instance name (VD: localhost\SQLEXPRESS)
if (DB_SERVER.includes("\\")) {
  // ⚠️ Nếu trong .env bạn đã ghi "localhost\SQLEXPRESS", không cần port
  delete config.port;
} else if (DB_INSTANCE) {
  // ⚙️ Hoặc nếu có DB_INSTANCE riêng
  delete config.port;
  config.options.instanceName = DB_INSTANCE;
} else {
  // ✅ Trường hợp server: localhost, IP, hoặc hostname
  config.port = DB_PORT;
}

// ======================
// 🧩 Kết nối & Log
// ======================
console.log("🛠️ SQL Config:", {
  server: DB_SERVER,
  instance: DB_INSTANCE || "(none)",
  database: DB_NAME,
  user: DB_USER,
  port: config.port || "(instance mode)",
});

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("✅ Kết nối SQL Server thành công");
    return pool;
  })
  .catch((err) => {
    console.error("❌ Lỗi kết nối DB:", err);
    console.error("💡 Kiểm tra lại .env (DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME)");
    process.exit(1);
  });

module.exports = { sql, poolPromise };
