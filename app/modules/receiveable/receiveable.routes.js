const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadFile } = require("../../middlewares/upload");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ReceiveableController = require("./receiveable.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({ modelKey: "receiveable", entityLabel: "Receiveable" }),
  ReceiveableController.insertIntoDB,
);
router.get("/", auth(), ReceiveableController.getAllFromDB);
router.get("/all", auth(), ReceiveableController.getAllFromDBWithoutQuery);
// router.get("/:id", ReceiveableController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({ modelKey: "receiveable", entityLabel: "Receiveable" }),
  ReceiveableController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({ modelKey: "receiveable", entityLabel: "Receiveable" }),
  ReceiveableController.updateOneFromDB,
);

router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "receiveable", entityLabel: "Receiveable" }),
);
const ReceiveableRoutes = router;
module.exports = ReceiveableRoutes;
