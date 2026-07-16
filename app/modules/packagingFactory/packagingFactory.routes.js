const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const PackagingFactoryController = require("./packagingFactory.controller");
const router = require("express").Router();

router.post("/create", auth(), requireMenuPermission("packaging_factory"), PackagingFactoryController.insertIntoDB);
router.get("/", auth(), requireMenuPermission("packaging_factory"), PackagingFactoryController.getAllFromDB);
router.delete("/:id", auth(), requireMenuPermission("packaging_factory"), PackagingFactoryController.deleteIdFromDB);
router.put("/:id", auth(), requireMenuPermission("packaging_factory"), PackagingFactoryController.updateOneFromDB);

module.exports = router;
