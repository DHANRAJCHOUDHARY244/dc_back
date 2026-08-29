import express from 'express';
const router = express.Router();
import permissionController from '@controllers/permission.controller';

router.post("/add", permissionController.addPermission.bind(permissionController));
router.post("/sync-catalog", permissionController.syncCatalog.bind(permissionController));
router.get("/all", permissionController.getAllPermissions.bind(permissionController));
router.put("/update/:id", permissionController.updatePermission.bind(permissionController));
router.delete("/:id", permissionController.deletePermission.bind(permissionController));
router.get("/", permissionController.getPermissionPagination.bind(permissionController));
export default router;