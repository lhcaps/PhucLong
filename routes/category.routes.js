// src/routes/category.routes.js
const express = require("express");
const CategoryController = require("../controllers/category.controller");
const router = express.Router();

// Public - xem danh mục
router.get("/", CategoryController.getAll);
router.get("/:id", CategoryController.getById);

module.exports = router;
