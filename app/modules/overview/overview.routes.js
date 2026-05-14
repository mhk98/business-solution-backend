// app/modules/overview/overview.routes.js

const router = require("express").Router();
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const OverviewController = require("./overview.controller");

// GET /api/v1/overview/summary?from=2026-01-01&to=2026-01-13
router.get(
  "/summary",
  auth(),
  requireMenuPermission("overview"),
  OverviewController.getOverviewSummaryFromDB,
);

const OverviewRoutes = router;
module.exports = OverviewRoutes;
