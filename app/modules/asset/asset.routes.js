const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const { MENU_PERMISSIONS } = require("../../enums/menuPermissions");
const AssetController = require("./asset.controller");
const router = require("express").Router();

const assetPermission = requireAnyPermission([
  MENU_PERMISSIONS.ASSETS,
  MENU_PERMISSIONS.ASSET,
]);

router.post("/create", auth(), assetPermission, AssetController.insertIntoDB);
router.get("/", auth(), assetPermission, AssetController.getAllFromDB);
router.get(
  "/all",
  auth(),
  assetPermission,
  AssetController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), assetPermission, AssetController.getDataById);
router.delete("/:id", auth(), assetPermission, AssetController.deleteIdFromDB);
router.put("/:id", auth(), assetPermission, AssetController.updateOneFromDB);

const AssetRoutes = router;
module.exports = AssetRoutes;
