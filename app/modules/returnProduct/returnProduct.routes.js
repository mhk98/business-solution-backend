const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ReturnProductController = require("./returnProduct.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({
    modelKey: "returnProduct",
    entityLabel: "Sales Return",
  }),
  ReturnProductController.insertIntoDB,
);
router.get("/", auth(), ReturnProductController.getAllFromDB);
router.get("/all", auth(), ReturnProductController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), ReturnProductController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({
    modelKey: "returnProduct",
    entityLabel: "Sales Return",
  }),
  ReturnProductController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({
    modelKey: "returnProduct",
    entityLabel: "Sales Return",
  }),
  ReturnProductController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({
    modelKey: "returnProduct",
    entityLabel: "Sales Return",
  }),
);

const ReturnProductRoutes = router;
module.exports = ReturnProductRoutes;
