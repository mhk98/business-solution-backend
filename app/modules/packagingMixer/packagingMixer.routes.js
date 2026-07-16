const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const PackagingMixerController = require("./packagingMixer.controller");
const router = require("express").Router();

router.post("/create", auth(), requireMenuPermission("packaging_mixer"), PackagingMixerController.insertIntoDB);
router.get("/", auth(), requireMenuPermission("packaging_mixer"), PackagingMixerController.getAllFromDB);
router.delete("/:id", auth(), requireMenuPermission("packaging_mixer"), PackagingMixerController.deleteIdFromDB);
router.put("/:id", auth(), requireMenuPermission("packaging_mixer"), PackagingMixerController.updateOneFromDB);

module.exports = router;
