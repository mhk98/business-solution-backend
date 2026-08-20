const auth = require("../../middlewares/auth");
const DamageReturnController = require("./damageReturn.controller");
const router = require("express").Router();

router.post("/create", auth(), DamageReturnController.insertIntoDB);
router.get("/", auth(), DamageReturnController.getAllFromDB);
router.delete("/:id", auth(), DamageReturnController.deleteIdFromDB);

module.exports = router;
