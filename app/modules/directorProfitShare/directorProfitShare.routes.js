const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const DirectorProfitShareController = require("./directorProfitShare.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("director_profit_share_transaction"),
  DirectorProfitShareController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("director_profit_share_transaction"),
  DirectorProfitShareController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("director_profit_share_transaction"),
  DirectorProfitShareController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("director_profit_share_transaction"),
  DirectorProfitShareController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("director_profit_share_transaction"),
  DirectorProfitShareController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("director_profit_share_transaction"),
  DirectorProfitShareController.updateOneFromDB,
);

module.exports = router;
