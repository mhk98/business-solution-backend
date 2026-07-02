const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const OwnerController = require("./owner.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerController.updateOneFromDB,
);

module.exports = router;
