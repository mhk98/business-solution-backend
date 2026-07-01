const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ItemRequisitionController = require("./itemRequision.controller");
const { uploadFile } = require("../../middlewares/upload");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(),
  applyApprovalWorkflow({
    modelKey: "itemRequisition",
    entityLabel: "Item Requisition",
  }),
  ItemRequisitionController.insertIntoDB,
);
router.get("/", auth(), ItemRequisitionController.getAllFromDB);
router.get("/all", auth(), ItemRequisitionController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), ItemRequisitionController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({
    modelKey: "itemRequisition",
    entityLabel: "Item Requisition",
  }),
  ItemRequisitionController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(),
  applyApprovalWorkflow({
    modelKey: "itemRequisition",
    entityLabel: "Item Requisition",
    updatePrivilegedRoles: [
      ENUM_USER_ROLE.SUPER_ADMIN,
      ENUM_USER_ROLE.ADMIN,
      ENUM_USER_ROLE.ACCOUNTANT,
      ENUM_USER_ROLE.INVENTOR,
    ],
  }),
  ItemRequisitionController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  uploadFile,
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({
    modelKey: "itemRequisition",
    entityLabel: "Item Requisition",
  }),
);

const ItemRequisitionRoutes = router;
module.exports = ItemRequisitionRoutes;
