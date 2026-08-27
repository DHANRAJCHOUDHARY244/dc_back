// controllers/ductedAssessmentController.ts
import { ductedAssessmentRepository, roleRepository, userRepository } from "@repositories";
import { Request, Response } from "express";
import fileUpload from "express-fileupload";
import { s3Service } from "@services/s3.service";
import { randomUUID } from "crypto";
import { AuthenticatedRequest } from "@constants/common.interface";
import { generate_Hash_Password, generateUUID, ReE, ReS } from "@services/generalHelper.service";
import { FORBIDDEN_CODE, RESOURCE_NOT_FOUND, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { Roles } from "src/data/dataInserter";
import jwt from "jsonwebtoken";

const ductedAssessmentDetailPopulate = [
  { path: "customerDetails", select: "id username name email address mobile_no" },
  { path: "cf", select: "id name email address mobile postcode suburb" },
];

class DuctedAssessmentController {
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { cust_id, cf_id, customer, date, time, assessor, address, email, mobile } = req.body;
      let existingUserId = cust_id;
      if (!cust_id) {
        const existingUser: any = await userRepository.findOne(
          {
            email,
          },
          { select: "id", lean: true },
        );
        if (existingUser) {
          existingUserId = existingUser.id;
        } else {
          const role: any = await roleRepository.findOne(
            { name: Roles.CUSTOMER },
            { select: "id", lean: true },
          );
          const newUser: any = await userRepository.create({
            username: (email || customer).toLowerCase(),
            name: customer,
            email,
            address,
            mobile_no: mobile,
            password: await generate_Hash_Password(email),
            role_id: role?.id,
          });
          existingUserId = newUser.id;
        }
      }
      const token = jwt.sign(
        { id: existingUserId, email, username: customer },
        process.env.JWT_SECRET!
      );
      const newAssessment = await ductedAssessmentRepository.create({ cust_id: existingUserId, cf_id, customer, date, time, assessor, address, email, mobile, token });
      return ReS(res, SUCCESS_CODE, "Assessment created successfully", newAssessment);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async listAll(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1, limit = 10, customer, assessor, building_type: buildingType, date } = req.query as any;

      const filter: Record<string, unknown> = {};
      const orFilters: Record<string, unknown>[] = [];

      if (customer) {
        orFilters.push({ customer: { $regex: customer, $options: "i" } });
      }
      if (assessor) {
        orFilters.push({ assessor: { $regex: assessor, $options: "i" } });
      }
      if (orFilters.length) filter.$or = orFilters;
      if (buildingType) filter.building_type = buildingType;
      if (date) filter.date = date;

      const { rows, count } = await ductedAssessmentRepository.findPaginated(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: { createdAt: -1 },
      });

      return ReS(res, SUCCESS_CODE, "Assessments fetched successfully", {
        data: rows,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(count / Number(limit)),
        },
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id ? Number(req.params.id) : null;
      const { step, data } = req.body;
      const files = req.files as fileUpload.FileArray | undefined;

      const stepFields: Record<number, string[]> = {
        1: ["customer", "address", "date", "time", "assessor", "number_of_stories", "building_type", "construction_type", "property_age", "roof_type", "ceiling_height"],
        2: ["circuit_breaker_spaces", "switch_rating", "phase_type", "distance", "switchboard_photo", "vents_total", "return_air", "zone_controller", "room", "roomArea", "ventsRequired", "ventType", "placement"],
        3: ["outdoorLocation", "outdoorSize", "groundSurface", "levelSurface", "spaceAvailable", "model", "outdoorPhotos", "roofAccess", "ceilingSpace"],
        4: ["vehicleAccess", "installCost", "extraCosts"],
        5: ["noise", "ducting", "ductingNotes"],
        6: ["notes", "agree", "customerSignature", "assessorSignature"],
      };

      if (!stepFields[step]) {
        return res.status(400).json({ success: false, message: "Invalid step" });
      }

      const allowedData: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (stepFields[step].includes(k)) allowedData[k] = v;
      }

      if (files) {
        for (const [field, file] of Object.entries(files)) {
          if (stepFields[step].includes(field)) {
            const uploadFile = file as fileUpload.UploadedFile;
            const fileName = `${field}-${id || "new"}-${randomUUID()}`;
            const fileUrl = '';
            if (!fileUrl) {
              return res.status(500).json({ success: false, message: "File upload failed" });
            }

            allowedData[field] = Array.isArray(allowedData[field])
              ? [...allowedData[field], fileUrl]
              : [fileUrl];
          }
        }
      }

      let assessment = id
        ? await ductedAssessmentRepository.findById(id)
        : await ductedAssessmentRepository.create(allowedData);

      if (!assessment) {
        return res.status(404).json({ success: false, message: "Assessment not found" });
      }

      if (id) {
        assessment = await ductedAssessmentRepository.updateById(id, { $set: allowedData });
      }

      return ReS(res, SUCCESS_CODE, "Invoice created successfully", assessment);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);

      const assessment = await ductedAssessmentRepository.findById(id);
      if (!assessment) {
        return res.status(404).json({ success: false, message: "Assessment not found" });
      }

      await ductedAssessmentRepository.deleteById(id);
      return ReS(res, SUCCESS_CODE, "Assessment deleted successfully");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.body;
      const data = await ductedAssessmentRepository.findOne(
        { id },
        { populate: ductedAssessmentDetailPopulate },
      );
      if (!data) return ReE(res, SERVER_ERROR_CODE, "No data found");
      return ReS(res, SUCCESS_CODE, "Data fetched successfully", data);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
 async updateSign(req: AuthenticatedRequest, res: Response) {
  try {
    const files = req.files as fileUpload.FileArray | undefined;
    const { type, id, token } = req.body;

    if (!type || !id) {
      return ReE(res, FORBIDDEN_CODE, "Missing required fields: type or id.");
    }

    const existingData: any = await ductedAssessmentRepository.findOne({ id: Number(id) });

    if (!existingData) {
      return ReE(res, RESOURCE_NOT_FOUND, "Assessment not found");
    }

    let columnName: string | undefined;
    if (type === "cust_sign") columnName = "customerSignature";
    if (type === "assessor_sign") columnName = "assessorSignature";

    if (!columnName) {
      return ReE(res, FORBIDDEN_CODE, "Invalid signature type.");
    }

    if (!files?.file) {
      return ReE(res, FORBIDDEN_CODE, "No file uploaded.");
    }

    const file = files.file as fileUpload.UploadedFile;
    const fileName = `ducted-assessment-${id}-${type}-${generateUUID()}`;

    const fileUrl = await s3Service.uploadFile(file.data, fileName, file.mimetype);
    if (!fileUrl) {
      return ReE(res, SERVER_ERROR_CODE, "File upload failed.");
    }

    await ductedAssessmentRepository.updateById(Number(id), {
      $set: { [columnName]: fileUrl },
    });

    return ReS(res, SUCCESS_CODE, "File uploaded successfully", { url: fileUrl });
  } catch (error) {
    console.error(error);
    return ReE(res, SERVER_ERROR_CODE, "Server Error");
  }
}

}
export default new DuctedAssessmentController();
