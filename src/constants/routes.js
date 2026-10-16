const authRoutes = {
  login: "/login",
  forgotPassword: "/forgot-password",
  verifyOtp: "/verify-otp",
  resendOtp:"/resend-otp",
  resetPassword: "/reset-password",
  getDetails: "/me",
  changePassword: "/change-password",
  refreshToken:"/refresh-token",
  logout: "/logout",
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
  labourRequests:"/labour-requests",
  expenseRequests:"/expense-requests",
  vehicleRequests:"/vehicle-requests",
  loadingRequests:"/loading-requests",
  bagRequests:"/bag-requests",
  bagTransfers:"/bag-transfers",
  payments:"/payments",
  dashboard:"/dashboard",
  allFields:"/all-fields",
  allotmentVillages:"/allotment-villages",
  allotmentVillagesBySupervisorId: "/allotment-villages/:supervisorId",
  allotmentVillageStandingAcres: "/allotment-villages/:villageAllotmentId/standing-acres",
};

const allotmentRoutes = {
  root: "/",
  summary: "/summary",
  villageTable: "/village-table",
  myAssignments: "/my-assignments",
  byId: "/:id",
  villagesById: "/:id/villages",
  villagesByIdAndVillageAllotmentId: "/:id/villages/:villageAllotmentId",
};

const bagRequestsRoutes = {
  myRequests: "/my-requests",
  mySummary: "/my-summary",
  summary: "/summary",
  root: "/",
  byId: "/:id",
  statusById: "/:id/status",
};

const bagTransferRoutes = {
  myAllotments: "/my-allotments",
  balanceByAllotmentVillageId: "/balance/:allotmentVillageId",
  companies: "/companies",
  supervisors: "/supervisors",
  supervisorsAllotmentsBySupervisorId: "/supervisors/:supervisorId/allotments",
  myTransfers: "/my-transfers",
  mySummary: "/my-summary",
  root: "/",
  company: "/company",
  companySummary: "/company/summary",
  byId: "/:id",
  statusById: "/:id/status",
};

const companyCropRoutes = {
  allByCompanyId: "/all/:companyId",
  byId: "/:id",
  root: "/",
  statusById: "/status/:id",
};

const cropRoutes = {
  summary: "/summary",
  root: "/",
  byCropId: "/:cropId",
  statusByCropId: "/status/:cropId",
};

const dashboardRoutes = {
  root: "/",
  l1: "/l1",
  l2: "/l2",
  l3: "/l3",
  l3Allotments: "/l3/allotments",
};

const employeeRoutes = {
  root: "/",
  kpis: "/kpis",
  byId: "/:id",
  statusByEmpId: "/status/:empId",
  bankAccountById: "/:id/bank-account",
  documentsById: "/:id/documents",
  documentsByIdAndDocumentId: "/:id/documents/:documentId",
  documentsDownloadByIdAndDocumentId: "/:id/documents/:documentId/download",
  insuranceById: "/:id/insurance",
  insuranceByIdAndInsuranceId: "/:id/insurance/:insuranceId",
};

const expenseRequestRoutes = {
  myRequests: "/my-requests",
  root: "/",
  mySummary: "/my-summary",
  summary: "/summary",
  byId: "/:id",
  verifyById: "/:id/verify",
  approveById: "/:id/approve",
  rejectById: "/:id/reject",
};

const labourGroupRoutes = {
  summary: "/summary",
  root: "/",
  byId: "/:id",
  paymentsById: "/:id/payments",
  paymentsByIdAndPaymentId: "/:id/payments/:paymentId",
};

const labourRequestRoutes = {
  myRequests: "/my-requests",
  allotmentVillages: "/allotment-villages",
  root: "/",
  mySummary: "/my-summary",
  summary: "/summary",
  byId: "/:id",
  verifyById: "/:id/verify",
  approveById: "/:id/approve",
  rejectById: "/:id/reject",
};

const loadingRequestsRoutes = {
  myRequests: "/my-requests",
  mySummary: "/my-summary",
  allotmentVillages: "/allotment-villages",
  supervisors: "/supervisors",
  supervisorsAllotmentVillagesBySupervisorId: "/supervisors/:supervisorId/allotment-villages",
  warehouses: "/warehouses",
  summary: "/summary",
  root: "/",
  byId: "/:id",
  paymentsById: "/:id/payments",
  amountsById: "/:id/amounts",
  verifyById: "/:id/verify",
  cancelById: "/:id/cancel",
};

const logisticPartnerRoutes = {
  summary: "/summary",
  root: "/",
  byId: "/:id",
  paymentsById: "/:id/payments",
  paymentsByIdAndPaymentId: "/:id/payments/:paymentId",
  statusByLogisticsId: "/status/:logisticsId",
  vehiclesByLogisticsPartnerId: "/:logisticsPartnerId/vehicles",
  vehiclesByVehicleId: "/vehicles/:vehicleId",
};

const notificationRoutes = {
  summary: "/summary",
  root: "/",
  myNotifications: "/my-notifications",
  byId: "/:id",
  documentById: "/:id/document",
  responsesByNotificationId: "/:notificationId/responses",
};

const paymentRoutes = {
  summary: "/summary",
  filterOptions: "/filter-options",
  root: "/",
  byId: "/:id",
  processById: "/:id/process",
};

const permissionRoutes = {
  root: "/",
};

const roleRoutes = {
  root: "/",
  kpis: "/kpis",
  byId: "/:id",
  statusByRoleId: "/status/:roleId",
};

const seedCompanyRoutes = {
  summary: "/summary",
  root: "/",
  bySeedCompanyId: "/:seedCompanyId",
};

const subOrganizerRoutes = {
  summary: "/summary",
  root: "/",
  byId: "/:id",
  bySubOrganizerId: "/:subOrganizerId",
  statusBySubOrganizerId: "/status/:subOrganizerId",
};

const taskRoutes = {
  summary: "/summary",
  root: "/",
  myTasks: "/my-tasks",
  mySummary: "/my-summary",
  byId: "/:id",
  statusById: "/:id/status",
};

const taskTypeRoutes = {
  root: "/",
  byId: "/:id",
};

const vehicleRequestRoutes = {
  myRequests: "/my-requests",
  allotmentVillages: "/allotment-villages",
  warehousesByAllotmentVillageId: "/warehouses/:allotmentVillageId",
  root: "/",
  mySummary: "/my-summary",
  summary: "/summary",
  byId: "/:id",
  markInProcessById: "/:id/mark-in-process",
  assignById: "/:id/assign",
  cancelById: "/:id/cancel",
};

const villageRoutes = {
  root: "/",
  summary: "/summary",
  byVillageId: "/:villageId",
  statusByVillageId: "/status/:villageId",
  subOrganizersByVillageId: "/:villageId/sub-organizers",
};

const warehouseRoutes = {
  root: "/",
  byWarehouseId: "/:warehouseId",
  allBySeedCompanyId: "/all/:seedCompanyId",
};

module.exports = {
  authRoutes,
  indexRoutes,
  allotmentRoutes,
  bagRequestsRoutes,
  bagTransferRoutes,
  companyCropRoutes,
  cropRoutes,
  dashboardRoutes,
  employeeRoutes,
  expenseRequestRoutes,
  labourGroupRoutes,
  labourRequestRoutes,
  loadingRequestsRoutes,
  logisticPartnerRoutes,
  notificationRoutes,
  paymentRoutes,
  permissionRoutes,
  roleRoutes,
  seedCompanyRoutes,
  subOrganizerRoutes,
  taskRoutes,
  taskTypeRoutes,
  vehicleRequestRoutes,
  villageRoutes,
  warehouseRoutes,
};
