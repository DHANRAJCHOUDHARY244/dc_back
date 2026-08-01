import installerAgreementController from "@controllers/installerAgreement.controller";
import { Router } from "express";
import fileUpload from "express-fileupload";


const router = Router();

/* ================= AGREEMENT ================= */

router.post(
  "/",
  installerAgreementController.saveInstallerAgreement.bind(
    installerAgreementController
  )
);

router.put(
  "/:token",
  installerAgreementController.updateInstallerAgreement.bind(
    installerAgreementController
  )
);

router.post(
  "/sign",
  installerAgreementController.signInstallerAgreement.bind(
    installerAgreementController
  )
);

router.post(
  "/document",
  installerAgreementController.uploadInstallerDocument.bind(
    installerAgreementController
  )
);

router.get(
  "/",
  installerAgreementController.getInstallerAgreement.bind(
    installerAgreementController
  )
);
router.get(
  "/documents/:id",
  installerAgreementController.getInstallerAgreementDocuments.bind(
    installerAgreementController
  )
);

router.post(
  "/list",
  installerAgreementController.getAllInstallerAgreements.bind(
    installerAgreementController
  )
);

router.post(
  "/follow-up",
  installerAgreementController.sendInstallerAgreementFollowUp.bind(
    installerAgreementController
  )
);

router.post(
  "/send-pdf",
  installerAgreementController.sendInstallerAgreementPdf.bind(
    installerAgreementController
  )
);

router.delete(
  "/:id",
  installerAgreementController.deleteInstallerDocument.bind(
    installerAgreementController
  )
);

router.delete(
  "/agreement/:id",
  installerAgreementController.deleteInstallerAgreement.bind(
    installerAgreementController
  )
);

export default router;
