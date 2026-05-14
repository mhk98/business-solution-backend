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
  requireMenuPermission("manufacture_menu"),
  applyApprovalWorkflow({ modelKey: "manufacture", entityLabel: "Manufacture" }),
  ManufactureController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("manufacture_menu"), ManufactureController.getAllFromDB);
router.get(
  "/all",
  auth(),
  requireMenuPermission("manufacture_menu"),
  ManufactureController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), requireMenuPermission("manufacture_menu"), ManufactureController.getDataById);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("manufacture_menu"),
  applyApprovalWorkflow({ modelKey: "manufacture", entityLabel: "Manufacture" }),
  ManufactureController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("manufacture_menu"),
  applyApprovalWorkflow({ modelKey: "manufacture", entityLabel: "Manufacture" }),
  ManufactureController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("manufacture_menu"),
  approvePendingWorkflow({ modelKey: "manufacture", entityLabel: "Manufacture" }),
);

const ManufactureRoutes = router;
module.exports = ManufactureRoutes;
