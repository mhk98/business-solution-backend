const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const OwnerTransactionController = require("./ownerTransaction.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerTransactionController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerTransactionController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerTransactionController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerTransactionController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerTransactionController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("owner_transaction"),
  OwnerTransactionController.updateOneFromDB,
);

module.exports = router;
