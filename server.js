const express = require('express');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const authRoutes = require('./routes/auth.routes');
const { authenticateJWT, authorizeAdmin } = require('./middleware/auth.middleware');

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send("🚀 PhucLong API Running"));

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Protected routes: orders require login
app.use('/api/orders', authenticateJWT, orderRoutes);

// ✅ Admin-only route (demo)
app.get('/api/admin/test', authenticateJWT, authorizeAdmin, (req, res) => {
  res.json({ message: `Hello Admin ${req.user.email}, bạn có quyền truy cập!` });
});

app.listen(process.env.PORT || 3000, () => 
  console.log("✅ Server chạy ở http://localhost:3000")
);
