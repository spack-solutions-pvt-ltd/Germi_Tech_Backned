"use strict";
const { z } = require("zod");

const createEmployeeSchema = z.object({
  name: z.string().min(1).max(150),
  number: z.string().min(10).max(15),
  alternateNumber: z.string().max(15).optional(),
  email: z.string().email().optional(),
  level: z.enum(["L1", "L2", "L3"]),
  roleId: z.number().int().positive(),
  status: z.enum(["Active", "Inactive"]).optional(),
  documents: z.array(documentSchema).optional(),
  insurances: z.array(insuranceSchema).optional(),
});

module.exports = { createEmployeeSchema };
