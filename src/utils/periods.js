"use strict";

// Date periods used by KPI cards ("this month", "Kharif 2026").
//
// Seasons: Kharif = 1 Jun – 31 Oct of `year`; Rabi = 1 Nov of `year` –
// 31 May of `year + 1` (a Rabi season is labelled by the year it starts in,
// matching Allotment.season + Allotment.year).

const SEASONS = ["Kharif", "Rabi"];

function startOfCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** The season `date` falls in. */
function seasonOf(date = new Date()) {
  const month = date.getMonth(); // 0 = Jan
  if (month >= 5 && month <= 9) return { season: "Kharif", year: date.getFullYear() };
  // Nov/Dec start a Rabi season; Jan–May belong to the one that started last year.
  return { season: "Rabi", year: month >= 10 ? date.getFullYear() : date.getFullYear() - 1 };
}

/** [start, end] dates of a season (end is exclusive). */
function seasonRange({ season, year }) {
  return season === "Kharif"
    ? [new Date(year, 5, 1), new Date(year, 10, 1)]
    : [new Date(year, 10, 1), new Date(year + 1, 5, 1)];
}

/**
 * Season from ?season=Kharif|Rabi&year=2026, falling back to the current
 * season. Returns { season, year, label, start, end }.
 */
function resolveSeason(query = {}) {
  const current = seasonOf();
  const season = SEASONS.includes(query.season) ? query.season : current.season;
  const year = Number.isInteger(Number(query.year)) && query.year ? Number(query.year) : current.year;
  const [start, end] = seasonRange({ season, year });
  return { season, year, label: `${season} ${year}`, start, end };
}

/** YYYY-MM-DD for DATEONLY comparisons. */
const toDateOnly = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

module.exports = { startOfCurrentMonth, seasonOf, seasonRange, resolveSeason, toDateOnly };
