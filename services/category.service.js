// src/services/category.service.js
const CategoryModel = require("../models/category.model");

class CategoryService {
  static async getAll() {
    return await CategoryModel.getAll();
  }

  static async getById(id) {
    const category = await CategoryModel.getById(id);
    if (!category) throw new Error("Không tìm thấy danh mục");
    return category;
  }

  static async create(name) {
    if (!name?.trim()) throw new Error("Tên danh mục không được để trống");
    return await CategoryModel.create(name.trim());
  }

  static async update(id, name) {
    if (!name?.trim()) throw new Error("Tên danh mục không được để trống");
    const updated = await CategoryModel.update(id, name.trim());
    if (!updated) throw new Error("Không tìm thấy danh mục để cập nhật");
    return updated;
  }

  static async delete(id) {
    const found = await CategoryModel.getById(id);
    if (!found) throw new Error("Danh mục không tồn tại");
    await CategoryModel.delete(id);
    return { message: "✅ Đã xóa danh mục" };
  }
}

module.exports = CategoryService;
