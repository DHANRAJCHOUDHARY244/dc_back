import { Response } from "express";
import { UploadedFile } from "express-fileupload";

import {
  AuthenticatedRequest,
  DocumentsAuthenticatedRequest,
} from "@constants/common.interface";

import {
  BAD_REQUEST_CODE,
  RESOURCE_NOT_FOUND,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";

import { ReE, ReS } from "@services/generalHelper.service";
import { UploadCategory } from "@constants/common.enum";
import { workflowPopulate } from "@constants/workflow.include";

import {
  invoiceRepository,
  quoteWorkflowRepository,
} from "@repositories";
import { uploadFiles } from "@utils/fileUpload.helper";

class QuoteWorkflowController {
  private getId(req: AuthenticatedRequest): number {
    return Number(req.params.id);
  }

  private async findWorkflow(id: number) {
    return quoteWorkflowRepository.findById(id);
  }

  /* ================= CREATE ================= */

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const workflow = await quoteWorkflowRepository.create(req.body);

      return ReS(res, SUCCESS_CODE, "Workflow created", workflow);
    } catch (err) {
      return ReE(res, SERVER_ERROR_CODE, (err as Error)?.message || "Server error");
    }
  }

  /* ================= LIST ================= */

  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = "1", limit = "10", search, pay_status } = req.query;

      const p = Number(page);
      const l = Number(limit);
      const searchStr = typeof search === "string" ? search.trim() : "";
      const hasSearch = searchStr.length > 0;
      const numericSearch = hasSearch ? Number(searchStr) : NaN;
      const isNumeric = !Number.isNaN(numericSearch) && String(numericSearch) === searchStr;

      const filter: Record<string, unknown> = {};
      const orConditions: Record<string, unknown>[] = [];
      if (hasSearch) {
        orConditions.push(
          { installer_payment_status: { $regex: searchStr, $options: "i" } },
          { sales_person_payment_status: { $regex: searchStr, $options: "i" } },
        );
        if (isNumeric) orConditions.push({ quote_id: numericSearch });
      }
      if (orConditions.length) filter.$or = orConditions;

      const payStatusStr = typeof pay_status === "string" ? pay_status.trim() : "";
      if (payStatusStr) {
        const invoices = await invoiceRepository.find(
          { pay_status: payStatusStr },
          { select: "id", lean: true },
        );
        const invoiceIds = invoices.map((inv: any) => inv.id);
        if (!invoiceIds.length) {
          return ReS(res, SUCCESS_CODE, "Workflows fetched", {
            data: [],
            totalItems: 0,
            totalPages: 0,
            currentPage: p,
          });
        }
        filter.invoice_id = { $in: invoiceIds };
      }

      const { rows, count } = await quoteWorkflowRepository.findPaginated(filter, {
        page: p,
        limit: l,
        sort: { created_at: -1 },
        populate: workflowPopulate,
      });

      return ReS(res, SUCCESS_CODE, "Workflows fetched", {
        data: rows,
        totalItems: count,
        totalPages: Math.ceil(count / l),
        currentPage: p,
      });
    } catch (err) {
      return ReE(res, SERVER_ERROR_CODE, (err as Error)?.message || "Server error");
    }
  }

  /* ================= GET ================= */

  async get(req: AuthenticatedRequest, res: Response) {
    try {
      const workflow = await quoteWorkflowRepository.findById(this.getId(req), {
        populate: workflowPopulate,
      });

      if (!workflow)
        return ReE(res, RESOURCE_NOT_FOUND, "Workflow not found");

      return ReS(res, SUCCESS_CODE, "Workflow fetched", workflow);
    } catch (err) {
      return ReE(res, SERVER_ERROR_CODE, (err as Error)?.message || "Server error");
    }
  }

  /* ================= UPDATE ================= */

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const workflow = await this.findWorkflow(this.getId(req));

      if (!workflow)
        return ReE(res, RESOURCE_NOT_FOUND, "Workflow not found");

      const updated = await quoteWorkflowRepository.updateById(this.getId(req), {
        $set: req.body,
      });

      return ReS(res, SUCCESS_CODE, "Workflow updated", updated);
    } catch (err) {
      return ReE(res, SERVER_ERROR_CODE, (err as Error)?.message || "Server error");
    }
  }

  /* ================= UPLOAD DOC ================= */

  async uploadInstallerDocs(
    req: DocumentsAuthenticatedRequest,
    res: Response
  ) {
    try {
      const workflow: any = await this.findWorkflow(this.getId(req as any));

      if (!workflow)
        return ReE(res, RESOURCE_NOT_FOUND, "Workflow not found");

      if (!req.files?.documents)
        return ReE(res, BAD_REQUEST_CODE, "Documents required");

      const docs = await uploadFiles({
        category: UploadCategory.DOCUMENT,
        files: req.files.documents as UploadedFile | UploadedFile[],
        entityId: workflow.id,
        multiple: true,
      });

      const existingDocs = workflow.documents_from_installer || [];

      await quoteWorkflowRepository.updateById(workflow.id, {
        $set: { documents_from_installer: [...existingDocs, ...docs] },
      });

      return ReS(res, SUCCESS_CODE, "Documents uploaded", docs);
    } catch (err) {
      return ReE(res, SERVER_ERROR_CODE, (err as Error)?.message || "Server error");
    }
  }

  /* ================= DELETE ================= */

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const workflow = await this.findWorkflow(this.getId(req));

      if (!workflow)
        return ReE(res, RESOURCE_NOT_FOUND, "Workflow not found");

      await quoteWorkflowRepository.deleteById(this.getId(req));

      return ReS(res, SUCCESS_CODE, "Workflow deleted");
    } catch (err) {
      return ReE(res, SERVER_ERROR_CODE, (err as Error)?.message || "Server error");
    }
  }
}

export default new QuoteWorkflowController();
