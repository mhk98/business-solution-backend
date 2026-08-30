const auth = require("../../middlewares/auth");
const CourierProductStockController = require("./courierProductStock.controller");
const router = require("express").Router();

router.post("/create", auth(), CourierProductStockController.insertIntoDB);
router.get("/", auth(), CourierProductStockController.getAllFromDB);
router.get(
  "/all",
  auth(),
  CourierProductStockController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), CourierProductStockController.getDataById);
router.delete("/:id", auth(), CourierProductStockController.deleteIdFromDB);
router.put("/:id", auth(), CourierProductStockController.updateOneFromDB);

module.exports = router;
