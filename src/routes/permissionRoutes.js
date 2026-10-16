"use strict";
const { Router } = require("express");
const { permissionRoutes } = require("../constants/routes");
const { getAllPermissions } = require("../controller/permissionController");

const router = Router();

router.get(permissionRoutes.root, getAllPermissions);

module.exports = router;