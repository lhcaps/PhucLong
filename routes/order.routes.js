const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const OrderController = require("../controllers/order.controller");

const router = express.Router();

router.post("/", authenticateJWT, OrderController.create);
router.get("/", authenticateJWT, OrderController.list);

module.exports = router;
