const router = require("express").Router();
const { indexRoutes } = require("../constants/routes");
const authRoutes = require("./authRoutes");
const cropRoutes = require("./cropRoutes");
const employeeRoutes = require("./employeeRoutes");
const seedCompanyRoutes = require("./seedCompanyRoutes");
const subOrganizerRoutes = require("./subOrganizerRoutes");
const villageRoutes = require("./villageRoutes");
const warehouseRoutes = require("./warehouseRoutes");

router.use(indexRoutes.auth, authRoutes);
router.use(indexRoutes.crop, cropRoutes);
router.use(indexRoutes.seedCompany, seedCompanyRoutes);

module.exports = router;
