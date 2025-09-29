const express = require("express");
const router = express.Router();

// Import controllers
const UserController = require("../controllers/userController");
const AuthMiddleware = require("../middlewares/authMiddleware");
const ProgramController = require("../controllers/programController");
const RegistrationController = require("../controllers/registrationController");
const ReferralController = require("../controllers/referralController");
const ParticipantController = require("../controllers/participantController");

// Import middleware
const { logMidtransRequest } = require("../config/midtrans");

// Apply Midtrans logging middleware
router.use(logMidtransRequest);

// Public routes (no authentication required)
router.post("/user-registration", UserController.register);
router.post("/login", UserController.login); // ok

// Protected routes (authentication required)
router.get(
  "/profile",
  AuthMiddleware.authenticateToken,
  UserController.getProfile
); // ok
router.put(
  "/change-password",
  AuthMiddleware.authenticateToken,
  UserController.changePassword
); // ok
router.post(
  "/refresh",
  AuthMiddleware.authenticateToken,
  UserController.refreshToken
); // ok
router.post("/logout", AuthMiddleware.authenticateToken, UserController.logout); // ok

// Admin only routes
router.get("/users", AuthMiddleware.adminOnly, UserController.getAllUsers); // ok
router.get("/users/:id", AuthMiddleware.adminOnly, UserController.getUserById); // ok
router.delete(
  "/users/:id",
  AuthMiddleware.adminOnly,
  UserController.deleteUser
); // ok

// Program routes
router.get("/programs", ProgramController.getAllPrograms); // ok
router.get("/programs/:id", ProgramController.getProgramById); // ok
router.post("/programs", ProgramController.createProgram); // ok
router.put("/programs/:id", ProgramController.updateProgram); // ok
router.delete("/programs/:id", ProgramController.deleteProgram); // ok
// router.get("/programs/stats", ProgramController.getProgramStats); // pending
// router.get("/programs/search", ProgramController.searchPrograms); // pending
// router.post("/programs/:id/duplicate", ProgramController.duplicateProgram); // pending
router.get("/programs/:id/price", ProgramController.getCurrentPrice); // ok

// Registration routes
router.post("/register", RegistrationController.createRegistration); // ok
router.get(
  "/registration/:registrationId",
  RegistrationController.getRegistrationById
); // ok
router.get(
  "/registrations",
  AuthMiddleware.adminOnly,
  RegistrationController.getAllRegistrations
); // ok
// router.get(
//   "/registrations/stats",
//   AuthMiddleware.adminOnly,
//   RegistrationController.getRegistrationStats
// ); // pending
router.delete(
  "/registration/:registrationId/cancel",
  RegistrationController.cancelRegistration
); // ok
router.get(
  "/registrations-export-excel",
  AuthMiddleware.adminOnly,
  RegistrationController.exportRegistrationsToExcel
); // ok
router.get(
  "/registration/:registrationId/invoice",
  RegistrationController.downloadInvoice
); // ok

// admin only routes
router.get(
  "/participants",
  AuthMiddleware.adminOnly,
  ParticipantController.getAllParticipants
); // ok
router.get(
  "/participants/:id",
  AuthMiddleware.adminOnly,
  ParticipantController.getParticipantById
); // ok
router.get(
  "/participants-export-excel",
  ParticipantController.exportParticipantsToExcel
); // ok

// Payment routes
router.post(
  "/payment/notification",
  RegistrationController.handlePaymentNotification
);
router.get(
  "/payment/status/:registrationId",
  RegistrationController.getPaymentStatus
); // ok
router.post(
  "/payment/check/:registrationId",
  RegistrationController.checkPaymentStatus
);

// Referral routes
router.post("/referral-codes", ReferralController.createReferralCode); // ok
router.get("/referral-codes", ReferralController.getAllReferralCodes); // ok
// router.get("/referral-codes/stats", ReferralController.getReferralStats); // pending
router.get("/referral-codes/:id", ReferralController.getReferralCodeById); // ok
router.put("/referral-codes/:id", ReferralController.updateReferralCode); // ok
router.delete("/referral-codes/:id", ReferralController.deleteReferralCode); // ok
router.post("/referral/check", ReferralController.checkReferralCode); // ok
router.get(
  "/referral/usage/:referral_code",
  ReferralController.getReferralUsage
); // ok
router.post("/referral/use", ReferralController.useReferralCode); // ok

// Health check routes
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  });
});

// Test route dengan informasi lebih lengkap
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "API is working properly!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    midtrans: {
      environment:
        process.env.MIDTRANS_IS_PRODUCTION === "true"
          ? "production"
          : "sandbox",
      server_key_set: !!process.env.MIDTRANS_SERVER_KEY,
      client_key_set: !!process.env.MIDTRANS_CLIENT_KEY,
    },
    database: process.env.DATABASE_URL,
    endpoints: {
      programs: [
        "GET /api/programs",
        "GET /api/programs/:id",
        "POST /api/programs",
        "PUT /api/programs/:id",
        "DELETE /api/programs/:id",
      ],
      registrations: [
        "POST /api/register",
        "GET /api/registration/:registrationId",
        "GET /api/registrations",
        "GET /api/registrations/stats",
        "DELETE /api/registration/:registrationId/cancel",
      ],
      payments: [
        "POST /api/payment/notification",
        "GET /api/payment/status/:registrationId",
        "POST /api/payment/check/:registrationId",
      ],
      system: ["GET /api/test", "GET /api/health"],
    },
  });
});

// Error handling middleware khusus untuk routes ini
router.use((error, req, res, next) => {
  console.error("Route error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      path: req.path,
      method: req.method,
    }),
  });
});

module.exports = router;
