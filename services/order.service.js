const { sql, getPool } = require("../config/db");
const OrderModel = require("../models/order.model");

class OrderService {
  static async create(userId, opts) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // ✅ 1. Validate dữ liệu
      const {
        storeId,
        paymentMethod = "COD",
        shippingAddress,
        lat,
        lng,
        items
      } = opts;

      if (!items?.length) throw new Error("Giỏ hàng trống");
      if (!shippingAddress || lat == null || lng == null)
        throw new Error("Thiếu address/lat/lng cho giao hàng");

      // ✅ 2. Tính subtotal
      const subtotal = items.reduce(
        (sum, i) => sum + i.quantity * i.price,
        0
      );

      // ✅ 3. Tính phí ship cơ bản
      const calcShippingFee = (km) => {
        if (!Number.isFinite(km) || km <= 0) return 0;
        const base = 15000;
        if (km <= 3) return base;
        return Math.min(40000, base + Math.ceil(km - 3) * 3000);
      };
      const shippingFee = calcShippingFee(2.5); // tạm 2.5km demo

      // ✅ 4. Ghi đơn hàng
      const total = subtotal + shippingFee;
      const orderId = await OrderModel.insertOrder(tx, {
        UserId: userId,
        Total: total,
        Subtotal: subtotal,
        PaymentMethod: paymentMethod,
        PaymentStatus: "unpaid",
        Status: "pending",
        FulfillmentMethod: "delivery",
        DeliveryAddress: shippingAddress,
        DeliveryLat: lat,
        DeliveryLng: lng,
        StoreId: storeId,
        ShippingFee: shippingFee
      });

      // ✅ 5. Ghi OrderItems
      for (const item of items) {
        await OrderModel.insertOrderItem(tx, {
          OrderId: orderId,
          ProductId: item.productId,
          Quantity: item.quantity,
          Price: item.price,
          Size: item.size,
          Sugar: item.options?.sugar,
          Ice: item.options?.ice,
          Topping: item.toppings?.join(", ")
        });
      }

      await tx.commit();

      return {
        ok: true,
        message: "Đặt hàng thành công",
        orderId,
        subtotal,
        shippingFee,
        total
      };
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  static async listByUser(userId) {
    const orders = await OrderModel.getOrdersByUser(userId);
    for (const o of orders) {
      o.Items = await OrderModel.getOrderItems(o.Id);
    }
    return orders;
  }
}

module.exports = OrderService;
