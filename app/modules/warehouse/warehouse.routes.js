const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const WarehouseController = require("./warehouse.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "warehouse", entityLabel: "Warehouse" }),
  WarehouseController.insertIntoDB,
);
router.get("/", auth(), WarehouseController.getAllFromDB);
router.get("/all", auth(), WarehouseController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), WarehouseController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "warehouse", entityLabel: "Warehouse" }),
  WarehouseController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "warehouse", entityLabel: "Warehouse" }),
  WarehouseController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "warehouse", entityLabel: "Warehouse" }),
);
const WarehouseRoutes = router;
module.exports = WarehouseRoutes;
