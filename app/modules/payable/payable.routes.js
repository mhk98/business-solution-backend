const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadFile } = require("../../middlewares/upload");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PayableController = require("./payable.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({ modelKey: "payable", entityLabel: "Payable" }),
  PayableController.insertIntoDB,
);
router.get("/", auth(), PayableController.getAllFromDB);
router.get("/all", auth(), PayableController.getAllFromDBWithoutQuery);
// router.get("/:id", PayableController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({ modelKey: "payable", entityLabel: "Payable" }),
  PayableController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({ modelKey: "payable", entityLabel: "Payable" }),
  PayableController.updateOneFromDB,
);

router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "payable", entityLabel: "Payable" }),
);
const PayableRoutes = router;
module.exports = PayableRoutes;
