const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const AdsCampaignKPIController = require("./adsCampaignKPI.controller");
const router = require("express").Router();

const permissions = ["marketing", "ads_campaign_kpi"];

router.post(
  "/create",
  auth(),
  requireAnyPermission(permissions),
  applyApprovalWorkflow({
    modelKey: "adsCampaignKPI",
    entityLabel: "Ads Campaign KPI",
  }),
  AdsCampaignKPIController.insertIntoDB,
);
router.get(
  "/",
  // auth(),
  // requireAnyPermission(permissions),
  AdsCampaignKPIController.getAllFromDB,
);
router.get(
  "/summary",
  auth(),
  requireAnyPermission(permissions),
  AdsCampaignKPIController.getSummary,
);
router.get(
  "/performance-graph",
  auth(),
  requireAnyPermission(permissions),
  AdsCampaignKPIController.getPerformanceGraph,
);
router.get(
  "/ads-accounts",
  auth(),
  requireAnyPermission(permissions),
  AdsCampaignKPIController.getAdsAccounts,
);
router.post(
  "/ads-accounts/create",
  auth(),
  requireAnyPermission(permissions),
  AdsCampaignKPIController.createAdsAccount,
);
router.get(
  "/all",
  auth(),
  requireAnyPermission(permissions),
  AdsCampaignKPIController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(permissions),
  AdsCampaignKPIController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission(permissions),
  applyApprovalWorkflow({
    modelKey: "adsCampaignKPI",
    entityLabel: "Ads Campaign KPI",
  }),
  AdsCampaignKPIController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission(permissions),
  applyApprovalWorkflow({
    modelKey: "adsCampaignKPI",
    entityLabel: "Ads Campaign KPI",
  }),
  AdsCampaignKPIController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(permissions),
  approvePendingWorkflow({
    modelKey: "adsCampaignKPI",
    entityLabel: "Ads Campaign KPI",
  }),
);

module.exports = router;
