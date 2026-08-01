import { Request, Response } from "express";
import googleSolarService from "@services/googleSolar.service";
import { ReS, ReE } from "@services/generalHelper.service";
import {
  SUCCESS_CODE,
  SERVER_ERROR_CODE,
  BAD_REQUEST_CODE,
} from "@constants/serverCode";

class SolarController {
  async geocode(req: Request, res: Response) {
    try {
      const address = String(req.query.address || "").trim();
      if (!address) {
        return ReE(res, BAD_REQUEST_CODE, "Address is required");
      }

      const result = await googleSolarService.geocodeAddress(address);
      return ReS(res, SUCCESS_CODE, "Address geocoded", result);
    } catch (error) {
      console.error("[solar.geocode]", error);
      const message =
        error instanceof Error ? error.message : "Geocoding failed";
      return ReE(res, SERVER_ERROR_CODE, message);
    }
  }

  async buildingInsights(req: Request, res: Response) {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return ReE(res, BAD_REQUEST_CODE, "Valid lat and lng are required");
      }

      const insights = await googleSolarService.getBuildingInsights(lat, lng);
      return ReS(res, SUCCESS_CODE, "Building insights loaded", insights);
    } catch (error) {
      console.error("[solar.buildingInsights]", error);
      const message =
        error instanceof Error ? error.message : "Building insights failed";
      return ReE(res, SERVER_ERROR_CODE, message);
    }
  }

  async satelliteImage(req: Request, res: Response) {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const zoom = Number(req.query.zoom || 20);
      const size = Number(req.query.size || 1280);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return ReE(res, BAD_REQUEST_CODE, "Valid lat and lng are required");
      }

      const image = await googleSolarService.getSatelliteImage(
        lat,
        lng,
        Number.isFinite(zoom) ? zoom : 20,
        Number.isFinite(size) ? Math.min(size, 1280) : 1280,
      );

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.status(200).send(image);
    } catch (error) {
      console.error("[solar.satelliteImage]", error);
      const message =
        error instanceof Error ? error.message : "Satellite image failed";
      return ReE(res, SERVER_ERROR_CODE, message);
    }
  }
}

export default new SolarController();
