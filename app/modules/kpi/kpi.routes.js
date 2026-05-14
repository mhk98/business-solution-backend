const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const KPIController = require("./kpi.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("employee_kpi"),
  applyApprovalWorkflow({ modelKey: "kpi", entityLabel: "KPI" }),
  KPIController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("employee_kpi"), KPIController.getAllFromDB);
router.get(
  "/all",
  auth(),
  requireMenuPermission("employee_kpi"),
  KPIController.getAllFromDBWithoutQuery,
);
router.get(
  "/settings",
  auth(),
  requireMenuPermission("employee_kpi"),
  KPIController.getKPISettings,
);
router.get(
  "/performance-graph",
  auth(),
  requireMenuPermission("employee_kpi"),
  KPIController.getPerformanceGraph,
);
router.get(
  "/employee-options",
  auth(),
  requireMenuPermission("employee_kpi"),
  KPIController.getEmployeeOptions,
);
router.put(
  "/settings",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("employee_kpi"),
  KPIController.updateKPISettings,
);
router.get("/:id", auth(), requireMenuPermission("employee_kpi"), KPIController.getDataById);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("employee_kpi"),
  applyApprovalWorkflow({ modelKey: "kpi", entityLabel: "KPI" }),
  KPIController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("employee_kpi"),
  applyApprovalWorkflow({ modelKey: "kpi", entityLabel: "KPI" }),
  KPIController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("employee_kpi"),
  approvePendingWorkflow({ modelKey: "kpi", entityLabel: "KPI" }),
);

const KPIRoutes = router;
module.exports = KPIRoutes;
