const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadFile } = require("../../middlewares/upload");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ReceivedProductController = require("./receivedProduct.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(),
  applyApprovalWorkflow({ modelKey: "receivedProduct", entityLabel: "Received Product" }),
  ReceivedProductController.insertIntoDB,
);
router.get("/", auth(), ReceivedProductController.getAllFromDB);
router.get("/all", auth(), ReceivedProductController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), ReceivedProductController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "receivedProduct", entityLabel: "Received Product" }),
  ReceivedProductController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(),
  applyApprovalWorkflow({ modelKey: "receivedProduct", entityLabel: "Received Product" }),
  ReceivedProductController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "receivedProduct", entityLabel: "Received Product" }),
);

const ReceivedProductRoutes = router;
module.exports = ReceivedProductRoutes;
