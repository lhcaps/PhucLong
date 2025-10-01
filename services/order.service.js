const { sql, poolPromise } = require('../config/db');
const { Order, OrderItem } = require('../models/order.model');

class OrderService {
  // Tạo đơn hàng + items
  static async create(orderData, items) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const request = new sql.Request(transaction);
      const result = await request
        .input('UserId', sql.Int, orderData.UserId)
        .input('TotalAmount', sql.Decimal(12, 2), orderData.TotalAmount)
        .query(`
          INSERT INTO Orders (UserId, TotalAmount, Status, PaymentStatus)
          OUTPUT INSERTED.*
          VALUES (@UserId, @TotalAmount, 'pending', 'unpaid')
        `);

      const newOrder = result.recordset[0];

      // Thêm các OrderItems
      for (const item of items) {
        await new sql.Request(transaction)
          .input('OrderId', sql.Int, newOrder.Id)
          .input('ProductId', sql.Int, item.ProductId)
          .input('Size', sql.NVarChar, item.Size)
          .input('Topping', sql.NVarChar, item.Topping)
          .input('Quantity', sql.Int, item.Quantity)
          .input('Price', sql.Decimal(10, 2), item.Price)
          .query(`
            INSERT INTO OrderItems (OrderId, ProductId, Size, Topping, Quantity, Price)
            VALUES (@OrderId, @ProductId, @Size, @Topping, @Quantity, @Price)
          `);
      }

      await transaction.commit();
      return new Order(newOrder);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // Lấy đơn hàng theo user
  static async getByUser(userId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UserId', sql.Int, userId)
      .query('SELECT * FROM Orders WHERE UserId=@UserId ORDER BY CreatedAt DESC');
    return result.recordset.map(row => new Order(row));
  }

  // Lấy chi tiết đơn hàng + items
  static async getById(orderId) {
    const pool = await poolPromise;

    const orderRes = await pool.request()
      .input('Id', sql.Int, orderId)
      .query('SELECT * FROM Orders WHERE Id=@Id');

    if (orderRes.recordset.length === 0) return null;
    const order = new Order(orderRes.recordset[0]);

    const itemsRes = await pool.request()
      .input('OrderId', sql.Int, orderId)
      .query('SELECT * FROM OrderItems WHERE OrderId=@OrderId');
    order.Items = itemsRes.recordset.map(row => new OrderItem(row));

    return order;
  }

  // Admin cập nhật trạng thái đơn hàng
  static async updateStatus(orderId, status, paymentStatus) {
    const pool = await poolPromise;
    await pool.request()
      .input('Id', sql.Int, orderId)
      .input('Status', sql.NVarChar, status)
      .input('PaymentStatus', sql.NVarChar, paymentStatus)
      .query(`
        UPDATE Orders SET Status=@Status, PaymentStatus=@PaymentStatus WHERE Id=@Id
      `);
    return { message: "✅ Đã cập nhật trạng thái đơn hàng" };
  }
}

module.exports = OrderService;
