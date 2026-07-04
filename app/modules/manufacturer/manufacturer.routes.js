const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ManufacturerController = require("./manufacturer.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("manufacturer"),
  applyApprovalWorkflow({
    modelKey: "manufacturer",
    entityLabel: "Manufacturer",
  }),
  ManufacturerController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("manufacturer"),
  ManufacturerController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("manufacturer"),
  ManufacturerController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("manufacturer"),
  ManufacturerController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("manufacturer"),
  applyApprovalWorkflow({
    modelKey: "manufacturer",
    entityLabel: "Manufacturer",
  }),
  ManufacturerController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("manufacturer"),
  applyApprovalWorkflow({
    modelKey: "manufacturer",
    entityLabel: "Manufacturer",
  }),
  ManufacturerController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("manufacturer"),
  approvePendingWorkflow({
    modelKey: "manufacturer",
    entityLabel: "Manufacturer",
  }),
);

const ManufacturerRoutes = router;
module.exports = ManufacturerRoutes;
