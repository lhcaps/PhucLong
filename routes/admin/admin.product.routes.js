const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminProductController = require("../../controllers/admin/admin.product.controller");

const router = express.Router();
router.use(authenticateJWT, authorizeAdmin);

router.get("/", AdminProductController.getAll);
router.get("/:id", AdminProductController.getById);
router.post("/", AdminProductController.create);
router.put("/:id", AdminProductController.update);
router.delete("/:id", AdminProductController.delete);

module.exports = router;
