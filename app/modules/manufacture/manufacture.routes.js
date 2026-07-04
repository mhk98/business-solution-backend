const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ManufactureController = require("./manufacture.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("item_purchase"),
  applyApprovalWorkflow({ modelKey: "manufacture", entityLabel: "Manufacture" }),
  ManufactureController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("item_purchase"), ManufactureController.getAllFromDB);
router.get(
  "/all",
  auth(),
  requireMenuPermission("item_purchase"),
  ManufactureController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), requireMenuPermission("item_purchase"), ManufactureController.getDataById);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("item_purchase"),
  applyApprovalWorkflow({ modelKey: "manufacture", entityLabel: "Manufacture" }),
  ManufactureController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("item_purchase"),
  applyApprovalWorkflow({ modelKey: "manufacture", entityLabel: "Manufacture" }),
  ManufactureController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("item_purchase"),
  approvePendingWorkflow({ modelKey: "manufacture", entityLabel: "Manufacture" }),
);

const ManufactureRoutes = router;
module.exports = ManufactureRoutes;
