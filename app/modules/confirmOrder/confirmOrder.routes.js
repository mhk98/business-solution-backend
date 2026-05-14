const ConfirmOrderController = require("./confirmOrder.controller");
const router = require("express").Router();

router.get("/trending-products", ConfirmOrderController.getTrendingProducts);

const ConfirmOrderRoutes = router;
module.exports = ConfirmOrderRoutes;
