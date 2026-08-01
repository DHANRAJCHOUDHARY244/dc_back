import { AuthenticatedRequest } from "@constants/common.interface";
import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { enumToArray, ReE, ReS } from "@services/generalHelper.service";
import { companyRepository } from "@repositories";
import { Response } from "express";
import { CompanyDesignationEnum } from "@constants/common.enum";

class CompanyController {
    sanitizeInput(data: any) {
        return Object.fromEntries(
            Object.entries(data)
                .filter(([_, v]) => v !== undefined && v !== null)
                .map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
        );
    }

    validateEmailList(emailList: any[]) {
        const allowedTypes = ["personal", "official", "other"];
        const allowedDesignation = enumToArray(CompanyDesignationEnum);

        if (!Array.isArray(emailList)) return "company_contact_email must be an array";

        for (const e of emailList) {
            if (!e.email || typeof e.email !== "string") return "Each email entry must have a valid 'email'";
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(e.email)) return `Invalid email format: ${e.email}`;

            if (!allowedTypes.includes(e.type)) return `Invalid email type: ${e.type}`;
            if (!allowedDesignation.includes(e.designation)) return `Invalid email designation: ${e.designation}`;
        }

        return null;
    }

    validateNumberList(numberList: any[]) {
        const allowedTypes = ["mobile", "landline", "fax"];
        const allowedDesignation = enumToArray(CompanyDesignationEnum);

        if (!Array.isArray(numberList)) return "company_contact_number must be an array";

        for (const n of numberList) {
            if (!n.mob_number || typeof n.mob_number !== "string")
                return "Each number entry must have a valid 'mob_number'";

            const phoneRegex = /^[0-9+\-\s]{6,20}$/;
            if (!phoneRegex.test(n.mob_number)) return `Invalid phone number: ${n.mob_number}`;

            if (!allowedTypes.includes(n.type)) return `Invalid number type: ${n.type}`;
            if (!allowedDesignation.includes(n.designation))
                return `Invalid number designation: ${n.designation}`;
        }

        return null;
    }

    async findCompany(id: number, res: Response) {
        const company = await companyRepository.findById(id);
        if (!company) return ReE(res, BAD_REQUEST_CODE, "Company not found");
        return company;
    }

    buildQueryOptions(query: any) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;

        const filter: any = {};

        if (query.search) {
            filter.company_name = { $regex: query.search.trim(), $options: "i" };
        }

        return { page, limit, filter };
    }

    async createCompany(req: AuthenticatedRequest, res: Response) {
        try {
            const data:any = this.sanitizeInput(req.body);

            if (!data.company_name || !data.company_address) {
                return ReE(res, BAD_REQUEST_CODE, "company_name and company_address are required");
            }

            if (data.company_contact_email) {
                const emailErr = this.validateEmailList(data.company_contact_email);
                if (emailErr) return ReE(res, BAD_REQUEST_CODE, emailErr);
            }

            if (data.company_contact_number) {
                const numberErr = this.validateNumberList(data.company_contact_number);
                if (numberErr) return ReE(res, BAD_REQUEST_CODE, numberErr);
            }

            const exists = await companyRepository.findOne({
                company_name: data.company_name,
            });

            if (exists) return ReE(res, BAD_REQUEST_CODE, "Company name already exists");

            const newCompany = await companyRepository.create(data);

            return ReS(res, SUCCESS_CODE, "Company created", newCompany);
        } catch (err) {
            return ReE(res, SERVER_ERROR_CODE, err);
        }
    }

    async getCompanies(req: AuthenticatedRequest, res: Response) {
        try {
            const { page, limit, filter } = this.buildQueryOptions(req.query);
            const { count, rows } = await companyRepository.findPaginated(filter, {
              page,
              limit,
              sort: { created_at: -1 },
            });

            return ReS(res, SUCCESS_CODE, "Fetch Companies successfully.", {
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                total: count,
                data: rows,
            });
        } catch (err) {
            return ReE(res, SERVER_ERROR_CODE, err);
        }
    }

    async getCompanyById(req: AuthenticatedRequest, res: Response) {
        try {
            const company = await this.findCompany(Number(req.params.id), res);
            if (!company) return;

            return ReS(res, SUCCESS_CODE, "Fetch Data Successfully", company);
        } catch (err) {
            return ReE(res, SERVER_ERROR_CODE, err);
        }
    }

    async updateCompany(req: AuthenticatedRequest, res: Response) {
        try {
            const company = await this.findCompany(Number(req.params.id), res);
            if (!company) return;

            const data:any = this.sanitizeInput(req.body);

            if (data.company_contact_email) {
                const emailErr = this.validateEmailList(data.company_contact_email);
                if (emailErr) return ReE(res, BAD_REQUEST_CODE, emailErr);
            }

            if (data.company_contact_number) {
                const numberErr = this.validateNumberList(data.company_contact_number);
                if (numberErr) return ReE(res, BAD_REQUEST_CODE, numberErr);
            }

            const updated = await companyRepository.updateById(Number(req.params.id), { $set: data });

            return ReS(res, SUCCESS_CODE, "Company updated", updated);
        } catch (err) {
            return ReE(res, SERVER_ERROR_CODE, err);
        }
    }

    async deleteCompany(req: AuthenticatedRequest, res: Response) {
        try {
            const company = await this.findCompany(Number(req.params.id), res);
            if (!company) return;

            await companyRepository.deleteById(Number(req.params.id));

            return ReS(res, SUCCESS_CODE, "Company deleted");
        } catch (err) {
            return ReE(res, SERVER_ERROR_CODE, err);
        }
    }
}

export default new CompanyController();
