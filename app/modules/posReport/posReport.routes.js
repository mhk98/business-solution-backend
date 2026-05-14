const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PosReportController = require("./posReport.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "posReport", entityLabel: "POS Report" }),
  PosReportController.insertIntoDB,
);
router.get("/", auth(), PosReportController.getAllFromDB);
router.get("/all", auth(), PosReportController.getAllFromDBWithoutQuery);
router.get("/", auth(), PosReportController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "posReport", entityLabel: "POS Report" }),
  PosReportController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "posReport", entityLabel: "POS Report" }),
  PosReportController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "posReport", entityLabel: "POS Report" }),
);

const PosReportRoutes = router;
module.exports = PosReportRoutes;
