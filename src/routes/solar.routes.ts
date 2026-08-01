import { Router } from "express";
import solarController from "@controllers/solar.controller";

const router = Router();

router.get("/geocode", solarController.geocode.bind(solarController));
router.get(
  "/insights",
  solarController.buildingInsights.bind(solarController),
);
router.get(
  "/satellite-image",
  solarController.satelliteImage.bind(solarController),
);

export default router;
