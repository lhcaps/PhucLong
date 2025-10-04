const { sql, poolPromise } = require("../config/db");
const LoyaltyService = require("../services/loyalty.service");

class OrderService {
  // paymentMethod = "COD" | "VNPay" | "MoMo"
  // opts = { fulfillment: 'delivery'|'pickup', address, lat, lng, storeId, paymentMethod? }
  static async createOrder(userId, paymentMethod = "COD", opts = {}) {
    const pool = await poolPromise;

    // Cho phép gọi kiểu createOrder(userId, { ... })
    if (paymentMethod && typeof paymentMethod === "object" && opts && Object.keys(opts).length === 0) {
      opts = paymentMethod;
      paymentMethod = opts.paymentMethod || "COD";
    }

    const ALLOWED_METHODS = ["COD", "VNPay", "MoMo"];
    const method = ALLOWED_METHODS.includes(String(paymentMethod)) ? String(paymentMethod) : "COD";

    const fulfillment = (opts.fulfillment || "delivery").toLowerCase();
    if (!["delivery", "pickup"].includes(fulfillment)) {
      throw new Error("Fulfillment không hợp lệ (delivery|pickup)");
    }

    // 15k cho 3km đầu, +3k/km, làm tròn lên, trần 40k
    const calcShippingFee = (km) => {
      if (!Number.isFinite(km) || km <= 0) return 0;
      const base = 15000;
      if (km <= 3) return base;
      return Math.min(40000, base + Math.ceil(km - 3) * 3000);
    };

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      // 1) Giỏ hàng
      const cart = await new sql.Request(tx)
        .input("UserId", sql.Int, userId)
        .query(`
          SELECT c.Id, c.ProductId, c.Quantity, p.Price,
                 c.Size, c.Sugar, c.Ice, c.Topping
          FROM CartItems c
          JOIN Products p ON c.ProductId = p.Id
          WHERE c.UserId = @UserId
        `);

      if (!cart.recordset.length) {
        await tx.rollback();
        throw new Error("Giỏ hàng trống");
      }

      const subtotal = cart.recordset.reduce(
        (sum, item) => sum + Number(item.Price) * Number(item.Quantity),
        0
      );

      // 2) Chọn store + ship fee
      let storeId = null;
      let shippingFee = 0;
      let deliveryAddress = null;
      let deliveryLat = null;
      let deliveryLng = null;

      if (fulfillment === "pickup") {
        if (!opts.storeId) {
          await tx.rollback();
          throw new Error("Thiếu storeId cho pickup");
        }
        storeId = Number(opts.storeId);
        const storeRes = await new sql.Request(tx)
          .input("Id", sql.Int, storeId)
          .query(`SELECT Id FROM Stores WHERE Id=@Id AND IsOpen=1`);
        if (!storeRes.recordset.length) {
          await tx.rollback();
          throw new Error("Cửa hàng không hợp lệ hoặc không hoạt động");
        }
      } else {
        deliveryAddress = (opts.address || "").toString().trim();
        deliveryLat = Number(opts.lat);
        deliveryLng = Number(opts.lng);
        if (!deliveryAddress || !Number.isFinite(deliveryLat) || !Number.isFinite(deliveryLng)) {
          await tx.rollback();
          throw new Error("Thiếu address/lat/lng cho giao hàng");
        }

        const near = await new sql.Request(tx)
          .input("Lat", sql.Float, deliveryLat)
          .input("Lng", sql.Float, deliveryLng)
          .query(`
            DECLARE @p geography = geography::Point(@Lat, @Lng, 4326);
            SELECT TOP 1 Id, Geo.STDistance(@p)/1000.0 AS DistanceKm
            FROM Stores
            WHERE IsOpen=1 AND Geo IS NOT NULL
            ORDER BY Geo.STDistance(@p) ASC;
          `);
        if (!near.recordset.length) {
          await tx.rollback();
          throw new Error("Chưa có cửa hàng nào trong hệ thống");
        }
        storeId = near.recordset[0].Id;
        const distanceKm = Number(near.recordset[0].DistanceKm);
        shippingFee = calcShippingFee(distanceKm);
      }

      const total = subtotal + shippingFee;

      // 3) Orders
      const orderRes = await new sql.Request(tx)
        .input("UserId", sql.Int, userId)
        .input("Total", sql.Decimal(10, 2), total)
        .input("PaymentMethod", sql.NVarChar, method)
        .input("FulfillmentMethod", sql.NVarChar, fulfillment)
        .input("DeliveryAddress", sql.NVarChar, deliveryAddress)
        .input("DeliveryLat", sql.Float, deliveryLat)
        .input("DeliveryLng", sql.Float, deliveryLng)
        .input("StoreId", sql.Int, storeId)
        .input("ShippingFee", sql.Decimal(10, 2), shippingFee)
        .query(`
          INSERT INTO Orders
            (UserId, Total, PaymentMethod, PaymentStatus, Status,
             FulfillmentMethod, DeliveryAddress, DeliveryLat, DeliveryLng, StoreId, ShippingFee)
          OUTPUT Inserted.Id
          VALUES
            (@UserId, @Total, @PaymentMethod, 'unpaid', 'pending',
             @FulfillmentMethod, @DeliveryAddress, @DeliveryLat, @DeliveryLng, @StoreId, @ShippingFee)
        `);

      const orderId = orderRes.recordset[0].Id;

      // 4) OrderItems
      for (const item of cart.recordset) {
        await new sql.Request(tx)
          .input("OrderId", sql.Int, orderId)
          .input("ProductId", sql.Int, item.ProductId)
          .input("Quantity", sql.Int, item.Quantity)
          .input("Price", sql.Decimal(10, 2), item.Price)
          .input("Size", sql.NVarChar, item.Size || null)
          .input("Sugar", sql.NVarChar, item.Sugar || null)
          .input("Ice", sql.NVarChar, item.Ice || null)
          .input("Topping", sql.NVarChar, item.Topping || null)
          .query(`
            INSERT INTO OrderItems (OrderId, ProductId, Quantity, Price, Size, Sugar, Ice, Topping)
            VALUES (@OrderId, @ProductId, @Quantity, @Price, @Size, @Sugar, @Ice, @Topping)
          `);
      }

      // 5) Clear cart
      await new sql.Request(tx)
        .input("UserId", sql.Int, userId)
        .query("DELETE FROM CartItems WHERE UserId=@UserId");

      await tx.commit();

      return {
        message: "✅ Đặt hàng thành công",
        orderId,
        subtotal,
        shippingFee,
        total,
        status: "pending",
        paymentMethod: method,
        fulfillment,
        storeId,
      };
    } catch (err) {
      try { await tx.rollback(); } catch (_) {}
      throw err;
    }
  }

  static async getOrdersByUser(userId) {
    const pool = await poolPromise;
    const ordersRes = await pool.request()
      .input("UserId", sql.Int, userId)
      .query(`
        SELECT *
        FROM Orders
        WHERE UserId=@UserId
        ORDER BY CreatedAt DESC
      `);

    const orders = ordersRes.recordset;
    for (const order of orders) {
      const itemsRes = await pool.request()
        .input("OrderId", sql.Int, order.Id)
        .query(`
          SELECT oi.Id, oi.ProductId, oi.Quantity, oi.Price,
                 oi.Size, oi.Sugar, oi.Ice, oi.Topping,
                 p.Name, p.ImageUrl
          FROM OrderItems oi
          JOIN Products p ON oi.ProductId = p.Id
          WHERE oi.OrderId=@OrderId
        `);
      order.Items = itemsRes.recordset;
    }
    return orders;
  }

  static async getOrderById(userId, orderId) {
    const pool = await poolPromise;
    const orderRes = await pool.request()
      .input("Id", sql.Int, orderId)
      .input("UserId", sql.Int, userId)
      .query(`SELECT * FROM Orders WHERE Id=@Id AND UserId=@UserId`);
    if (!orderRes.recordset.length) throw new Error("Không tìm thấy đơn hàng");

    const order = orderRes.recordset[0];
    const itemsRes = await pool.request()
      .input("OrderId", sql.Int, orderId)
      .query(`
        SELECT oi.Id, oi.ProductId, oi.Quantity, oi.Price,
               oi.Size, oi.Sugar, oi.Ice, oi.Topping,
               p.Name, p.ImageUrl
        FROM OrderItems oi
        JOIN Products p ON oi.ProductId = p.Id
        WHERE oi.OrderId=@OrderId
      `);
    order.Items = itemsRes.recordset;
    return order;
  }

  static async getAllOrders() {
    const pool = await poolPromise;
    const result = await pool.request()
      .query("SELECT * FROM Orders ORDER BY CreatedAt DESC");
    return result.recordset;
  }

  static async updateStatus(orderId, status) {
    const valid = ["pending", "confirmed", "processing", "completed", "cancelled"];
    if (!valid.includes(status)) throw new Error("Trạng thái không hợp lệ");

    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const orderRes = await new sql.Request(tx)
        .input("Id", sql.Int, orderId)
        .query(`SELECT UserId, Total, Status, PaymentMethod, PaymentStatus FROM Orders WHERE Id=@Id`);
      if (!orderRes.recordset.length) throw new Error("Không tìm thấy đơn hàng");
      const order = orderRes.recordset[0];

      await new sql.Request(tx)
        .input("Id", sql.Int, orderId)
        .input("Status", sql.NVarChar, status)
        .query(`UPDATE Orders SET Status=@Status WHERE Id=@Id`);

      if (status === "completed" && order.PaymentMethod === "COD" && order.PaymentStatus !== "paid") {
        await new sql.Request(tx)
          .input("Id", sql.Int, orderId)
          .query(`UPDATE Orders SET PaymentStatus='paid' WHERE Id=@Id`);
      }

      await new sql.Request(tx)
        .input("OrderId", sql.Int, orderId)
        .input("OldStatus", sql.NVarChar, order.Status)
        .input("NewStatus", sql.NVarChar, status)
        .query(`
          INSERT INTO OrderHistory (OrderId, OldStatus, NewStatus)
          VALUES (@OrderId, @OldStatus, @NewStatus)
        `);

      await tx.commit();

      if (status === "completed" && order.Status !== "completed") {
        await LoyaltyService.addPoints(order.UserId, order.Total, orderId);
      }

      return { message: `✅ Đã cập nhật đơn #${orderId} sang trạng thái ${status}` };
    } catch (err) {
      try { await tx.rollback(); } catch (_) {}
      throw err;
    }
  }

  static async cancelOrder(userId, orderId) {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const res = await new sql.Request(tx)
        .input("Id", sql.Int, orderId)
        .input("UserId", sql.Int, userId)
        .query(`
          SELECT * FROM Orders
          WHERE Id=@Id AND UserId=@UserId AND Status='pending'
        `);
      if (!res.recordset.length) throw new Error("Không thể hủy đơn này");

      await new sql.Request(tx)
        .input("Id", sql.Int, orderId)
        .query(`UPDATE Orders SET Status='cancelled' WHERE Id=@Id`);

      await new sql.Request(tx)
        .input("OrderId", sql.Int, orderId)
        .input("OldStatus", sql.NVarChar, "pending")
        .input("NewStatus", sql.NVarChar, "cancelled")
        .query(`
          INSERT INTO OrderHistory (OrderId, OldStatus, NewStatus)
          VALUES (@OrderId, @OldStatus, @NewStatus)
        `);

      await tx.commit();
      return { message: `🛑 Đã hủy đơn #${orderId}` };
    } catch (err) {
      try { await tx.rollback(); } catch (_) {}
      throw err;
    }
  }

  static async getHistory(orderId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("OrderId", sql.Int, orderId)
      .query(`
        SELECT Id, OldStatus, NewStatus, ChangedAt
        FROM OrderHistory
        WHERE OrderId=@OrderId
        ORDER BY ChangedAt ASC
      `);
    return result.recordset;
  }
}

module.exports = OrderService;
