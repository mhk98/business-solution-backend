const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const PayrollRunController = require("./payrollRun.controller");

router.post("/create", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT), requireMenuPermission("payroll_management"), PayrollRunController.insertIntoDB);
router.get("/", auth(), requireMenuPermission("payroll_management"), PayrollRunController.getAllFromDB);
router.get("/:id", auth(), requireMenuPermission("payroll_management"), PayrollRunController.getDataById);
router.put("/:id", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT), requireMenuPermission("payroll_management"), PayrollRunController.updateOneFromDB);

module.exports = router;
