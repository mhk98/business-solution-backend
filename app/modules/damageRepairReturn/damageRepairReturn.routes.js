const auth = require("../../middlewares/auth");
const DamageRepairReturnController = require("./damageRepairReturn.controller");
const router = require("express").Router();

router.post("/create", auth(), DamageRepairReturnController.insertIntoDB);
router.get("/", auth(), DamageRepairReturnController.getAllFromDB);
router.delete("/:id", auth(), DamageRepairReturnController.deleteIdFromDB);

module.exports = router;
