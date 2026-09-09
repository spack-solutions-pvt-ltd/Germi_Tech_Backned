"use strict";

// One entry per module, listing the actions that module supports.
// Mirrors the checkboxes on the "Create Role" page in Figma.
const PERMISSION_MODULES = [
  {
    module: "seed_company_management",
    label: "Seed Company Management",
    actions: [
      { action: "view", name: "View Seed Companies" },
      { action: "add_edit", name: "Add / Edit Seed Companies" },
    ],
  },
  {
    module: "crop_management",
    label: "Crop Management",
    actions: [
      { action: "view", name: "View Crops" },
      { action: "add_edit", name: "Add / Edit Crops" },
    ],
  },
  {
    module: "village_management",
    label: "Village Management",
    actions: [
      { action: "view", name: "View Villages" },
      { action: "add_edit", name: "Add / Edit Villages" },
    ],
  },
  {
    module: "sub_organizer_management",
    label: "Sub Organizer Management",
    actions: [
      { action: "view", name: "View Sub Organizers" },
      { action: "add_edit", name: "Add / Edit Sub Organizers" },
    ],
  },
  {
    module: "logistics_management",
    label: "Logistics Management",
    actions: [
      { action: "view", name: "View Logistics" },
      { action: "add_edit", name: "Add / Edit Logistics" },
    ],
  },
  {
    module: "allotment_management",
    label: "Allotment Management",
    actions: [
      { action: "view", name: "View Allotments" },
      { action: "add_edit", name: "Add / Edit Allotments" },
    ],
  },
  {
    module: "task_management",
    label: "Task Management",
    actions: [
      { action: "view", name: "View Tasks" },
      { action: "add_edit", name: "Add / Edit Tasks" },
    ],
  },
  {
    module: "l1_requests",
    label: "L1 Requests",
    actions: [
      { action: "view", name: "View L1 Requests" },
      { action: "update", name: "Update L1 Requests" },
    ],
  },
  {
    module: "l2_requests",
    label: "L2 Requests",
    actions: [
      { action: "view", name: "View L2 Requests" },
      { action: "update", name: "Update L2 Requests" },
    ],
  },
  {
    module: "payments",
    label: "Payments",
    actions: [
      { action: "view", name: "View Payments" },
      { action: "make", name: "Make Payments" },
      { action: "edit", name: "Edit / Update Payments" },
    ],
  },
  {
    module: "task_types_management",
    label: "Task Types Management",
    actions: [
      { action: "view", name: "View Task Types" },
      { action: "add_edit", name: "Add / Edit Task Types" },
    ],
  },
  {
    module: "entries_management",
    label: "Entries (Field Submissions)",
    actions: [
      // Covers Labor entry, Exp Request, Bags Request, Bags Shared,
      // Vehicle Request, Loading Entry, Bags Return entry as one module —
      // split into per-type modules later if you need finer-grained control.
      { action: "view", name: "View Entries" },
      { action: "create", name: "Create Entries" },
    ],
  },
  {
    module: "entries_approval",
    label: "Entries Approval",
    actions: [
      // L2 reviewing/forwarding entries to L1, and the L3 "Approval Entry
      // for Bags" step, both live here.
      { action: "view", name: "View Pending Entries" },
      { action: "approve", name: "Approve / Forward Entries" },
    ],
  },
];

const PERMISSIONS = PERMISSION_MODULES.flatMap(({ module, label, actions }) =>
  actions.map(({ action, name }) => ({
    module,
    action,
    code: `${module}.${action}`,
    name,
    description: `Permission to ${action.replace("_", " / ")} in ${label}`,
  })),
);

module.exports = { PERMISSION_MODULES, PERMISSIONS };
