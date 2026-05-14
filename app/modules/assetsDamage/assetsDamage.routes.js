const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const AssetsDamageController = require("./assetsDamage.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsDamage", entityLabel: "Assets Damage" }),
  AssetsDamageController.insertIntoDB,
);
router.get("/", auth(), AssetsDamageController.getAllFromDB);
router.get("/all", auth(), AssetsDamageController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), AssetsDamageController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsDamage", entityLabel: "Assets Damage" }),
  AssetsDamageController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsDamage", entityLabel: "Assets Damage" }),
  AssetsDamageController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "assetsDamage", entityLabel: "Assets Damage" }),
);

const AssetsDamageRoutes = router;
module.exports = AssetsDamageRoutes;
