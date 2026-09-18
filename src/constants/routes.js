const authRoutes = {
  login: "/login",
  forgotPassword: "/forgot-password",
  verifyOtp: "/verify-otp",
  resendOtp:"/resend-otp",
  resetPassword: "/reset-password",
  getDetails: "/me",
  changePassword: "/change-password",
};

const indexRoutes = {
  auth: "/auth",
  crop: "/crop",
  seedCompany: "/seed-company",
  warehouse: "/seed-company/warehouse",
  cropVariety: "/seed-company/variety",
  village: "/village",
  subOrganizer: "/sub-organizer",
  states: "/states",
  logisticPartner: "/logistics",
  labourGroup: "/labour-groups",
  employee: "/employee",
  role: "/roles",
  notifications: "/notifications",
  taskType: "/task-types",
  tasks: "/tasks",
  allotment: "/allotments",
  permissions: "/permissions",
};

module.exports = {
  authRoutes,
  indexRoutes,
};
