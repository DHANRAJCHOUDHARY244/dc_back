import { Router } from "express";
import letterStudioController from "@controllers/letterStudio.controller";

const router = Router();
router.post("/send", letterStudioController.send.bind(letterStudioController));
router.post("/file", letterStudioController.file.bind(letterStudioController));
export default router;
