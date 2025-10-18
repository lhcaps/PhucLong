// src/routes/admin/admin.category.routes.js
const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminCategoryController = require("../../controllers/admin/admin.category.controller");
const router = express.Router();

router.use(authenticateJWT, authorizeAdmin);

router.get("/", AdminCategoryController.getAll);
router.get("/:id", AdminCategoryController.getById);
router.post("/", AdminCategoryController.create);
router.put("/:id", AdminCategoryController.update);
router.delete("/:id", AdminCategoryController.delete);

module.exports = router;
