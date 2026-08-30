const auth = require("../../middlewares/auth");
const SalaryAdvanceController = require("./salaryAdvance.controller");
const router = require("express").Router();

router.post("/create", auth(), SalaryAdvanceController.insertIntoDB);
router.get("/", auth(), SalaryAdvanceController.getAllFromDB);
router.get("/all", auth(), SalaryAdvanceController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), SalaryAdvanceController.getDataById);
router.post("/:id/pay", auth(), SalaryAdvanceController.addPaymentFromDB);
router.delete("/:id", auth(), SalaryAdvanceController.deleteIdFromDB);
router.put("/:id", auth(), SalaryAdvanceController.updateOneFromDB);

module.exports = router;
