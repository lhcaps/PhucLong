require('dotenv').config(); // nạp biến từ .env
const sql = require('mssql');

// Lấy biến từ .env
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'PhucLongCNPMNC', // ⚙️ cập nhật đúng DB mới
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
  options: {
    encrypt: false, // false cho local
    trustServerCertificate: true
  }
};

// Nếu có instance name (VD: SQLEXPRESS) thì dùng instanceName
if (process.env.DB_INSTANCE) {
  delete config.port; // bỏ port nếu có instance
  config.options.instanceName = process.env.DB_INSTANCE;
}

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ Kết nối SQL Server thành công');
    return pool;
  })
  .catch(err => {
    console.error('❌ Lỗi kết nối DB:', err);
    process.exit(1);
  });

module.exports = { sql, poolPromise };
