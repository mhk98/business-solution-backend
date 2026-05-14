const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const SalaryController = require("./salary.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("payroll"),
  applyApprovalWorkflow({ modelKey: "salary", entityLabel: "Payroll Fine" }),
  SalaryController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("payroll"), SalaryController.getAllFromDB);
router.get("/all", auth(), requireMenuPermission("payroll"), SalaryController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), requireMenuPermission("payroll"), SalaryController.getDataById);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("payroll"),
  applyApprovalWorkflow({ modelKey: "salary", entityLabel: "Payroll Fine" }),
  SalaryController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("payroll"),
  applyApprovalWorkflow({ modelKey: "salary", entityLabel: "Payroll Fine" }),
  SalaryController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("payroll"),
  approvePendingWorkflow({ modelKey: "salary", entityLabel: "Payroll Fine" }),
);
const SalaryRoutes = router;
module.exports = SalaryRoutes;
