const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PackagingItemController = require("./packagingItem.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({
    modelKey: "packagingItem",
    entityLabel: "Packaging Item",
  }),
  PackagingItemController.insertIntoDB,
);
router.get("/", auth(), PackagingItemController.getAllFromDB);
router.get("/all", auth(), PackagingItemController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), PackagingItemController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({
    modelKey: "packagingItem",
    entityLabel: "Packaging Item",
  }),
  PackagingItemController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({
    modelKey: "packagingItem",
    entityLabel: "Packaging Item",
  }),
  PackagingItemController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({
    modelKey: "packagingItem",
    entityLabel: "Packaging Item",
  }),
);

const PackagingItemRoutes = router;
module.exports = PackagingItemRoutes;
