const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const AssetsRequisitionController = require("./assetsRequisition.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsRequisition", entityLabel: "Assets Requisition" }),
  AssetsRequisitionController.insertIntoDB,
);
router.get("/", auth(), AssetsRequisitionController.getAllFromDB);
router.get("/all", auth(), AssetsRequisitionController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), AssetsRequisitionController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsRequisition", entityLabel: "Assets Requisition" }),
  AssetsRequisitionController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsRequisition", entityLabel: "Assets Requisition" }),
  AssetsRequisitionController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "assetsRequisition", entityLabel: "Assets Requisition" }),
);

const AssetsRequisitionRoutes = router;
module.exports = AssetsRequisitionRoutes;
