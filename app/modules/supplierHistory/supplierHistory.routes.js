const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const SupplierHistoryController = require("./supplierHistory.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  applyApprovalWorkflow({ modelKey: "supplierHistory", entityLabel: "Supplier History" }),
  SupplierHistoryController.insertIntoDB,
);
router.get("/", auth(), SupplierHistoryController.getAllFromDB);
router.get("/all", auth(), SupplierHistoryController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), SupplierHistoryController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  applyApprovalWorkflow({ modelKey: "supplierHistory", entityLabel: "Supplier History" }),
  SupplierHistoryController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  applyApprovalWorkflow({ modelKey: "supplierHistory", entityLabel: "Supplier History" }),
  SupplierHistoryController.updateOneFromDB,
);

router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "supplierHistory", entityLabel: "Supplier History" }),
);

const SupplierHistoryRoutes = router;
module.exports = SupplierHistoryRoutes;
