const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const AssetsSaleController = require("./assetsSale.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsSale", entityLabel: "Assets Sale" }),
  AssetsSaleController.insertIntoDB,
);
router.get("/", auth(), AssetsSaleController.getAllFromDB);
router.get("/all", auth(), AssetsSaleController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), AssetsSaleController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsSale", entityLabel: "Assets Sale" }),
  AssetsSaleController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsSale", entityLabel: "Assets Sale" }),
  AssetsSaleController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "assetsSale", entityLabel: "Assets Sale" }),
);

const AssetsSaleRoutes = router;
module.exports = AssetsSaleRoutes;
