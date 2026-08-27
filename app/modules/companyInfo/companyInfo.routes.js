const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const CompanyInfoController = require("./companyInfo.controller");
const router = require("express").Router();

// Company Info lives inside the Monthly Reporting Book submenu (used for
// its PDF letterhead), so it is gated by the same menu permission.
router.post(
  "/create",
  auth(),
  requireMenuPermission("monthly_reporting_book"),
  CompanyInfoController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("monthly_reporting_book"),
  CompanyInfoController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("monthly_reporting_book"),
  CompanyInfoController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("monthly_reporting_book"),
  CompanyInfoController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("monthly_reporting_book"),
  CompanyInfoController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("monthly_reporting_book"),
  CompanyInfoController.updateOneFromDB,
);

const CompanyInfoRoutes = router;
module.exports = CompanyInfoRoutes;
