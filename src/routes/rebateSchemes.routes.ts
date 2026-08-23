import { Router } from "express";
import rebateSchemesController from "@controllers/rebateSchemes.controller";

const router = Router();

router.get("/", rebateSchemesController.list.bind(rebateSchemesController));
router.post("/seed", rebateSchemesController.seed.bind(rebateSchemesController));
router.post("/evaluate", rebateSchemesController.evaluate.bind(rebateSchemesController));
router.get("/:id", rebateSchemesController.getOne.bind(rebateSchemesController));
router.post("/", rebateSchemesController.create.bind(rebateSchemesController));
router.put("/:id", rebateSchemesController.update.bind(rebateSchemesController));
router.delete("/:id", rebateSchemesController.remove.bind(rebateSchemesController));

export default router;
