const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const OwnerController = require("./owner.controller");
const router = require("express").Router();
const ownerPermission = requireAnyPermission(["owner", "owner_transaction"]);

router.post(
  "/create",
  auth(),
  ownerPermission,
  OwnerController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  ownerPermission,
  OwnerController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  ownerPermission,
  OwnerController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  ownerPermission,
  OwnerController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  ownerPermission,
  OwnerController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  ownerPermission,
  OwnerController.updateOneFromDB,
);

module.exports = router;
