"use strict";
const { AllotmentVillage, Allotment, CompanyCrop, Crop, Village } = require("../models");

// Shared bits for the bags request and bags transfer controllers.

const PROCESSOR_LEVELS = ["L1", "L2"]; // who dispatches requests / confirms company returns
const EMP_ATTRS = ["id", "empId", "name", "level"];

const AV_DETAIL_INCLUDE = [
  { model: Village, as: "village", attributes: ["id", "name"] },
  {
    model: Allotment,
    as: "allotment",
    attributes: ["id", "allotmentId"],
    include: {
      model: CompanyCrop,
      as: "companyCrop",
      attributes: ["id", "cropId", "varietyName"],
      include: { model: Crop, as: "crop", attributes: ["id", "name"] },
    },
  },
];

/** include for an AllotmentVillage association with village + crop + variety. */
const allotmentVillageInclude = (as) => ({
  model: AllotmentVillage,
  as,
  attributes: ["id", "villageId", "supervisorId"],
  include: AV_DETAIL_INCLUDE,
});

/** Flattens an AllotmentVillage (loaded with AV_DETAIL_INCLUDE) into a dropdown option. */
const toAllotmentOption = (av) => ({
  allotmentVillageId: av.id,
  allotmentId: av.allotment?.allotmentId,
  village: av.village?.name,
  crop: av.allotment?.companyCrop?.crop?.name,
  variety: av.allotment?.companyCrop?.varietyName,
});

const isProcessor = (employee) => PROCESSOR_LEVELS.includes(employee.level);

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toNonNegativeInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

module.exports = {
  EMP_ATTRS,
  AV_DETAIL_INCLUDE,
  allotmentVillageInclude,
  toAllotmentOption,
  isProcessor,
  toPositiveInt,
  toNonNegativeInt,
};
