"use strict";
const { Op } = require("sequelize");

// Date periods used by KPI cards ("this month", "Kharif 25-26").
//
// Years are crop years written "25-26" (as the Allotment form saves them).
// Crop year 25-26 = 1 Jun 2025 – 31 May 2026:
//   Kharif 25-26 = 1 Jun – 31 Oct 2025
//   Rabi   25-26 = 1 Nov 2025 – 31 May 2026
// Internally `year` is the start year (2025); `cropYear` is "25-26".

const SEASONS = ["Kharif", "Rabi"];

function startOfCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 2025 -> "25-26" */
const cropYearLabel = (startYear) =>
  `${String(startYear % 100).padStart(2, "0")}-${String((startYear + 1) % 100).padStart(2, "0")}`;

/**
 * Start year of a crop year in any of the accepted forms, or null:
 *   "25-26", "2025-26", "2025-2026", "25", 2025, "2025" -> 2025
 */
function cropYearStart(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{2}|\d{4})(?:\s*-\s*(\d{2}|\d{4}))?$/);
  if (!match) return null;
  const first = Number(match[1]);
  const start = match[1].length === 2 ? 2000 + first : first;
  if (match[2] !== undefined && Number(match[2]) % 100 !== (start + 1) % 100) return null; // "25-27"
  return start;
}

/** Any accepted form -> "25-26" (null when invalid). */
function toCropYear(value) {
  const start = cropYearStart(value);
  return start === null ? null : cropYearLabel(start);
}

/** The season `date` falls in. */
function seasonOf(date = new Date()) {
  const month = date.getMonth(); // 0 = Jan
  // Jun–Dec belong to the crop year starting this year; Jan–May to the one that started last year.
  const year = month >= 5 ? date.getFullYear() : date.getFullYear() - 1;
  const season = month >= 5 && month <= 9 ? "Kharif" : "Rabi";
  return { season, year, cropYear: cropYearLabel(year) };
}

/** [start, end] dates of a season (end is exclusive); `year` is the crop year's start year. */
function seasonRange({ season, year }) {
  return season === "Kharif"
    ? [new Date(year, 5, 1), new Date(year, 10, 1)]
    : [new Date(year, 10, 1), new Date(year + 1, 5, 1)];
}

/**
 * Season from ?season=Kharif|Rabi&year=25-26, falling back to the current
 * season / crop year. Returns { season, year, cropYear, label, start, end }.
 */
function resolveSeason(query = {}) {
  const current = seasonOf();
  const season = SEASONS.includes(query.season) ? query.season : current.season;
  const year = cropYearStart(query.year) ?? current.year;
  const [start, end] = seasonRange({ season, year });
  const cropYear = cropYearLabel(year);
  return { season, year, cropYear, label: `${season} ${cropYear}`, start, end };
}

/**
 * Optional season filter for payments and KPI cards:
 *   ?season=Kharif&year=25-26 -> that season
 *   ?season=Rabi              -> that season of the current crop year
 *   ?year=25-26               -> the whole crop year (1 Jun 2025 – 31 May 2026)
 *   nothing                   -> null (no filter, all time)
 */
function seasonFilter(query = {}) {
  const hasSeason = SEASONS.includes(query.season);
  const year = cropYearStart(query.year);
  if (!hasSeason && year === null) return null;
  if (hasSeason) return resolveSeason(query);
  const cropYear = cropYearLabel(year);
  return { season: null, year, cropYear, label: cropYear, start: new Date(year, 5, 1), end: new Date(year + 1, 5, 1) };
}

/** YYYY-MM-DD for DATEONLY comparisons. */
const toDateOnly = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Which allotments acre figures cover: a given season (?season=&year=25-26),
 * or every open allotment by default. Returns { where, label } — where is for
 * the Allotment model.
 */
function allotmentScope(query = {}) {
  const { season } = query;
  const cropYear = toCropYear(query.year);
  if (SEASONS.includes(season) && cropYear) {
    return { where: { season, year: cropYear }, label: `${season} ${cropYear}` };
  }
  return { where: { status: "open" }, label: "Open allotments" };
}

/**
 * Payment `where` for a season (from seasonFilter / resolveSeason): pending
 * payments raised in it (createdAt), processed ones paid in it (paymentDate).
 * {} when season is null.
 */
function paymentSeasonWhere(season) {
  if (!season) return {};
  return {
    [Op.or]: [
      { status: "pending", createdAt: { [Op.gte]: season.start, [Op.lt]: season.end } },
      { status: "processed", paymentDate: { [Op.gte]: toDateOnly(season.start), [Op.lt]: toDateOnly(season.end) } },
    ],
  };
}

module.exports = {
  SEASONS,
  startOfCurrentMonth,
  seasonOf,
  seasonRange,
  resolveSeason,
  seasonFilter,
  paymentSeasonWhere,
  toDateOnly,
  toCropYear,
  cropYearStart,
  cropYearLabel,
  allotmentScope,
};
