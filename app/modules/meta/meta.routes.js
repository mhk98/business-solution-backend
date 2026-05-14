const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const MetaController = require("./meta.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  applyApprovalWorkflow({ modelKey: "meta", entityLabel: "Meta" }),
  MetaController.insertIntoDB,
);
router.get("/", auth(), MetaController.getAllFromDB);
router.get("/all", auth(), MetaController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), MetaController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  applyApprovalWorkflow({ modelKey: "meta", entityLabel: "Meta" }),
  MetaController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  applyApprovalWorkflow({ modelKey: "meta", entityLabel: "Meta" }),
  MetaController.updateOneFromDB,
);

router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "meta", entityLabel: "Meta" }),
);
const MetaRoutes = router;
module.exports = MetaRoutes;
