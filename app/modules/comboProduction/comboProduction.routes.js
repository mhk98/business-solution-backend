const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ComboProductionController = require("./comboProduction.controller");
const router = require("express").Router();

router.get("/combos", auth(), ComboProductionController.getCombos);
router.post("/create", auth(), ComboProductionController.insertIntoDB);
router.get("/", auth(), ComboProductionController.getAllFromDB);
// Admin-only: deleting puts the stock back (Item/Factory Stock up, Stock
// Product down), and the Mixer approval flow would overwrite the recipe
// stored in the note.
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  ComboProductionController.deleteIdFromDB,
);

const ComboProductionRoutes = router;
module.exports = ComboProductionRoutes;
