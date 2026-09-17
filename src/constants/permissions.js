"use strict";

const PERMISSION_MODULES = [
  {
    module: "seed_company_management",
    label: "Seed Company Management",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "crop_management",
    label: "Crop Management",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "village_management",
    label: "Village Management",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "sub_organizer_management",
    label: "Sub Organizer Management",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "logistics_management",
    label: "Logistics Management",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "labour_groups",
    label: "Labour Groups Management",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "allotment_management",
    label: "Allotment Management",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
      { action: "delete", name: "Delete" },
    ],
  },
  {
    module: "task_management",
    label: "Task Management",
    actions: [
      { action: "global_view", name: "Global View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
      { action: "tast_type", name: "Task types" },
    ],
  },
  {
    module: "approvals",
    label: "Approvals",
    actions: [
      { action: "view", name: "View" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "verifications",
    label: "Verifications",
    actions: [
      { action: "view", name: "View" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "requests",
    label: "Requests",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "payments",
    label: "Payments",
    actions: [
      { action: "view", name: "View" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "reports",
    label: "Reports",
    actions: [
      { action: "view", name: "View" },
      { action: "download", name: "Download" },
    ],
  },
  {
    module: "notification_management",
    label: "Notification Management",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "employee",
    label: "Employees",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
    ],
  },
  {
    module: "role_management",
    label: "Role Management",
    actions: [
      { action: "view", name: "View" },
      { action: "add", name: "Add" },
      { action: "edit", name: "Edit" },
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
