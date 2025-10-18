// ======================================================
// 📦 models/order.model.js
// ------------------------------------------------------
// ✅ Tương thích toàn bộ hệ thống OrderService
// ✅ Ghi log Subtotal, ShippingFee, Total chính xác
// ✅ Hỗ trợ giao hàng và nhận tại cửa hàng
// ======================================================

const { sql, getPool } = require("../config/db");

class OrderModel {
  // ==================================================
  // 🧾 Tạo đơn hàng mới
  // ==================================================
  static async insertOrder(tx, data) {
    const result = await new sql.Request(tx)
      .input("UserId", sql.Int, data.UserId)
      .input("Subtotal", sql.Decimal(10, 2), data.Subtotal || 0) // ✅ thêm Subtotal
      .input("Total", sql.Decimal(10, 2), data.Total)
      .input("PaymentMethod", sql.NVarChar(50), data.PaymentMethod)
      .input("PaymentStatus", sql.NVarChar(50), data.PaymentStatus)
      .input("Status", sql.NVarChar(50), data.Status)
      .input("FulfillmentMethod", sql.NVarChar(50), data.FulfillmentMethod)
      .input("DeliveryAddress", sql.NVarChar(255), data.DeliveryAddress || null)
      .input("DeliveryLat", sql.Float, data.DeliveryLat || null)
      .input("DeliveryLng", sql.Float, data.DeliveryLng || null)
      .input("StoreId", sql.Int, data.StoreId || null)
      .input("ShippingFee", sql.Decimal(10, 2), data.ShippingFee || 0)
      .query(`
        INSERT INTO Orders
          (UserId, Subtotal, Total, PaymentMethod, PaymentStatus, Status,
           FulfillmentMethod, DeliveryAddress, DeliveryLat, DeliveryLng, StoreId, ShippingFee)
        OUTPUT Inserted.Id
        VALUES
          (@UserId, @Subtotal, @Total, @PaymentMethod, @PaymentStatus, @Status,
           @FulfillmentMethod, @DeliveryAddress, @DeliveryLat, @DeliveryLng, @StoreId, @ShippingFee)
      `);

    return result.recordset[0].Id;
  }

  // ==================================================
  // 🧾 Thêm từng sản phẩm vào OrderItems
  // ==================================================
  static async insertOrderItem(tx, item) {
    await new sql.Request(tx)
      .input("OrderId", sql.Int, item.OrderId)
      .input("ProductId", sql.Int, item.ProductId)
      .input("Quantity", sql.Int, item.Quantity)
      .input("Price", sql.Decimal(10, 2), item.Price)
      .input("Size", sql.NVarChar(50), item.Size || null)
      .input("Sugar", sql.NVarChar(50), item.Sugar || null)
      .input("Ice", sql.NVarChar(50), item.Ice || null)
      .input("Topping", sql.NVarChar(255), item.Topping || null)
      .query(`
        INSERT INTO OrderItems (OrderId, ProductId, Quantity, Price, Size, Sugar, Ice, Topping)
        VALUES (@OrderId, @ProductId, @Quantity, @Price, @Size, @Sugar, @Ice, @Topping)
      `);
  }

  // ==================================================
  // 📋 Lấy danh sách đơn theo User
  // ==================================================
  static async getOrdersByUser(userId) {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(`
        SELECT * 
        FROM Orders
        WHERE UserId = @UserId
        ORDER BY CreatedAt DESC
      `);
    return res.recordset;
  }

  // ==================================================
  // 🧾 Lấy danh sách sản phẩm trong 1 đơn hàng
  // ==================================================
  static async getOrderItems(orderId) {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("OrderId", sql.Int, orderId)
      .query(`
        SELECT 
          oi.Id,
          oi.ProductId,
          oi.Quantity,
          oi.Price,
          oi.Size,
          oi.Sugar,
          oi.Ice,
          oi.Topping,
          p.Name AS ProductName,
          p.ImageUrl
        FROM OrderItems oi
        JOIN Products p ON oi.ProductId = p.Id
        WHERE oi.OrderId = @OrderId
      `);
    return res.recordset;
  }

  // ==================================================
  // 🧾 Lấy toàn bộ đơn hàng (cho Admin Dashboard)
  // ==================================================
  static async getAllOrders() {
    const pool = await getPool();
    const res = await pool.request().query(`
      SELECT o.*, u.FullName AS CustomerName, u.Email
      FROM Orders o
      JOIN Users u ON o.UserId = u.Id
      ORDER BY o.CreatedAt DESC
    `);
    return res.recordset;
  }

  // ==================================================
  // ⚙️ Cập nhật trạng thái đơn hàng
  // ==================================================
  static async updateStatus(orderId, status, paymentStatus = null) {
    const pool = await getPool();
    const req = pool.request()
      .input("Id", sql.Int, orderId)
      .input("Status", sql.NVarChar(50), status);

    let query = `UPDATE Orders SET Status = @Status`;

    if (paymentStatus) {
      req.input("PaymentStatus", sql.NVarChar(50), paymentStatus);
      query += `, PaymentStatus = @PaymentStatus`;
    }

    query += ` WHERE Id = @Id`;
    await req.query(query);
  }

  // ==================================================
  // 🧾 Lấy chi tiết đơn hàng theo ID
  // ==================================================
  static async getOrderById(orderId) {
    const pool = await getPool();
    const res = await pool.request()
      .input("Id", sql.Int, orderId)
      .query(`SELECT * FROM Orders WHERE Id = @Id`);
    return res.recordset[0] || null;
  }
}

module.exports = OrderModel;
