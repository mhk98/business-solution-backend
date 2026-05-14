const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const TeamController = require("./team.controller");

router.post(
  "/create",
  auth(),
  requireMenuPermission("department_designation"),
  TeamController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("department_designation"),
  TeamController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("department_designation"),
  TeamController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("department_designation"),
  TeamController.getDataById,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("department_designation"),
  TeamController.updateOneFromDB,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("department_designation"),
  TeamController.deleteIdFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("department_designation"),
  TeamController.approveOneFromDB,
);

module.exports = router;
