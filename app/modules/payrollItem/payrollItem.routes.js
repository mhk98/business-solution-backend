const router = require("express").Router();
const auth = require("../../middlewares/auth");
const { requireAnyPermission } = require("../../middlewares/requireMenuPermission");
const PayrollItemController = require("./payrollItem.controller");

router.get("/", auth(), requireAnyPermission(["payroll_management", "payslip"]), PayrollItemController.getAllFromDB);
router.get("/all", auth(), requireAnyPermission(["payroll_management", "payslip"]), PayrollItemController.getAllFromDBWithoutQuery);
router.get("/me", auth(), requireAnyPermission(["employee_profile", "payslip", "payroll_management"]), PayrollItemController.getMyPayrollItems);
router.get("/:id", auth(), requireAnyPermission(["payroll_management", "payslip"]), PayrollItemController.getDataById);

module.exports = router;
