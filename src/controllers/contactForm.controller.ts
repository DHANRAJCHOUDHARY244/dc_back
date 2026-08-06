import { Request, Response } from "express";
import {
  contactFormRepository,
  roleRepository,
  userRepository,
} from "@repositories";
import {
  ContactFormPaginationFilterRequest,
  ContactFormPayload,
} from "@constants/contactForm.constants";
import { SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import {
  generate_Hash_Password,
  generateRandomString,
  ReE,
  ReS,
} from "@services/generalHelper.service";
import { Roles } from "src/data/dataInserter";
import { AuthenticatedRequest } from "@constants/common.interface";
import { createEnquiryLead } from "@services/leadWorkflow.service";

class ContactFormController {
  async addAppendUser(data: ContactFormPayload) {
    try {
      const { address, email, mobile, name, subsurb: city } = data;
      const user = await userRepository.findOne({
        email: email.toLowerCase(),
      });
      if (user) return;
      const hashedPassword = await generate_Hash_Password(
        generateRandomString(7),
      );
      const roleDoc: any = await roleRepository.findOne(
        { name: Roles.CUSTOMER },
        { select: "id", lean: true },
      );
      const roleId = roleDoc?.id ?? null;
      await userRepository.create({
        name,
        username: email,
        email: email.toLowerCase(),
        mobile_no: mobile,
        address,
        city,
        password: hashedPassword,
        role_id: roleId,
      });
      return true;
    } catch (error) {
      console.error(`Error in addAppendUser: ${error}`);
    }
  }
  async handleContactFormSubmission(req: Request, res: Response) {
    try {
      const payload: ContactFormPayload = req.body;
      
      const saved = await contactFormRepository.create({
        ...payload,
        consent: "YES",
        interested_in: payload.interested_in,
        heard_about_us: payload.heard_about_us,
      });
      await this.addAppendUser(payload);

      let leadResult: any = null;
      try {
        leadResult = await createEnquiryLead({
          name: payload.name,
          phone: payload.mobile,
          email: payload.email,
          address: payload.address,
          postcode: payload.postcode,
          state: payload.subsurb,
          source: "Website",
          property_type: payload.select_property_type,
          interested_in: payload.interested_in,
          note: payload.message,
          preferred_contact: "WhatsApp",
          cf_id: (saved as any)?.id,
        });
      } catch (leadErr) {
        console.error("Contact form → lead sync failed:", leadErr);
      }

      return ReS(res, SUCCESS_CODE, "DATA SAVED SUCCESSFULLY", {
        success: true,
        data: saved,
        lead_id: leadResult?.lead?.id ?? null,
        welcome_message: leadResult?.welcome_message ?? null,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
  async getContactFormSubmissions(req: Request, res: Response) {
    try {
      const {
        limit = 10,
        page = 1,
        name,
        email,
        mobile,
        postcode,
        select_property_type,
        interested_in,
        started_date,
        end_date,
      }: ContactFormPaginationFilterRequest = req.body;

      const filter: any = {};

      if (name) {
        filter.name = { $regex: name, $options: "i" };
      }
      if (email) {
        filter.email = { $regex: email, $options: "i" };
      }
      if (mobile) {
        filter.mobile = { $regex: mobile, $options: "i" };
      }
      if (postcode) {
        filter.postcode = { $regex: postcode, $options: "i" };
      }
      if (select_property_type) {
        filter.select_property_type = { $regex: select_property_type, $options: "i" };
      }
      if (interested_in) {
        filter.interested_in = interested_in;
      }
      if (started_date && end_date) {
        filter.created_at = {
          $gte: new Date(started_date),
          $lte: new Date(end_date),
        };
      } else if (started_date) {
        filter.created_at = { $gte: new Date(started_date) };
      } else if (end_date) {
        filter.created_at = { $lte: new Date(end_date) };
      }

      const { rows: submissions, count: totalItems } =
        await contactFormRepository.findPaginated(filter, {
          page: Number(page),
          limit: Number(limit),
          sort: { created_at: -1 },
          lean: true,
        });

      if (!submissions || submissions.length === 0) {
        return ReS(res, SUCCESS_CODE, "No contact form submissions found", []);
      }

      return ReS(
        res,
        SUCCESS_CODE,
        "Contact form submissions retrieved successfully",
        {
          data: submissions,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
          currentPage: page,
        },
      );
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
  async getContactFormAnalytics(req: Request, res: Response) {
    try {
      const {
        started_date,
        end_date,
      }: { started_date?: string; end_date?: string } = req.query;

      const matchStage: any = { deleted_at: null };
      if (started_date && end_date) {
        matchStage.created_at = {
          $gte: new Date(started_date),
          $lte: new Date(end_date),
        };
      } else if (started_date) {
        matchStage.created_at = { $gte: new Date(started_date) };
      } else if (end_date) {
        matchStage.created_at = { $lte: new Date(end_date) };
      }

      const totalCount = await contactFormRepository.count(matchStage);

      const submissionsByMonth = await contactFormRepository.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, month: "$_id", count: 1 } },
      ]);

      const propertyTypeDistribution = await contactFormRepository.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$select_property_type",
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, select_property_type: "$_id", count: 1 } },
      ]);

      const interestsRaw = await contactFormRepository.find(
        matchStage,
        { select: "interested_in", lean: true },
      );

      const interestsCount: Record<string, number> = {};
      interestsRaw.forEach((row: any) => {
        if (!row.interested_in) return;
        try {
          const parsed = typeof row.interested_in === "string"
            ? JSON.parse(row.interested_in)
            : row.interested_in;
          const interests = Array.isArray(parsed) ? parsed : [parsed];
          interests.forEach((interest: string) => {
            const cleaned = String(interest).replace(/"/g, "").trim();
            if (cleaned) {
              interestsCount[cleaned] = (interestsCount[cleaned] || 0) + 1;
            }
          });
        } catch (e) {
          // skip malformed JSON
        }
      });

      const heardRaw = await contactFormRepository.find(
        matchStage,
        { select: "heard_about_us created_at", lean: true },
      );

      const heardMetrics: { [date: string]: { [source: string]: number } } = {};
      const heardCount: Record<string, number> = {};

      heardRaw.forEach((row: any) => {
        if (!row.heard_about_us) return;
        try {
          const d = new Date(row.created_at);
          if (isNaN(d.getTime())) return;

          const parsed = typeof row.heard_about_us === "string"
            ? JSON.parse(row.heard_about_us)
            : row.heard_about_us;
          const source = String(parsed).replace(/"/g, "").trim();
          if (!source) return;

          const date = d.toISOString().slice(0, 10);
          heardMetrics[date] ??= {};
          heardMetrics[date][source] = (heardMetrics[date][source] || 0) + 1;

          heardCount[source] = (heardCount[source] || 0) + 1;
        } catch (e) {
          // skip malformed JSON
        }
      });

      return ReS(res, SUCCESS_CODE, "Analytics data retrieved successfully", {
        totalCount,
        submissionsByMonth,
        propertyTypeDistribution,
        interestsCount,
        heardCount,
        heardMetrics,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
  async editContactFormUserInfo(req:AuthenticatedRequest, res: Response) {
    try {
      const { email, name, mobile, address, subsurb: suburb, postcode, cf_id, user_id } = req.body;
      if(cf_id){
        await contactFormRepository.updateById(Number(cf_id), {
          $set: { email, name, mobile, address, suburb, postcode },
        });
      }
      if(user_id){
        await userRepository.updateById(Number(user_id), {
          $set: { email, name, mobile_no: mobile, address, city: suburb },
        });
      }
      return ReS(res, SUCCESS_CODE, "User info updated successfully", {
        success: true,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}
export default new ContactFormController();
