import authController from '@controllers/auth.controller';
import userController from '@controllers/user.controller';
import { Router } from 'express';
const router = Router();

router.get("/search",authController.searchUsers.bind(authController));
router.post("/get-quotes-by-pagination-usr",userController.getUserQuotesWithPagination.bind(userController));
router.post("/get-invoice-by-pagination-usr",userController.getUserInvoiceWIthPagination.bind(userController));
router.put("/edit-profile",  userController.updateProfile.bind(userController));
router.post("/update-avatar",userController.updateProfileImage.bind(userController));
router.delete('/remove-user',userController.deleteUser.bind(userController));
router.put('/update-password',userController.updatePassword.bind(userController))
export default router;
