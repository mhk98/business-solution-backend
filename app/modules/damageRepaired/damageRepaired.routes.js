const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const DamageRepairedController = require("./damageRepaired.controller");

const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "damageRepaired", entityLabel: "Damage Repaired" }),
  DamageRepairedController.insertIntoDB,
);
router.get("/", auth(), DamageRepairedController.getAllFromDB);
router.get("/all", auth(), DamageRepairedController.getAllFromDBWithoutQuery);
router.get("/", auth(), DamageRepairedController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "damageRepaired", entityLabel: "Damage Repaired" }),
  DamageRepairedController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "damageRepaired", entityLabel: "Damage Repaired" }),
  DamageRepairedController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "damageRepaired", entityLabel: "Damage Repaired" }),
);

const DamageRepairedRoutes = router;
module.exports = DamageRepairedRoutes;
