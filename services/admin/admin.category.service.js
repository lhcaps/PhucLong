// src/services/admin/admin.category.service.js
const CategoryModel = require("../../models/category.model");

class AdminCategoryService {
  // 🔹 Lấy tất cả danh mục
  static async getAll() {
    return await CategoryModel.getAll();
  }

  // 🔹 Lấy danh mục theo Id
  static async getById(id) {
    const category = await CategoryModel.getById(id);
    if (!category) throw new Error("Không tìm thấy danh mục");
    return category;
  }

  // 🔹 Tạo danh mục mới
  static async create(name) {
    if (!name || !name.trim()) throw new Error("Tên danh mục không được để trống");
    const exists = await CategoryModel.getAll();
    const dup = exists.find((c) => c.Name.toLowerCase() === name.trim().toLowerCase());
    if (dup) throw new Error("Danh mục đã tồn tại");

    const category = await CategoryModel.create(name.trim());
    return { message: "✅ Tạo danh mục thành công", category };
  }

  // 🔹 Cập nhật danh mục
  static async update(id, name) {
    if (!name || !name.trim()) throw new Error("Tên danh mục không được để trống");
    const existing = await CategoryModel.getById(id);
    if (!existing) throw new Error("Không tìm thấy danh mục để cập nhật");

    const updated = await CategoryModel.update(id, name.trim());
    return { message: "✅ Cập nhật thành công", updated };
  }

  // 🔹 Xóa danh mục
  static async delete(id) {
    const found = await CategoryModel.getById(id);
    if (!found) throw new Error("Không tìm thấy danh mục để xóa");

    await CategoryModel.delete(id);
    return { message: "✅ Đã xóa danh mục" };
  }
}

module.exports = AdminCategoryService;
