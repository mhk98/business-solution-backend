const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PosReportController = require("./posReport.controller");
const router = require("express").Router();

const POS_REPORT_MANAGE_ROLES = [
  ENUM_USER_ROLE.SUPER_ADMIN,
  ENUM_USER_ROLE.ADMIN,
  ENUM_USER_ROLE.MARKETER,
  ENUM_USER_ROLE.LEADER,
  ENUM_USER_ROLE.LEADER_CS,
  ENUM_USER_ROLE.LEADER_LOGISTICS,
  ENUM_USER_ROLE.INVENTOR,
  ENUM_USER_ROLE.HR,
  ENUM_USER_ROLE.LOGISTICS,
  ENUM_USER_ROLE.UP,
  ENUM_USER_ROLE.CS,
  ENUM_USER_ROLE.STAFF,
  ENUM_USER_ROLE.EMPLOYEE,
  ENUM_USER_ROLE.USER,
];

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
  auth(...POS_REPORT_MANAGE_ROLES),
  applyApprovalWorkflow({ modelKey: "posReport", entityLabel: "POS Report" }),
  PosReportController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(...POS_REPORT_MANAGE_ROLES),
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
