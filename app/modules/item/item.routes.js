const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ItemController = require("./item.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "item", entityLabel: "Item" }),
  ItemController.insertIntoDB,
);
router.get("/", auth(), ItemController.getAllFromDB);
router.get("/all", auth(), ItemController.getAllFromDBWithoutQuery);
router.get("/", auth(), ItemController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "item", entityLabel: "Item" }),
  ItemController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "item", entityLabel: "Item" }),
  ItemController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "item", entityLabel: "Item" }),
);

const ItemRoutes = router;
module.exports = ItemRoutes;
