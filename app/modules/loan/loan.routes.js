const auth = require("../../middlewares/auth");
const LoanController = require("./loan.controller");
const router = require("express").Router();

router.post("/create", auth(), LoanController.insertIntoDB);
router.get("/", auth(), LoanController.getAllFromDB);
router.get("/all", auth(), LoanController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), LoanController.getDataById);
router.delete("/:id", auth(), LoanController.deleteIdFromDB);
router.put("/:id", auth(), LoanController.updateOneFromDB);

module.exports = router;
