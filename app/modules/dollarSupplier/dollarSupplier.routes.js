const auth = require("../../middlewares/auth");
const DollarSupplierController = require("./dollarSupplier.controller");
const router = require("express").Router();

router.post("/create", auth(), DollarSupplierController.insertIntoDB);
router.get("/", auth(), DollarSupplierController.getAllFromDB);
router.get("/all", auth(), DollarSupplierController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), DollarSupplierController.getDataById);
router.delete("/:id", auth(), DollarSupplierController.deleteIdFromDB);
router.put("/:id", auth(), DollarSupplierController.updateOneFromDB);

const DollarSupplierRoutes = router;
module.exports = DollarSupplierRoutes;
