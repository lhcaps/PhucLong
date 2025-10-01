const express = require('express');
const sql = require('mssql');

const app = express();
app.use(express.json());

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

// API test
app.get('/api/time', async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query('SELECT GETDATE() AS now');
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Chạy server
app.listen(3000, () => {
  console.log('✅ Server chạy ở http://localhost:3000');
});
