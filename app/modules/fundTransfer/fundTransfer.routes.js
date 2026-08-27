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
const FundTransferController = require("./fundTransfer.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(),
  requireMenuPermission("fund_transfer"),
  applyApprovalWorkflow({
    modelKey: "fundTransfer",
    entityLabel: "Fund Transfer",
  }),
  FundTransferController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("fund_transfer"),
  FundTransferController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("fund_transfer"),
  FundTransferController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("fund_transfer"),
  FundTransferController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("fund_transfer"),
  applyApprovalWorkflow({
    modelKey: "fundTransfer",
    entityLabel: "Fund Transfer",
  }),
  FundTransferController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(),
  requireMenuPermission("fund_transfer"),
  applyApprovalWorkflow({
    modelKey: "fundTransfer",
    entityLabel: "Fund Transfer",
  }),
  FundTransferController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("fund_transfer"),
  approvePendingWorkflow({
    modelKey: "fundTransfer",
    entityLabel: "Fund Transfer",
  }),
);

module.exports = router;
