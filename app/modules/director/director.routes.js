const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const DirectorController = require("./director.controller");
const router = require("express").Router();
const directorPermission = requireAnyPermission([
  "director_profit_share",
  "director_profit_share_transaction",
]);

router.post("/create", auth(), directorPermission, DirectorController.insertIntoDB);
router.get("/", auth(), directorPermission, DirectorController.getAllFromDB);
router.get(
  "/all",
  auth(),
  directorPermission,
  DirectorController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), directorPermission, DirectorController.getDataById);
router.delete(
  "/:id",
  auth(),
  directorPermission,
  DirectorController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  directorPermission,
  DirectorController.updateOneFromDB,
);

module.exports = router;
