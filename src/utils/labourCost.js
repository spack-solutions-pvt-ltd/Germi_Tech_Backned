"use strict";
const { LaborGroupCropRate } = require("../models");

/**
 * Crop-wise cost for a labour request loaded with its cropEntries →
 * allotmentVillage → allotment → companyCrop → crop. Each entry's crop is
 * priced with the assigned labor group's LaborGroupCropRate for that crop:
 *   totalAmount = Σ (labourCount * pricePerPerson) + transportCost
 * Entries whose crop has no rate (or an "Others" labor group) get
 * pricePerPerson null and are listed in missingRateCrops.
 */
async function calculateLabourCost(request) {
  const entries = request.cropEntries || [];
  const cropIds = [
    ...new Set(entries.map((e) => e.allotmentVillage?.allotment?.companyCrop?.cropId).filter(Boolean)),
  ];

  const rates =
    request.laborGroupId && cropIds.length
      ? await LaborGroupCropRate.findAll({ where: { laborGroupId: request.laborGroupId, cropId: cropIds } })
      : [];
  const priceByCrop = new Map(rates.map((r) => [r.cropId, Number(r.pricePerPerson)]));

  const cropCosts = entries.map((e) => {
    const crop = e.allotmentVillage?.allotment?.companyCrop?.crop;
    const cropId = crop?.id ?? e.allotmentVillage?.allotment?.companyCrop?.cropId;
    const pricePerPerson = priceByCrop.has(cropId) ? priceByCrop.get(cropId) : null;
    const labourCount = Number(e.labourCount) || 0;
    return {
      cropEntryId: e.id,
      cropId,
      cropName: crop?.name || null,
      labourCount,
      pricePerPerson,
      subtotal: pricePerPerson !== null ? labourCount * pricePerPerson : 0,
    };
  });

  const labourCostSubtotal = cropCosts.reduce((a, c) => a + c.subtotal, 0);
  const transportCost = Number(request.transportCost) || 0;

  return {
    cropCosts,
    labourCostSubtotal,
    transportCost,
    totalAmount: labourCostSubtotal + transportCost,
    missingRateCrops: cropCosts.filter((c) => c.pricePerPerson === null).map((c) => c.cropName),
  };
}

module.exports = { calculateLabourCost };
