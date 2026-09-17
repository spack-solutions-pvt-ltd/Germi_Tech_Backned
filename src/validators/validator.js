"use strict";
const { z } = require("zod");

const createSeedCompanySchema = z.object({
  name: z.string().min(1).max(150),
  number: z.string().min(10).max(15),
  email: z.string().email(),
  address: z.string().max(255).optional(),
  pocName: z.string().max(150).optional(),
  pocNumber: z.string().max(15).optional(),
  fullAddress: z.string().max(500).optional(),
  district: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  state: z.string().max(100).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

const updateSeedCompanySchema = createSeedCompanySchema.partial();

module.exports = { createSeedCompanySchema, updateSeedCompanySchema };