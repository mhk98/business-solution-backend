const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const MonthlyReportingBookController = require("./monthlyReportingBook.controller");
const router = require("express").Router();

router.get(
  "/summary",
  auth(),
  requireMenuPermission("monthly_reporting_book"),
  MonthlyReportingBookController.getMonthlySummary,
);
router.get(
  "/transactions",
  auth(),
  requireMenuPermission("monthly_reporting_book"),
  MonthlyReportingBookController.getMonthlyTransactions,
);
router.get(
  "/book-statement",
  auth(),
  requireMenuPermission("monthly_reporting_book"),
  MonthlyReportingBookController.getBookStatement,
);

const MonthlyReportingBookRoutes = router;
module.exports = MonthlyReportingBookRoutes;
