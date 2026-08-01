import { assessmentRepository, roleRepository, userRepository } from "@repositories";
import { Request, Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import {
  ReE,
  ReS,
  generate_Hash_Password,
  bypassTokenCreation,
} from "@services/generalHelper.service";
import {
  FORBIDDEN_CODE,
  RESOURCE_NOT_FOUND,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import { uploadFiles } from "@utils/fileUpload.helper";
import { UploadCategory } from "@constants/common.enum";
import { UploadedFile } from "express-fileupload";
import { Roles } from "src/data/dataInserter";
import {
  buildAssessmentLink,
  notifyAssessmentCreated,
  notifyAssessmentFollowUp,
  notifyAssessmentSubmitted,
  sendAssessmentCreatedEmail,
} from "../services/assessment.service";

const ASSESSMENT_PHOTO_FIELDS: Record<string, string> = {
  photo_bill: "billPhoto",
  photo_meter: "meterPhoto",
  photo_switchOpen: "switchboardOpenPhoto",
  photo_switchClosed: "switchboardClosedPhoto",
  photo_roofFront: "roofFrontPhoto",
  photo_roofWide: "roofWidePhoto",
  photo_shadingObj: "shadingObjectsPhoto",
  photo_batteryWall: "batteryWallPhoto",
  photo_batteryClear: "batteryClearancePhoto",
  photo_batteryPath: "batteryPathPhoto",
  photo_airconIndoor: "airconIndoorPhoto",
  photo_airconOutdoor: "airconOutdoorPhoto",
  photo_airconRoute: "airconRoutePhoto",
  photo_hotwaterCurrent: "hotWaterSystemPhoto",
  photo_heatpumpSpot: "heatPumpLocationPhoto",
  photo_heatpumpDrain: "heatPumpDrainPhoto",
  signaturePhoto: "signaturePhoto",
  photo_floorPlanUpload: "floorPlanPhoto",
};

const parseServices = (value: any) => {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const normalizeBoolean = (value: any) => value === true || value === "true";

const buildAssessmentBaseData = (body: any) => ({
  postcode: body.postcode,
  propertyType: body.propertyType,
  ownership: body.ownership,
  installTimeframe: body.installTimeframe,
  customDate: body.customDate,
  siteAccess: body.siteAccess,
  parking: body.parking,
  pets: body.pets,
  supplyType: body.supplyType,
  switchboardLocation: body.switchboardLocation,
  customSwitchboardLocation: body.customSwitchboardLocation,
  meterType: body.meterType,
  customMeterType: body.customMeterType,
  existingSolar: body.existingSolar,
  existingSolarDetails: body.existingSolarDetails,
  solarSystemSize: body.solarSystemSize,
  switchboardIssues: body.switchboardIssues,
  asbestosRisk: body.asbestosRisk,
  accessConstraints: body.accessConstraints,
  confirmAccuracy: normalizeBoolean(body.confirmAccuracy),
  confirmPermission: normalizeBoolean(body.confirmPermission),
  existingPanels: body.existingPanels,
  panelPlan: body.panelPlan,
  panelCount: body.panelCount,
  panelInstallYear: body.panelInstallYear,
  propertyAge: body.propertyAge,
  existingHeatingSystem: body.existingHeatingSystem,
  airconPreference: body.airconPreference,
  multiHeadWallScope: body.multiHeadWallScope,
  condensatePumpNeeded: body.condensatePumpNeeded,
});

const applyServiceFields = (
  services: string[],
  body: any,
  target: Record<string, any>
) => {
  const serviceFields: Record<string, string[]> = {
    SOLAR: [
      "quarterlyBill",
      "customBillAmount",
      "monitoring",
      "roofType",
      "storeys",
      "roofCondition",
      "shading",
       "existingPanels",
  "panelPlan",
  "panelCount",
  "panelInstallYear",
    ],
    BATTERY: ["batteryLocation", "customBatteryLocation", "batteryDistance"],
    AIRCON: [
      "airconType",
      "indoorUnits",
      "rooms",
      "customRooms",
      "existingAircon",
      "existingAirconDetails",
        "propertyAge",
  "existingHeatingSystem",
  "airconPreference",
  "multiHeadWallScope",
  "condensatePumpNeeded",
    ],
    HEATPUMP: [
      "hotWaterType",
      "heatPumpLocation",
      "customHeatPumpLocation",
      "tankSize",
      "customTankSize",
    ],
  };

  services.forEach((service) => {
    serviceFields[service]?.forEach((field) => {
      if (body[field] !== undefined) {
        target[field] = body[field];
      }
    });
  });
};

const uploadAssessmentPhotos = async (files: any, assessmentId: number) => {
  const updates: Record<string, string> = {};
  if (!files) return updates;

  await Promise.all(
    Object.entries(files).map(async ([fieldName, file]) => {
      const dbColumn = ASSESSMENT_PHOTO_FIELDS[fieldName];
      if (!dbColumn) return;

      const { url } = await uploadFiles({
        category: UploadCategory.ASSESSMENT,
        files: file as UploadedFile,
        entityId: assessmentId,
        allowedTypes: [],
        maxSizeMB: 10,
      });

      updates[dbColumn] = url;
    })
  );

  return updates;
};

const pickFields = (body: any, fields: string[]) => {
  const data: Record<string, any> = {};
  fields.forEach((field) => {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  });
  return data;
};

class AssessmentController {
  async createAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const { fullName, email, mobile, address, postcode, services, sendEmail } =
        req.body;
      const {id:sender_id}=req.user; 
      if (!fullName || !email || !mobile || !address) {
        return ReE(res, FORBIDDEN_CODE, "Missing required customer details");
      }

      if (!services || !Array.isArray(services) || services.length === 0) {
        return ReE(res, FORBIDDEN_CODE, "At least one service must be selected");
      }

      let existingUser: any = await userRepository.findOne({ email });

      let customerId = existingUser?.id;

      if (!existingUser) {
        const customerRole: any = await roleRepository.findOne(
          { name: Roles.CUSTOMER },
          { select: "id", lean: true },
        );

        const newUser: any = await userRepository.create({
          username: email,
          name: fullName,
          email,
          address,
          mobile_no: mobile,
          password: await generate_Hash_Password(email),
          role_id: customerRole?.id,
        });

        customerId = newUser.id;
      }

      const assessment:any = await assessmentRepository.create({
        fullName,
        mobile,
        email,
        address,
        postcode,
        services,
        status: "PENDING",
        sender_id,
        customer_id:customerId
      });

      const token = bypassTokenCreation({ assessment_id: assessment.id,id:customerId});
      const updatedAssessment = await assessmentRepository.updateById(assessment.id, {
        $set: { token },
      });

      const assessmentLink = buildAssessmentLink(assessment.id, token);
      ReS(res, SUCCESS_CODE, "Assessment created and sent to customer", {
        assessment: updatedAssessment,
        assessmentLink,
      });
      const shouldSendEmail =
        sendEmail === undefined ||
        sendEmail === null ||
        (sendEmail !== false && sendEmail !== "false");

      (async () => {
        await notifyAssessmentCreated({
          senderId: sender_id,
          assessment: updatedAssessment,
          customerName: fullName,
          senderName: req.user?.name,
          role: req.user?.role,
          assessmentLink,
        });
        if (shouldSendEmail) {
          await sendAssessmentCreatedEmail({
            email,
            fullName,
            services,
            assessmentLink,
          });
        }
      })().catch((emailError) => {
        console.error("Assessment email/notification failed:", emailError);
      });
      return;
    } catch (error: any) {
      console.error("Create assessment error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async sendAssessmentFollowUp(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.body;
      if (!assessmentId) {
        return ReE(res, FORBIDDEN_CODE, "assessmentId is required");
      }

      const assessment: any = await assessmentRepository.findById(Number(assessmentId));
      if (!assessment) {
        return ReE(res, RESOURCE_NOT_FOUND, "Assessment not found");
      }

      if (!assessment.email) {
        return ReE(res, FORBIDDEN_CODE, "Customer email not found");
      }

      let token = assessment.token;
      if (!token) {
        token = bypassTokenCreation({
          assessment_id: assessment.id,
          id: assessment.customer_id,
        });
        await assessmentRepository.updateById(assessment.id, { $set: { token } });
      }

      const services = Array.isArray(assessment.services)
        ? assessment.services
        : [];

      const assessmentLink = buildAssessmentLink(assessment.id, token);

      await sendAssessmentCreatedEmail({
        email: assessment.email,
        fullName: assessment.fullName || "Customer",
        services,
        assessmentLink,
      });

      await notifyAssessmentFollowUp({
        senderId: req.user.id,
        assessment,
        customerName: assessment.fullName || assessment.email,
        senderName: req.user?.name,
        role: req.user?.role,
        assessmentLink,
      });

      return ReS(res, SUCCESS_CODE, "Follow-up email sent");
    } catch (error: any) {
      console.error("Follow-up assessment error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

async submitAssessment(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body;
    const files = req.files as any;
    
    const { id: customer_id, assessment_id } = req.user;

    const services = parseServices(body.services);
    if (!services) {
      return ReE(res, FORBIDDEN_CODE, "Invalid services format");
    }

    if (!Array.isArray(services) || services.length === 0)
      return ReE(res, FORBIDDEN_CODE, "Select at least one service");

    const assessment:any = await assessmentRepository.findOne({
      id: assessment_id,
      customer_id,
    });

    if (!assessment)
      return ReE(res, RESOURCE_NOT_FOUND, "Assessment not found");

    const assessmentData: any = {
      services,
      ...buildAssessmentBaseData(body),
      status: "IN_REVIEW",
    };
    applyServiceFields(services, body, assessmentData);

    const photoUpdates = await uploadAssessmentPhotos(files, assessment.id);
    Object.assign(assessmentData, photoUpdates);

    const updated = await assessmentRepository.updateById(assessment.id, {
      $set: assessmentData,
    });

    await notifyAssessmentSubmitted({
      senderId: assessment.sender_id,
      assessment: updated,
    });

    return ReS(res, SUCCESS_CODE, "Assessment submitted successfully", updated);

  } catch (error: any) {
    console.error("Assessment submission error:", error);
    return ReE(res, SERVER_ERROR_CODE, error.message);
  }
}

  async getAssessments(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        search,
        service,
        propertyType,
        startDate,
        endDate,
      } = req.query as any;

      const filter: Record<string, unknown> = { deleted_at: null };

      if (status) {
        filter.status = status;
      }

      if (service) {
        const serviceList = Array.isArray(service)
          ? service
          : String(service).split(",");
        filter.services = { $all: serviceList };
      }

      if (propertyType) {
        filter.propertyType = propertyType;
      }

      if (startDate || endDate) {
        filter.created_at = {};
        if (startDate) {
          (filter.created_at as any).$gte = new Date(startDate);
        }
        if (endDate) {
          (filter.created_at as any).$lte = new Date(endDate);
        }
      }

      if (search) {
        filter.$or = [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { mobile: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [rows, countResult] = await Promise.all([
        assessmentRepository.aggregateRaw([
          { $match: filter },
          {
            $lookup: {
              from: "users",
              localField: "customer_id",
              foreignField: "id",
              as: "customer",
            },
          },
          { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "users",
              localField: "sender_id",
              foreignField: "id",
              as: "sender",
            },
          },
          { $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "quotes",
              let: { assessmentId: "$id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$assessment_id", "$$assessmentId"] },
                    deleted_at: null,
                  },
                },
                {
                  $project: {
                    id: 1,
                    customer_accepted: 1,
                    total: 1,
                    created_at: 1,
                  },
                },
              ],
              as: "quote",
            },
          },
          { $unwind: { path: "$quote", preserveNullAndEmptyArrays: true } },
          { $sort: { created_at: -1 } },
          { $skip: skip },
          { $limit: Number(limit) },
        ]),
        assessmentRepository.aggregateRaw([
          { $match: filter },
          { $count: "total" },
        ]),
      ]);

      const count = countResult[0]?.total ?? 0;

      return ReS(res, SUCCESS_CODE, "Assessments fetched successfully", {
        data: rows,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(count / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error("Get assessments error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getAssessmentById(req: AuthenticatedRequest, res: Response) {
    try {
       const { assessment_id } = req.user;

      const assessment = await assessmentRepository.findById(assessment_id);

      if (!assessment) {
        return ReE(res, RESOURCE_NOT_FOUND, "Assessment not found");
      }

      return ReS(
        res,
        SUCCESS_CODE,
        "Assessment fetched successfully",
        assessment
      );
    } catch (error: any) {
      console.error("Get assessment error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getAssessmentByIdNoToken(req: Request, res: Response) {
    try {
      const assessment_id = Number(req.params.id);
      const assessment = await assessmentRepository.findOne(
        { id: assessment_id },
        { select: "id fullName email mobile address postcode", lean: true },
      );
      if (!assessment) {
        return ReE(res, RESOURCE_NOT_FOUND, "Assessment not found");
      }

      return ReS(
        res,
        SUCCESS_CODE,
        "Assessment fetched successfully",
        assessment
      );
    } catch (error) {
        console.error("Get assessment error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async updateAssessmentStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const { status, notes } = req.body;
      const userId = req.user?.id;

      const assessment: any = await assessmentRepository.findById(id);

      if (!assessment) {
        return ReE(res, RESOURCE_NOT_FOUND, "Assessment not found");
      }

      const validStatuses = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED"];
      if (!validStatuses.includes(status)) {
        return ReE(res, FORBIDDEN_CODE, "Invalid status value");
      }

      const updated = await assessmentRepository.updateById(id, {
        $set: {
          status,
          notes: notes || assessment.notes,
          reviewedBy: userId,
          reviewedAt: new Date(),
        },
      });

      return ReS(
        res,
        SUCCESS_CODE,
        "Assessment status updated successfully",
        updated
      );
    } catch (error: any) {
      console.error("Update assessment status error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }


  async updateAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const body = req.body;
      const files = req.files as any;

      const assessment: any = await assessmentRepository.findById(id);

      if (!assessment) {
        return ReE(res, RESOURCE_NOT_FOUND, "Assessment not found");
      }

      let services: string[] | null = null;
      if (body.services !== undefined) {
        services = parseServices(body.services);
        if (!services) {
          return ReE(res, FORBIDDEN_CODE, "Invalid services format");
        }
      }

      const updateData: any = {};
      const fields = [
        "services",
        "fullName",
        "mobile",
        "email",
        "address",
        "postcode",
        "propertyType",
        "ownership",
        "installTimeframe",
        "customDate",
        "siteAccess",
        "parking",
        "pets",
        "supplyType",
        "switchboardLocation",
        "customSwitchboardLocation",
        "meterType",
        "customMeterType",
        "existingSolar",
        "existingSolarDetails",
        "solarSystemSize",
        "quarterlyBill",
        "customBillAmount",
        "monitoring",
        "roofType",
        "storeys",
        "roofCondition",
        "shading",
        "batteryLocation",
        "customBatteryLocation",
        "batteryDistance",
        "airconType",
        "indoorUnits",
        "rooms",
        "customRooms",
        "existingAircon",
        "existingAirconDetails",
        "hotWaterType",
        "heatPumpLocation",
        "customHeatPumpLocation",
        "tankSize",
        "customTankSize",
        "switchboardIssues",
        "asbestosRisk",
        "accessConstraints",
        "confirmAccuracy",
        "confirmPermission",
      ];
      Object.assign(updateData, pickFields(body, fields));

      if (updateData.confirmAccuracy !== undefined) {
        updateData.confirmAccuracy = normalizeBoolean(updateData.confirmAccuracy);
      }
      if (updateData.confirmPermission !== undefined) {
        updateData.confirmPermission = normalizeBoolean(updateData.confirmPermission);
      }

      if (services) {
        updateData.services = services;
        applyServiceFields(services, body, updateData);
      }

      const photoUpdates = await uploadAssessmentPhotos(files, assessment.id);
      Object.assign(updateData, photoUpdates);

      await assessmentRepository.updateById(id, { $set: updateData });

      const updatedAssessment = await assessmentRepository.findById(id);

      return ReS(
        res,
        SUCCESS_CODE,
        "Assessment updated successfully",
        updatedAssessment
      );
    } catch (error: any) {
      console.error("Update assessment error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async deleteAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);

      const assessment = await assessmentRepository.findById(id);

      if (!assessment) {
        return ReE(res, RESOURCE_NOT_FOUND, "Assessment not found");
      }

      await assessmentRepository.deleteById(id);

      return ReS(res, SUCCESS_CODE, "Assessment deleted successfully");
    } catch (error: any) {
      console.error("Delete assessment error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getAssessmentStats(req: AuthenticatedRequest, res: Response) {
    try {
      const [stats] = await assessmentRepository.aggregateRaw([
        { $match: { deleted_at: null } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
            },
            inReview: {
              $sum: { $cond: [{ $eq: ["$status", "IN_REVIEW"] }, 1, 0] },
            },
            approved: {
              $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
            },
            solar: {
              $sum: {
                $cond: [{ $in: ["SOLAR", { $ifNull: ["$services", []] }] }, 1, 0],
              },
            },
            battery: {
              $sum: {
                $cond: [{ $in: ["BATTERY", { $ifNull: ["$services", []] }] }, 1, 0],
              },
            },
            aircon: {
              $sum: {
                $cond: [{ $in: ["AIRCON", { $ifNull: ["$services", []] }] }, 1, 0],
              },
            },
            heatpump: {
              $sum: {
                $cond: [{ $in: ["HEATPUMP", { $ifNull: ["$services", []] }] }, 1, 0],
              },
            },
          },
        },
      ]);

      const total = Number(stats?.total || 0);
      const pending = Number(stats?.pending || 0);
      const inReview = Number(stats?.inReview || 0);
      const approved = Number(stats?.approved || 0);
      const rejected = Number(stats?.rejected || 0);
      const serviceStats = {
        SOLAR: Number(stats?.solar || 0),
        BATTERY: Number(stats?.battery || 0),
        AIRCON: Number(stats?.aircon || 0),
        HEATPUMP: Number(stats?.heatpump || 0),
      };

      return ReS(res, SUCCESS_CODE, "Assessment statistics fetched successfully", {
        total,
        byStatus: {
          pending,
          inReview,
          approved,
          rejected,
        },
        byService: serviceStats,
      });
    } catch (error: any) {
      console.error("Get assessment stats error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
}

export default new AssessmentController();
