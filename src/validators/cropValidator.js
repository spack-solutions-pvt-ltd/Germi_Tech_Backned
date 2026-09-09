"use strict";
const { z } = require("zod");

const createCropSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  duration: z.string().max(50).optional(),
  season: z.enum(["Kharif", "Rabi"]),
});

const updateCropSchema = createCropSchema.partial();

module.exports = { createCropSchema, updateCropSchema };
