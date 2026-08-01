import { Router } from "express";
import crmSettingsController from "@controllers/crmSettings.controller";

const router = Router();

router.get("/", crmSettingsController.getSettings.bind(crmSettingsController));
router.put("/", crmSettingsController.updateSettings.bind(crmSettingsController));
router.post("/upload", crmSettingsController.uploadBrandingAsset.bind(crmSettingsController));
router.post("/metadata/reorder", crmSettingsController.reorderMetadataFields.bind(crmSettingsController));

export default router;
