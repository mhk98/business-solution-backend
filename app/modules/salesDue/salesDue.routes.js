const auth = require("../../middlewares/auth");
const SalesDueController = require("./salesDue.controller");
const router = require("express").Router();

router.post("/create", auth(), SalesDueController.insertIntoDB);
router.get("/", auth(), SalesDueController.getAllFromDB);
router.get("/all", auth(), SalesDueController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), SalesDueController.getDataById);
router.post("/:id/pay", auth(), SalesDueController.addPaymentFromDB);
router.delete("/:id", auth(), SalesDueController.deleteIdFromDB);
router.put("/:id", auth(), SalesDueController.updateOneFromDB);

module.exports = router;
