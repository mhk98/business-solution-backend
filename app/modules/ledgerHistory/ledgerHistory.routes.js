const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const LedgerHistoryController = require("./ledgerHistory.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({
    modelKey: "ledgerHistory",
    entityLabel: "Ledger History",
  }),
  LedgerHistoryController.insertIntoDB,
);
router.get(
  "/",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  LedgerHistoryController.getAllFromDB,
);
router.get(
  "/all",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  LedgerHistoryController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  LedgerHistoryController.getDataById,
);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({
    modelKey: "ledgerHistory",
    entityLabel: "Ledger History",
  }),
  LedgerHistoryController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({
    modelKey: "ledgerHistory",
    entityLabel: "Ledger History",
  }),
  LedgerHistoryController.updateOneFromDB,
);

router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({
    modelKey: "ledgerHistory",
    entityLabel: "Ledger History",
  }),
);

const LedgerHistoryRoutes = router;
module.exports = LedgerHistoryRoutes;
