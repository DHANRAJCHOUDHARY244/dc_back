import siteInfoController from "@controllers/siteInfo.controller";
import { Router } from "express";
const router = Router();

router.get("/v1/get", siteInfoController.getSiteInfo.bind(siteInfoController));
router.get("/get", siteInfoController.getSiteInfo.bind(siteInfoController));
router.get("/v1/by-installer/:installerId", siteInfoController.getSiteInfoByInstaller.bind(siteInfoController));
router.post("/v1/create", siteInfoController.createSiteInfo.bind(siteInfoController));
router.get("/v1/:id", siteInfoController.getSiteInfoById.bind(siteInfoController));
router.put("/v1/:id", siteInfoController.updateSiteInfo.bind(siteInfoController));
router.delete("/v1/:id", siteInfoController.deleteSiteInfo.bind(siteInfoController));
router.post("/v1/:id/send", siteInfoController.sendSiteInfoEmail.bind(siteInfoController));
router.post("/v1/:id/follow-up", siteInfoController.sendSiteInfoFollowUp.bind(siteInfoController));
export default router;