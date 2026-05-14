const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const MixerController = require("./mixer.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "mixer", entityLabel: "Mixer" }),
  MixerController.insertIntoDB,
);
router.get("/", auth(), MixerController.getAllFromDB);
router.get("/all", auth(), MixerController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), MixerController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "mixer", entityLabel: "Mixer" }),
  MixerController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "mixer", entityLabel: "Mixer" }),
  MixerController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "mixer", entityLabel: "Mixer" }),
);

const MixerRoutes = router;
module.exports = MixerRoutes;
