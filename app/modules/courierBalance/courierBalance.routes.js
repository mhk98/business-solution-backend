const auth = require("../../middlewares/auth");
const CourierBalanceController = require("./courierBalance.controller");
const router = require("express").Router();

router.post("/create", auth(), CourierBalanceController.insertIntoDB);
router.get("/", auth(), CourierBalanceController.getAllFromDB);
router.get("/:id", auth(), CourierBalanceController.getDataById);
router.put("/:id", auth(), CourierBalanceController.updateOneFromDB);
router.delete("/:id", auth(), CourierBalanceController.deleteIdFromDB);

module.exports = router;
