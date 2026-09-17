"use strict";
const { Router } = require("express");
const { getAllPermissions } = require("../controller/permissionController");

const router = Router();

router.get("/", getAllPermissions);

module.exports = router;