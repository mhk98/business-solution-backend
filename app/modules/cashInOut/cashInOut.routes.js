const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadFile } = require("../../middlewares/upload");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const CashInOutController = require("./cashInOut.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(),
  requireMenuPermission("book"),
  applyApprovalWorkflow({ modelKey: "cashInOut", entityLabel: "Cash In Out" }),
  CashInOutController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("book"),
  CashInOutController.getAllFromDB,
);
router.get(
  "/all",
  // auth(), requireMenuPermission("book"),
  CashInOutController.getAllFromDBWithoutQuery,
);
router.get(
  "/loans",
  auth(),
  requireMenuPermission("loan"),
  CashInOutController.getLoanSummaries,
);
router.get(
  "/loans/:lender",
  auth(),
  requireMenuPermission("loan"),
  CashInOutController.getLoanHistory,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("book"),
  CashInOutController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("book"),
  applyApprovalWorkflow({ modelKey: "cashInOut", entityLabel: "Cash In Out" }),
  CashInOutController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(),
  requireMenuPermission("book"),
  applyApprovalWorkflow({ modelKey: "cashInOut", entityLabel: "Cash In Out" }),
  CashInOutController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("book"),
  approvePendingWorkflow({ modelKey: "cashInOut", entityLabel: "Cash In Out" }),
);
const CashInOutRoutes = router;
module.exports = CashInOutRoutes;
