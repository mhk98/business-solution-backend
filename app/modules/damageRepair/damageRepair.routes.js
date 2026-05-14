const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const DamageRepairController = require("./damageRepair.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "damageRepair", entityLabel: "Damage Repairing" }),
  DamageRepairController.insertIntoDB,
);
router.get("/", auth(), DamageRepairController.getAllFromDB);
router.get("/all", auth(), DamageRepairController.getAllFromDBWithoutQuery);
router.get("/", auth(), DamageRepairController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "damageRepair", entityLabel: "Damage Repairing" }),
  DamageRepairController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "damageRepair", entityLabel: "Damage Repairing" }),
  DamageRepairController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "damageRepair", entityLabel: "Damage Repairing" }),
);

const DamageRepairRoutes = router;
module.exports = DamageRepairRoutes;
