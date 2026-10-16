"use strict";

// Response messages for controller/dashboardController.js.
// Functions build messages that include values (counts, codes, statuses).
const dashboardMessages = {
  l1DashboardFetchedSuccessfully: "L1 dashboard fetched successfully",
  l2DashboardFetchedSuccessfully: "L2 dashboard fetched successfully",
  l3DashboardFetchedSuccessfully: "L3 dashboard fetched successfully",
  myAllotmentsFetchedSuccessfully: "My allotments fetched successfully",
  noDashboardForLevel: (level) => `No dashboard for level ${level}`,
};

module.exports = { dashboardMessages };
