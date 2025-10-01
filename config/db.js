const sql = require('mssql');

const config = {
  user: 'phuclong_user',
  password: 'StrongPass123!',
  server: 'localhost',
  database: 'PhucLongDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

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

module.exports = {
  sql, poolPromise
};
