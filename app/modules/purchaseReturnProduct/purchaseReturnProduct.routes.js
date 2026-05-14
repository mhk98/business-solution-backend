const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PurchaseReturnProductController = require("./purchaseReturnProduct.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  applyApprovalWorkflow({
    modelKey: "purchaseReturnProduct",
    entityLabel: "Purchase Return Product",
  }),
  PurchaseReturnProductController.insertIntoDB,
);
router.get("/", auth(), PurchaseReturnProductController.getAllFromDB);
router.get(
  "/all",
  auth(),
  PurchaseReturnProductController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), PurchaseReturnProductController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  applyApprovalWorkflow({
    modelKey: "purchaseReturnProduct",
    entityLabel: "Purchase Return Product",
  }),
  PurchaseReturnProductController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  applyApprovalWorkflow({
    modelKey: "purchaseReturnProduct",
    entityLabel: "Purchase Return Product",
  }),
  PurchaseReturnProductController.updateOneFromDB,
);

router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({
    modelKey: "purchaseReturnProduct",
    entityLabel: "Purchase Return Product",
  }),
);

const PurchaseReturnProductRoutes = router;
module.exports = PurchaseReturnProductRoutes;
