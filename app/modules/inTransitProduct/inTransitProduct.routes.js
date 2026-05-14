const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const InTransitProductController = require("./inTransitProduct.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({
    modelKey: "inTransitProduct",
    entityLabel: "Intransit Product",
  }),
  InTransitProductController.insertIntoDB,
);
router.get("/", auth(), InTransitProductController.getAllFromDB);
router.get("/all", auth(), InTransitProductController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), InTransitProductController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({
    modelKey: "inTransitProduct",
    entityLabel: "Intransit Product",
  }),
  InTransitProductController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({
    modelKey: "inTransitProduct",
    entityLabel: "Intransit Product",
  }),
  InTransitProductController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({
    modelKey: "inTransitProduct",
    entityLabel: "Intransit Product",
  }),
);

const InTransitProductRoutes = router;
module.exports = InTransitProductRoutes;
