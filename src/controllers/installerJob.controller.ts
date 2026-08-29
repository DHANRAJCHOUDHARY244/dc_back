import { INSTALLER_AVAILABILITY_STATUSES, INSTALLER_JOB_STATUSES } from "@constants/installerJob.constants";
import { AuthenticatedRequest } from "@constants/common.interface";
import {
  BAD_REQUEST_CODE,
  RESOURCE_NOT_FOUND,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import { installerAvailabilityRepository, installerJobRepository } from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import {
  checklistComplete,
  createOrSyncInstallerJob,
  getAllJobsDashboardStats,
  getInstallerProfileHeader,
  refreshInstallerJobPack,
} from "@services/installerJob.service";
import { UploadCategory } from "@constants/common.enum";
import { uploadFiles } from "@utils/fileUpload.helper";
import { Response } from "express";
import fileUpload from "express-fileupload";
import notificationController from "./notification.controller";
import { Roles } from "src/data/dataInserter";

const ADMIN_ROLES = new Set([
  Roles.SUPER_ADMIN,
  Roles.ADMIN,
  Roles.CEO,
  Roles.MANAGER,
  Roles.OPERATIONS_MANAGER,
]);

function isAdmin(role?: string) {
  return role ? ADMIN_ROLES.has(String(role).toUpperCase() as any) : false;
}

function installerScope(req: AuthenticatedRequest, requestedInstallerId?: number): number | null {
  const role = String(req.user?.role || "").toUpperCase();
  const userId = Number(req.user?.id);
  if (isAdmin(role)) return requestedInstallerId ?? null;
  if (role === Roles.INSTALLER) return userId;
  return requestedInstallerId ?? userId;
}

async function assertJobAccess(req: AuthenticatedRequest, job: any) {
  const scopedInstaller = installerScope(req);
  if (!isAdmin(String(req.user?.role)) && scopedInstaller && Number(job.installer_id) !== scopedInstaller) {
    throw new Error("You do not have access to this job");
  }
}

async function notifyInstaller(userId: number, message: string, route: string, meta: Record<string, unknown> = {}) {
  try {
    await notificationController.createNotification({ userId, message, route, meta });
  } catch (e) {
    console.error("Installer job notification failed:", e);
  }
}

class InstallerJobController {
  async dashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const installerId = installerScope(req, req.query.installer_id ? Number(req.query.installer_id) : undefined);
      if (!installerId && isAdmin(String(req.user?.role))) {
        const stats = await getAllJobsDashboardStats();
        return ReS(res, SUCCESS_CODE, "Installer dashboard fetched", {
          installer: null,
          stats,
          all_installers: true,
        });
      }
      const header = await getInstallerProfileHeader(installerId!);
      return ReS(res, SUCCESS_CODE, "Installer dashboard fetched", header);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to load dashboard");
    }
  }

  async listJobs(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1, limit = 20, status, installer_id, site_info_id, from, to } = req.body || {};
      const scopedInstaller = installerScope(req, installer_id ? Number(installer_id) : undefined);
      const filter: Record<string, unknown> = {};
      if (scopedInstaller) filter.installer_id = scopedInstaller;
      if (site_info_id) filter.site_info_id = Number(site_info_id);
      if (status) filter.status = status;
      if (from || to) {
        filter.installation_date = {};
        if (from) (filter.installation_date as any).$gte = new Date(from);
        if (to) (filter.installation_date as any).$lte = new Date(to);
      }

      const { count, rows } = await installerJobRepository.findPaginated(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: { installation_date: 1 },
        populate: [
          { path: "installer", select: "id name email mobile_no" },
          { path: "quote", select: "id name address mobile_no" },
        ],
        lean: true,
      });

      return ReS(res, SUCCESS_CODE, "Installer jobs fetched", {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)) || 1,
        data: rows,
      });
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to list jobs");
    }
  }

  async getJob(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const job: any = await installerJobRepository.findById(id, {
        populate: [
          { path: "installer", select: "id name email mobile_no address" },
          { path: "quote", select: "id name address mobile_no items manual_attachments green_sketch" },
          { path: "assessment" },
          { path: "site_info" },
        ],
        lean: true,
      });
      if (!job) return ReE(res, RESOURCE_NOT_FOUND, "Job not found");

      await assertJobAccess(req, job);
      return ReS(res, SUCCESS_CODE, "Job fetched", job);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to fetch job");
    }
  }

  async assignFromSiteInfo(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        site_info_id,
        installer_id,
        installation_date,
        installation_time = "",
        job_type = "MIXED",
      } = req.body;

      if (!site_info_id || !installer_id || !installation_date) {
        return ReE(res, BAD_REQUEST_CODE, "site_info_id, installer_id and installation_date are required");
      }

      const { siteInfoRepository } = await import("@repositories");
      const siteInfo: any = await siteInfoRepository.updateById(Number(site_info_id), {
        $set: {
          installer_id: Number(installer_id),
          installation_date: new Date(installation_date),
          installation_time,
          job_type,
        },
      });
      if (!siteInfo) return ReE(res, RESOURCE_NOT_FOUND, "Site info not found");

      const job = await createOrSyncInstallerJob({
        siteInfo,
        assignedBy: Number(req.user?.id),
        installationTime: installation_time,
        jobType: job_type,
      });

      await notifyInstaller(
        Number(installer_id),
        `New installation job assigned — ${job?.job_number || "Job"}`,
        `/installer-jobs/job/${job?.id}`,
        { type: "INSTALLER_JOB_ASSIGNED", job_id: job?.id, site_info_id },
      );

      return ReS(res, SUCCESS_CODE, "Installer job assigned successfully", job);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to assign job");
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const { status, note } = req.body;
      if (!status || !INSTALLER_JOB_STATUSES.includes(status)) {
        return ReE(res, BAD_REQUEST_CODE, "Valid status is required");
      }

      const job: any = await installerJobRepository.findById(id, { lean: true });
      if (!job) return ReE(res, RESOURCE_NOT_FOUND, "Job not found");

      try {
        await assertJobAccess(req, job);
      } catch (e: any) {
        return ReE(res, BAD_REQUEST_CODE, e.message);
      }

      if (status === "JOB_COMPLETED" && !checklistComplete(job.checklist)) {
        return ReE(res, BAD_REQUEST_CODE, "Complete all mandatory checklist items before marking job completed");
      }

      const update: Record<string, unknown> = { status };
      if (status === "CONFIRMED") update.confirmed_at = new Date();
      if (status === "JOB_COMPLETED") update.completed_at = new Date();
      if (status === "CANCELLED") update.cancelled_at = new Date();

      const messages = Array.isArray(job.messages) ? [...job.messages] : [];
      if (note) {
        messages.push({
          id: Date.now(),
          author_id: req.user?.id,
          author_role: req.user?.role,
          message: note,
          created_at: new Date().toISOString(),
        });
        update.messages = messages;
      }

      const updated = await installerJobRepository.updateById(id, { $set: update });

      const statusNotifyTarget =
        String(req.user?.role).toUpperCase() === Roles.INSTALLER ? job.assigned_by : job.installer_id;
      if (statusNotifyTarget) {
        await notifyInstaller(
          Number(statusNotifyTarget),
          `Job ${job.job_number} status updated to ${status.replace(/_/g, " ").toLowerCase()}`,
          `/installer-jobs/job/${job.id}`,
          { type: "INSTALLER_JOB_STATUS", job_id: job.id, status },
        );
      }

      return ReS(res, SUCCESS_CODE, "Job status updated", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to update status");
    }
  }

  async updateChecklist(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const { checklist } = req.body;
      if (!Array.isArray(checklist)) return ReE(res, BAD_REQUEST_CODE, "checklist array required");

      const job: any = await installerJobRepository.findById(id, { lean: true });
      if (!job) return ReE(res, RESOURCE_NOT_FOUND, "Job not found");

      try {
        await assertJobAccess(req, job);
      } catch (e: any) {
        return ReE(res, BAD_REQUEST_CODE, e.message);
      }

      const normalized = checklist.map((item: any) => ({
        ...item,
        completed_at: item.completed ? item.completed_at || new Date().toISOString() : null,
      }));

      const updated = await installerJobRepository.updateById(id, { $set: { checklist: normalized } });
      return ReS(res, SUCCESS_CODE, "Checklist updated", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to update checklist");
    }
  }

  async updateSerials(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const { serial_numbers } = req.body;
      const job: any = await installerJobRepository.findById(id, { lean: true });
      if (!job) return ReE(res, RESOURCE_NOT_FOUND, "Job not found");

      try {
        await assertJobAccess(req, job);
      } catch (e: any) {
        return ReE(res, BAD_REQUEST_CODE, e.message);
      }

      const updated = await installerJobRepository.updateById(id, { $set: { serial_numbers } });
      return ReS(res, SUCCESS_CODE, "Serial numbers updated", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to update serial numbers");
    }
  }

  async addMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const { message } = req.body;
      if (!message?.trim()) return ReE(res, BAD_REQUEST_CODE, "message is required");

      const job: any = await installerJobRepository.findById(id, { lean: true });
      if (!job) return ReE(res, RESOURCE_NOT_FOUND, "Job not found");

      const messages = Array.isArray(job.messages) ? [...job.messages] : [];
      messages.push({
        id: Date.now(),
        author_id: req.user?.id,
        author_role: req.user?.role,
        message: message.trim(),
        created_at: new Date().toISOString(),
      });

      const updated = await installerJobRepository.updateById(id, { $set: { messages } });

      const notifyTarget =
        String(req.user?.role).toUpperCase() === Roles.INSTALLER ? job.assigned_by : job.installer_id;
      if (notifyTarget) {
        await notifyInstaller(
          Number(notifyTarget),
          `New job message on ${job.job_number}`,
          `/installer-jobs/job/${job.id}`,
          { type: "INSTALLER_JOB_MESSAGE", job_id: job.id },
        );
      }

      return ReS(res, SUCCESS_CODE, "Message added", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to add message");
    }
  }

  async refreshPack(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await refreshInstallerJobPack(id);
      if (!updated) return ReE(res, RESOURCE_NOT_FOUND, "Job not found");
      return ReS(res, SUCCESS_CODE, "Job pack refreshed from site information", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to refresh job pack");
    }
  }

  async listAvailability(req: AuthenticatedRequest, res: Response) {
    try {
      const installerId = installerScope(req, req.query.installer_id ? Number(req.query.installer_id) : undefined);
      if (!installerId) {
        return ReE(res, BAD_REQUEST_CODE, "installer_id is required");
      }
      const from = req.query.from ? new Date(String(req.query.from)) : new Date();
      const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      const rows = await installerAvailabilityRepository.find(
        {
          installer_id: installerId,
          slot_date: { $gte: from, $lte: to },
        },
        { sort: { slot_date: 1 }, lean: true },
      );

      return ReS(res, SUCCESS_CODE, "Availability fetched", rows);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to fetch availability");
    }
  }

  async upsertAvailability(req: AuthenticatedRequest, res: Response) {
    try {
      const installerId = installerScope(req, req.body.installer_id ? Number(req.body.installer_id) : undefined);
      if (!installerId) {
        return ReE(res, BAD_REQUEST_CODE, "installer_id is required");
      }
      const { slot_date, start_time = "", end_time = "", status = "AVAILABLE", notes = "", job_id = null } =
        req.body;

      if (!slot_date) return ReE(res, BAD_REQUEST_CODE, "slot_date is required");
      if (!INSTALLER_AVAILABILITY_STATUSES.includes(status)) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid availability status");
      }

      const date = new Date(slot_date);
      const existing: any = await installerAvailabilityRepository.findOne(
        { installer_id: installerId, slot_date: date, start_time, end_time },
        { lean: true },
      );

      const payload = {
        installer_id: installerId,
        slot_date: date,
        start_time,
        end_time,
        status,
        notes,
        job_id,
      };

      const saved = existing
        ? await installerAvailabilityRepository.updateById(existing.id, { $set: payload })
        : await installerAvailabilityRepository.create(payload);

      return ReS(res, SUCCESS_CODE, "Availability saved", saved);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to save availability");
    }
  }

  async uploadFiles(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const job: any = await installerJobRepository.findById(id, { lean: true });
      if (!job) return ReE(res, RESOURCE_NOT_FOUND, "Job not found");

      try {
        await assertJobAccess(req, job);
      } catch (e: any) {
        return ReE(res, BAD_REQUEST_CODE, e.message);
      }

      const files = req.files as fileUpload.FileArray | undefined;
      const raw = files?.files;
      if (!raw) return ReE(res, BAD_REQUEST_CODE, "No files uploaded");

      const uploaded = await uploadFiles({
        category: UploadCategory.INSTALLER_JOB,
        files: raw,
        entityId: id,
        multiple: true,
        maxSizeMB: 100,
      });

      const category = String(req.body?.category || "installation_photo");
      const entries = (Array.isArray(uploaded) ? uploaded : [uploaded]).map((file) => ({
        ...file,
        category,
        uploaded_by: req.user?.id,
        uploaded_at: new Date().toISOString(),
      }));

      const uploads = Array.isArray(job.uploads) ? [...job.uploads, ...entries] : entries;
      const updated = await installerJobRepository.updateById(id, { $set: { uploads } });

      const notifyTarget =
        String(req.user?.role).toUpperCase() === Roles.INSTALLER ? job.assigned_by : job.installer_id;
      if (notifyTarget) {
        await notifyInstaller(
          Number(notifyTarget),
          `New file uploaded for ${job.job_number}`,
          `/installer-jobs/job/${job.id}`,
          { type: "INSTALLER_JOB_DOCUMENT", job_id: job.id },
        );
      }

      return ReS(res, SUCCESS_CODE, "Files uploaded", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to upload files");
    }
  }

  async updateCompletionReport(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const { completion_report } = req.body;
      const job: any = await installerJobRepository.findById(id, { lean: true });
      if (!job) return ReE(res, RESOURCE_NOT_FOUND, "Job not found");

      try {
        await assertJobAccess(req, job);
      } catch (e: any) {
        return ReE(res, BAD_REQUEST_CODE, e.message);
      }

      const updated = await installerJobRepository.updateById(id, {
        $set: { completion_report: String(completion_report || "") },
      });
      return ReS(res, SUCCESS_CODE, "Completion report saved", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to save completion report");
    }
  }

  async calendar(req: AuthenticatedRequest, res: Response) {
    try {
      const installerId = installerScope(req, req.query.installer_id ? Number(req.query.installer_id) : undefined);
      const from = req.query.from ? new Date(String(req.query.from)) : new Date();
      const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);

      const jobFilter: Record<string, unknown> = {
        installation_date: { $gte: from, $lte: to },
        status: { $ne: "CANCELLED" },
      };
      if (installerId) jobFilter.installer_id = installerId;

      const availabilityFilter: Record<string, unknown> = {
        slot_date: { $gte: from, $lte: to },
      };
      if (installerId) availabilityFilter.installer_id = installerId;

      const [jobs, availability] = await Promise.all([
        installerJobRepository.find(
          jobFilter,
          {
            sort: { installation_date: 1 },
            populate: [{ path: "quote", select: "id name address" }],
            lean: true,
          },
        ),
        installerAvailabilityRepository.find(availabilityFilter, { sort: { slot_date: 1 }, lean: true }),
      ]);

      return ReS(res, SUCCESS_CODE, "Installer calendar fetched", { jobs, availability });
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message || "Failed to fetch calendar");
    }
  }
}

export default new InstallerJobController();
