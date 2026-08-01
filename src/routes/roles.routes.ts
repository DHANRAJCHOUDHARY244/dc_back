import rolesController from "@controllers/roles.controller";
import { Router } from "express";
const router = Router();

router.post('/create', rolesController.createRole);
router.get('/', rolesController.getRoles);
router.put('/update/:id', rolesController.updateRole);
router.delete('/:id', rolesController.deleteRole);
router.get('/user-permissions/:id', rolesController.getRolePermissions);
router.put('/user-permission/update', rolesController.updatePermissionsForRole);

export default router;