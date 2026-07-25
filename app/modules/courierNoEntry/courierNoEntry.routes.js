const auth = require("../../middlewares/auth");
const CourierNoEntryController = require("./courierNoEntry.controller");
const router = require("express").Router();

router.post("/create", auth(), CourierNoEntryController.insertIntoDB);
router.get("/", auth(), CourierNoEntryController.getAllFromDB);
router.get("/all", auth(), CourierNoEntryController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), CourierNoEntryController.getDataById);
router.delete("/:id", auth(), CourierNoEntryController.deleteIdFromDB);
router.put("/:id", auth(), CourierNoEntryController.updateOneFromDB);

module.exports = router;
