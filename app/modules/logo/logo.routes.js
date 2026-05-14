const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const { uploadSingle, uploadFile } = require("../../middlewares/upload");
const LogoController = require("./logo.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("logo"),
  LogoController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("logo"), LogoController.getAllFromDB);
router.get("/all", auth(), requireMenuPermission("logo"), LogoController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), requireMenuPermission("logo"), LogoController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("logo"),
  LogoController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("logo"),
  LogoController.updateOneFromDB,
);
const LogoRoutes = router;
module.exports = LogoRoutes;
