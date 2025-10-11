const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminEmployeeController = require("../../controllers/admin/admin.employee.controller");

const router = express.Router();
router.use(authenticateJWT, authorizeAdmin);

router.get("/", AdminEmployeeController.getAll);
router.get("/:id", AdminEmployeeController.getById);
router.post("/", AdminEmployeeController.create);
router.put("/:id", AdminEmployeeController.update);
router.delete("/:id", AdminEmployeeController.delete);

module.exports = router;
