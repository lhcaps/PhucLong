const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminOrderController = require("../../controllers/admin/admin.order.controller");

const router = express.Router();
router.use(authenticateJWT, authorizeAdmin);

router.get("/", AdminOrderController.getAll);
router.get("/:id", AdminOrderController.getById);
router.put("/:id/status", AdminOrderController.updateStatus);
router.delete("/:id", AdminOrderController.delete);

module.exports = router;
