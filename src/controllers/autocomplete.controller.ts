import { Response } from "express";
import { AuthenticatedRequest } from "./../constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { PaginationInterface } from "@constants/pagination.interface";

class Autocomplete {
  async getLanguagesPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { limit, page }: PaginationInterface = req.body;
      const resData = {
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
        data: [],
      };
      return ReS(res, SUCCESS_CODE, "Languages fetched successfully", resData);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new Autocomplete();
