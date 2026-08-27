import adminController from "@controllers/admin.controller";
import { Router } from "express";
const router = Router();

router.post("/users", adminController.createUser.bind(adminController));
// List users (with role filter + pagination)
router.post("/users/list", adminController.listUsers);
// Update user details
router.put("/users/:userId",adminController.updateUser);
router.post("/users/:userId/temp-password", adminController.generateTempPassword.bind(adminController));
router.post("/user/profile-img/:userId",adminController.updateCustomerProfileImage.bind(adminController))
// Update user password
router.post("/users/password",adminController.updateUserPassword);
// Delete user (soft delete if implemented)
router.delete("/users/:userId",adminController.deleteUser);
// Search users (name/email/username)
router.get("/users/search",adminController.searchUsers);
/* =========================================================
   📦 GENERIC ENTITY LIST (CORE POWER API)
   Works for:
   quotes, invoices, customInvoices, tasks,
   salaries, expenses, stocks, documents
========================================================= */
router.post("/entity/list",adminController.entityList);
// Admin dashboard cards + stats
router.get("/dashboard",adminController.dashboard);


export default router;
