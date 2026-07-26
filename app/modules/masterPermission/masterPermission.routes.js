const router = require("express").Router();
const auth = require("../../middlewares/auth");
const MasterPermissionController = require("./masterPermission.controller");

router.get("/self", auth(), MasterPermissionController.getSelfPermission);
router.get("/", auth(), MasterPermissionController.getAllFromDB);
router.post("/", auth(), MasterPermissionController.insertIntoDB);
router.delete("/:id", auth(), MasterPermissionController.deleteFromDB);

module.exports = router;
