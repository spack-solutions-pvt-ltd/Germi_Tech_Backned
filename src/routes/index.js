const router = require("express").Router();
const { indexRoutes } = require("../constants/routes");
const { authenticate } = require("../middleWare/auth.middleware");
const authRoutes = require("./authRoutes");
const cropRoutes = require("./cropRoutes");
const employeeRoutes = require("./employeeRoutes");
const seedCompanyRoutes = require("./seedCompanyRoutes");
const subOrganizerRoutes = require("./subOrganizerRoutes");
const villageRoutes = require("./villageRoutes");
const warehouseRoutes = require("./warehouseRoutes");
const companyCropRoutes = require("./companyCropRoutes");
const logisticPartnerRoutes = require("./logisticPartnerRoutes");
const roleRoutes = require("./roleRoutes");
const labourGroupRoutes = require("./labourGroupRoutes");
const notificationRoutes = require("./notificationRoutes");
const taskTypeRoutes = require("./taskTypeRoutes");
const tasksRoutes = require("./taskRoutes");
const allotmentRoutes = require("./allotmentRoutes");
const permissionRoutes = require("./permissionRoutes");
const { getAllStates } = require("../controller/stateController");

router.use(indexRoutes.auth, authRoutes);
// Emp Management
router.use(indexRoutes.employee, authenticate, employeeRoutes);
router.use(indexRoutes.role, authenticate, roleRoutes);
// Master Data
router.use(indexRoutes.crop, authenticate, cropRoutes);
router.use(indexRoutes.seedCompany, authenticate, seedCompanyRoutes);
router.use(indexRoutes.warehouse, authenticate, warehouseRoutes);
router.use(indexRoutes.cropVariety, authenticate, companyCropRoutes);
router.use(indexRoutes.village, authenticate, villageRoutes);
router.use(indexRoutes.subOrganizer, authenticate, subOrganizerRoutes);
router.use(indexRoutes.logisticPartner, authenticate, logisticPartnerRoutes);
router.use(indexRoutes.labourGroup, authenticate, labourGroupRoutes);
// Operations
router.use(indexRoutes.notifications, authenticate, notificationRoutes);
router.use(indexRoutes.taskType, authenticate, taskTypeRoutes);
router.use(indexRoutes.tasks, authenticate, tasksRoutes);
router.use(indexRoutes.allotment, authenticate, allotmentRoutes);
router.use(indexRoutes.permissions, authenticate, permissionRoutes);

router.get(indexRoutes.states, authenticate, getAllStates);

module.exports = router;
