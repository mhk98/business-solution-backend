const auth = require("../../middlewares/auth");
const StockMovementController = require("./stockMovement.controller");
const router = require("express").Router();

router.get("/", auth(), StockMovementController.getAllFromDB);
router.get("/:id", auth(), StockMovementController.getDataById);

const StockMovementRoutes = router;
module.exports = StockMovementRoutes;
