import { AuthenticatedRequest } from "@constants/common.interface";
import {
  BAD_REQUEST_CODE,
  RESOURCE_NOT_FOUND,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import {
  assessmentRepository,
  quoteRepository,
  quoteWorkflowRepository,
  siteInfoRepository,
  userRepository,
} from "@repositories";
import { bypassTokenCreation, ReE, ReS } from "@services/generalHelper.service";
import { Response } from "express";
import { sendEmail } from "@utils/email";
import notificationController from "./notification.controller";
import { createOrSyncInstallerJob } from "@services/installerJob.service";

const buildSiteInfoLink = (quoteId: number, token: string, assessmentId?: number) => {
  return `${process.env.FRONT_URL}/#/site-info?token=${token}`;
};

const resolveInstallerRecipient = async (siteInfo: any, quote: any) => {
  let email: string | null = null;
  let name = "Installer";
  if (siteInfo.installer_id && siteInfo.installer) {
    email = siteInfo.installer.email;
    name = siteInfo.installer.name || siteInfo.installer.email || name;
  } else {
    email = siteInfo.installer_email || null;
    name = siteInfo.installer_name || siteInfo.installer_email || name;
  }
  const quoteData = quote as any;
  const address = quoteData.assessment?.address || quoteData.address || "";
  return { email, name, address };
};

const buildSiteInfoEmailTemplate = ({
  recipientName,
  senderName,
  quoteId,
  assessmentId,
  address,
  link,
  isFollowUp = false,
}: {
  recipientName: string;
  senderName: string;
  quoteId: number;
  assessmentId?: number;
  address?: string;
  link: string;
  isFollowUp?: boolean;
}) => {
  const intro = isFollowUp
    ? `This is a friendly follow-up regarding the site assessment information shared with you. Please review the details and complete any required actions.`
    : `${senderName} has shared site assessment information with you. Please review the details below and click the button to view the complete site information.`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1d1d1f;">
      <div style="max-width: 600px; margin: 0 auto; padding: 32px; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="margin: 0; color: #1d1d1f; font-weight: 600; font-size: 22px;">Site Assessment Information</h2>
        </div>
        
        <p style="margin: 0 0 12px;">Hello <strong>${recipientName}</strong>,</p>
        
        <p style="margin: 0 0 16px;">
          ${intro}
        </p>
        
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px;"><strong>Quote ID:</strong> #${quoteId}</p>
          ${assessmentId ? `<p style="margin: 0 0 8px;"><strong>Assessment ID:</strong> #${assessmentId}</p>` : ""}
          ${address ? `<p style="margin: 0;"><strong>Site Address:</strong> ${address}</p>` : ""}
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${link}" target="_blank" style="display: inline-block; background: linear-gradient(to right, #7cbb3b, #219753); color: #ffffff; font-size: 16px; font-weight: bold; padding: 14px 28px; border-radius: 8px; text-decoration: none;">
            View Site Information
          </a>
        </div>
        
        <p style="margin: 16px 0 0; font-size: 14px; color: #6b7280;">
          If you have any questions, please reply to this email or contact us directly.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        
        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
          &copy; ${new Date().getFullYear()} Som's Energy. All rights reserved.
        </p>
      </div>
    </div>
  `;
};

const siteInfoInstallerPopulate = {
  path: "installer",
  select: "id name email mobile_no address",
};

class SiteInfo {
  async getSiteInfo(req: AuthenticatedRequest, res: Response) {
    try {
      const quote_id = req.query.quote_id ? Number(req.query.quote_id) : req.user?.quote_id;
      const assessment_id = req.query.assessment_id ? Number(req.query.assessment_id) : req.user?.assessment_id;
      if (!quote_id)
        return ReE(res, BAD_REQUEST_CODE, "quote_id is required");

      const quoteFilter: Record<string, unknown> = { id: quote_id };
      if (assessment_id) quoteFilter.assessment_id = assessment_id;

      const quotePopulate: any[] = assessment_id
        ? [{ path: "assessment", select: "-deleted_at -updated_at -token" }]
        : [];

      const [quoteData, siteInfos] = await Promise.all([
        quoteRepository.findOne(quoteFilter, {
          select: "id name address mobile_no items manual_attachments",
          populate: quotePopulate,
          lean: true,
        }),
        siteInfoRepository.find(
          { quote_id, ...(assessment_id ? { assessment_id } : {}) },
          { populate: siteInfoInstallerPopulate, lean: true },
        ),
      ]);

      if (!quoteData)
        return ReE(res, RESOURCE_NOT_FOUND, "Quote not found");

      const data: any = { ...quoteData };
      if (Array.isArray(data.items)) {
        data.items = data.items.map(
          ({ name, quantity, attachments, description, moreDescription }: any) =>
            ({ name, quantity, attachments, description, moreDescription })
        );
      }
      data.site_info = siteInfos;

      const site_info_id = req.user?.site_info_id;
      if (site_info_id) {
        data.current_site_info = await siteInfoRepository.findById(Number(site_info_id), {
          populate: siteInfoInstallerPopulate,
          lean: true,
        });
      }

      return ReS(res, SUCCESS_CODE, "Site info fetched successfully", data);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong while fetching site info");
    }
  }

  async createSiteInfo(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        quote_id,
        assessment_id = null,
        installation_date,
        installer_id = null,
        installation_time = "",
        job_type = "MIXED",
        installer_name = null,
        installer_email = null,
        installer_phone = null,
        installer_address = null,
        installer_mobile_no = null,
        installer_details = null,
        send_email = false,
      } = req.body;

      if (!quote_id || !installation_date)
        return ReE(res, BAD_REQUEST_CODE, "quote_id and installation_date are required");

      const hasInstallerId = installer_id != null && installer_id !== "";
      const hasInstallerDetails = installer_name || installer_email;
      if (!hasInstallerId && !hasInstallerDetails)
        return ReE(res, BAD_REQUEST_CODE, "Provide either installer_id or installer details (name, email)");

      const quote = await quoteRepository.findById(Number(quote_id));
      if (!quote) return ReE(res, RESOURCE_NOT_FOUND, "Quote not found");

      if (hasInstallerId) {
        const installer = await userRepository.findById(Number(installer_id));
        if (!installer) return ReE(res, RESOURCE_NOT_FOUND, "Installer not found");
      }

      const siteInfo:any = await siteInfoRepository.create({
        quote_id,
        assessment_id,
        installation_date,
        installation_time,
        job_type,
        installer_id: hasInstallerId ? installer_id : null,
        installer_name: hasInstallerDetails ? installer_name : null,
        installer_email: hasInstallerDetails ? installer_email : null,
        installer_phone: hasInstallerDetails ? installer_phone : null,
        installer_address: hasInstallerDetails ? installer_address : null,
        installer_mobile_no: hasInstallerDetails ? installer_mobile_no : null,
        installer_details,
      });
      const quoteWorkflowData = await quoteWorkflowRepository.findOne({ quote_id });
      if (quoteWorkflowData) {
        await quoteWorkflowRepository.updateById((quoteWorkflowData as any).id, {
          $set: { quote_id, workflow_status: "SITE_INFO_PROVIDED", installer_id: installer_id || null },
        });
      }
      const created: any = await siteInfoRepository.findById(siteInfo.id, {
        populate: siteInfoInstallerPopulate,
        lean: true,
      });

      if (created.installer_id) {
        try {
          const job = await createOrSyncInstallerJob({
            siteInfo: created,
            assignedBy: Number(req.user?.id),
            installationTime: installation_time,
            jobType: job_type,
          });
          if (job && created.installer_id) {
            await notificationController.createNotification({
              userId: Number(created.installer_id),
              message: `New installation job assigned — ${(job as any).job_number || "Job"}`,
              route: `/installer-jobs/job/${(job as any).id}`,
              meta: { type: "INSTALLER_JOB_ASSIGNED", job_id: (job as any).id, site_info_id: created.id },
            });
          }
        } catch (err) {
          console.error("Auto installer job creation failed:", err);
        }
      }

      if (send_email) {
        (async () => {
          try {
            const quote = await quoteRepository.findById(Number(quote_id), {
              populate: assessment_id
                ? [{ path: "assessment", select: "id fullName address" }]
                : [],
              lean: true,
            });
            const { email, name, address } = await resolveInstallerRecipient(created, quote || {});
            if (email) {
              const tokenPayload: any = { quote_id, site_info_id: created.id };
              if (created.installer_id) tokenPayload.id = created.installer_id;
              if (assessment_id) tokenPayload.assessment_id = assessment_id;
              const token = bypassTokenCreation(tokenPayload);
              const link = buildSiteInfoLink(quote_id, token, assessment_id);
              const html = buildSiteInfoEmailTemplate({
                recipientName: name,
                senderName: req.user?.name || "SOMS Team",
                quoteId: quote_id,
                assessmentId: assessment_id,
                address,
                link,
              });
              await sendEmail(email, `Site Assessment Information - Quote #${quote_id}`, html);
              await notificationController.createNotification({
                userId: req.user.id,
                message: `Site info sent for Quote #${quote_id}.`,
                route: link,
                meta: { quoteId: quote_id, recipientEmail: email, recipientName: name, type: "SITE_INFO" },
              });
            }
          } catch (err) {
            console.error("Site info send email on create failed:", err);
          }
        })();
      }
      return ReS(res, SUCCESS_CODE, "Site info created successfully", created);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong while creating site info");
    }
  }

  async getSiteInfoByInstaller(req: AuthenticatedRequest, res: Response) {
    try {
      const installer_id = Number(req.params.installerId);
      const siteInfos = await siteInfoRepository.find(
        { installer_id },
        {
          populate: [
            { path: "quote", select: "id name address" },
            { path: "assessment", select: "id fullName address" },
          ],
          lean: true,
        },
      );
      return ReS(res, SUCCESS_CODE, "Site info fetched successfully", siteInfos);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }

  async getSiteInfoById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const siteInfo = await siteInfoRepository.findById(id, {
        populate: [
          siteInfoInstallerPopulate,
          { path: "quote", select: "id name address mobile_no" },
          { path: "assessment", select: "id fullName address" },
        ],
        lean: true,
      });
      if (!siteInfo) return ReE(res, RESOURCE_NOT_FOUND, "Site info not found");
      return ReS(res, SUCCESS_CODE, "Site info fetched successfully", siteInfo);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong while fetching site info");
    }
  }

  async updateSiteInfo(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const siteInfo = await siteInfoRepository.findById(id);
      if (!siteInfo) return ReE(res, RESOURCE_NOT_FOUND, "Site info not found");

      const {
        installation_date,
        installer_id,
        installation_time,
        job_type,
        installer_name,
        installer_email,
        installer_phone,
        installer_address,
        installer_mobile_no,
        installer_details,
        send_email = false,
      } = req.body;

      const updates: any = {};
      if (installation_date != null) updates.installation_date = installation_date;
      if (installation_time !== undefined) updates.installation_time = installation_time;
      if (job_type !== undefined) updates.job_type = job_type;
      if (installer_id !== undefined) updates.installer_id = installer_id;
      if (installer_name !== undefined) updates.installer_name = installer_name;
      if (installer_email !== undefined) updates.installer_email = installer_email;
      if (installer_phone !== undefined) updates.installer_phone = installer_phone;
      if (installer_address !== undefined) updates.installer_address = installer_address;
      if (installer_mobile_no !== undefined) updates.installer_mobile_no = installer_mobile_no;
      if (installer_details !== undefined) updates.installer_details = installer_details;

      await siteInfoRepository.updateById(id, { $set: updates });
      const updated: any = await siteInfoRepository.findById(id, {
        populate: siteInfoInstallerPopulate,
        lean: true,
      });

      if (updated?.installer_id) {
        try {
          const job = await createOrSyncInstallerJob({
            siteInfo: updated,
            assignedBy: Number(req.user?.id),
            installationTime: updated.installation_time,
            jobType: updated.job_type,
          });
          if (job) {
            await notificationController.createNotification({
              userId: Number(updated.installer_id),
              message: `Job pack updated for Quote #${updated.quote_id}`,
              route: `/installer-jobs/job/${(job as any).id}`,
              meta: { type: "INSTALLER_JOB_UPDATED", job_id: (job as any).id, site_info_id: updated.id },
            });
          }
        } catch (err) {
          console.error("Installer job sync on site info update failed:", err);
        }
      }

      if (send_email) {
        (async () => {
          try {
            const quote = await quoteRepository.findById(updated.quote_id, {
              populate: updated.assessment_id
                ? [{ path: "assessment", select: "id fullName address" }]
                : [],
              lean: true,
            });
            const { email, name, address } = await resolveInstallerRecipient(updated, quote || {});
            if (email) {
              const tokenPayload: any = { quote_id: updated.quote_id, site_info_id: updated.id };
              if (updated.installer_id) tokenPayload.id = updated.installer_id;
              if (updated.assessment_id) tokenPayload.assessment_id = updated.assessment_id;
              const token = bypassTokenCreation(tokenPayload);
              const link = buildSiteInfoLink(updated.quote_id, token, updated.assessment_id);
              const html = buildSiteInfoEmailTemplate({
                recipientName: name,
                senderName: req.user?.name || "SOMS Team",
                quoteId: updated.quote_id,
                assessmentId: updated.assessment_id,
                address,
                link,
              });
              await sendEmail(email, `Site Assessment Information - Quote #${updated.quote_id}`, html);
              await notificationController.createNotification({
                userId: req.user.id,
                message: `Site info sent for Quote #${updated.quote_id}.`,
                route: link,
                meta: { quoteId: updated.quote_id, recipientEmail: email, recipientName: name, type: "SITE_INFO" },
              });
            }
          } catch (err) {
            console.error("Site info send email on update failed:", err);
          }
        })();
      }
      return ReS(res, SUCCESS_CODE, "Site info updated successfully", updated);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong while updating site info");
    }
  }

  async sendSiteInfoEmail(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const siteInfo: any = await siteInfoRepository.findById(id, {
        populate: siteInfoInstallerPopulate,
        lean: true,
      });
      if (!siteInfo) return ReE(res, RESOURCE_NOT_FOUND, "Site info not found");

      const quote = await quoteRepository.findById(siteInfo.quote_id, {
        populate: siteInfo.assessment_id
          ? [{ path: "assessment", select: "id fullName address" }]
          : [],
        lean: true,
      });
      const { email, name, address } = await resolveInstallerRecipient(siteInfo, quote || {});
      if (!email) return ReE(res, BAD_REQUEST_CODE, "Installer email not found");

      const tokenPayload: any = { quote_id: siteInfo.quote_id, site_info_id: siteInfo.id };
      if (siteInfo.installer_id) tokenPayload.id = siteInfo.installer_id;
      if (siteInfo.assessment_id) tokenPayload.assessment_id = siteInfo.assessment_id;
      const token = bypassTokenCreation(tokenPayload);
      const link = buildSiteInfoLink(siteInfo.quote_id, token, siteInfo.assessment_id);
      const html = buildSiteInfoEmailTemplate({
        recipientName: name,
        senderName: req.user?.name || "SOMS Team",
        quoteId: siteInfo.quote_id,
        assessmentId: siteInfo.assessment_id,
        address,
        link,
      });
      await sendEmail(email, `Site Assessment Information - Quote #${siteInfo.quote_id}`, html);
      await notificationController.createNotification({
        userId: req.user.id,
        message: `Site info resent for Quote #${siteInfo.quote_id}.`,
        route: link,
        meta: { quoteId: siteInfo.quote_id, recipientEmail: email, recipientName: name, type: "SITE_INFO" },
      });
      return ReS(res, SUCCESS_CODE, "Site info email sent successfully", { link });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong while sending site info email");
    }
  }

  async sendSiteInfoFollowUp(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const siteInfo: any = await siteInfoRepository.findById(id, {
        populate: siteInfoInstallerPopulate,
        lean: true,
      });
      if (!siteInfo) return ReE(res, RESOURCE_NOT_FOUND, "Site info not found");

      const quote = await quoteRepository.findById(siteInfo.quote_id, {
        populate: siteInfo.assessment_id
          ? [{ path: "assessment", select: "id fullName address" }]
          : [],
        lean: true,
      });
      const { email, name, address } = await resolveInstallerRecipient(siteInfo, quote || {});
      if (!email) return ReE(res, BAD_REQUEST_CODE, "Installer email not found");

      const tokenPayload: any = { quote_id: siteInfo.quote_id, site_info_id: siteInfo.id };
      if (siteInfo.installer_id) tokenPayload.id = siteInfo.installer_id;
      if (siteInfo.assessment_id) tokenPayload.assessment_id = siteInfo.assessment_id;
      const token = bypassTokenCreation(tokenPayload);
      const link = buildSiteInfoLink(siteInfo.quote_id, token, siteInfo.assessment_id);
      const html = buildSiteInfoEmailTemplate({
        recipientName: name,
        senderName: req.user?.name || "SOMS Team",
        quoteId: siteInfo.quote_id,
        assessmentId: siteInfo.assessment_id,
        address,
        link,
        isFollowUp: true,
      });
      await sendEmail(email, `Follow-up: Site Assessment Information - Quote #${siteInfo.quote_id}`, html);
      await notificationController.createNotification({
        userId: req.user.id,
        message: `Site info follow-up sent for Quote #${siteInfo.quote_id}.`,
        route: link,
        meta: { quoteId: siteInfo.quote_id, recipientEmail: email, recipientName: name, type: "SITE_INFO_FOLLOW_UP" },
      });
      return ReS(res, SUCCESS_CODE, "Follow-up email sent successfully", { link });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong while sending follow-up email");
    }
  }

  async deleteSiteInfo(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const siteInfo = await siteInfoRepository.findById(id);
      if (!siteInfo) return ReE(res, RESOURCE_NOT_FOUND, "Site info not found");
      await siteInfoRepository.deleteById(id);
      return ReS(res, SUCCESS_CODE, "Site info deleted successfully");
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong while deleting site info");
    }
  }
}

export default new SiteInfo();
