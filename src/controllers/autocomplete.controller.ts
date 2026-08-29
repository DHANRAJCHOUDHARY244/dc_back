import { Response } from "express";
import { AuthenticatedRequest } from "./../constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { PaginationInterface } from "@constants/pagination.interface";

function emptyPagination(page = 1) {
  return {
    totalItems: 0,
    totalPages: 0,
    currentPage: page,
    data: [] as unknown[],
  };
}

class Autocomplete {
  private async emptyList(res: Response, label: string, page = 1) {
    return ReS(res, SUCCESS_CODE, `${label} fetched successfully`, emptyPagination(page));
  }

  private async emptySearch(res: Response, label: string) {
    return ReS(res, SUCCESS_CODE, `${label} fetched successfully`, []);
  }

  async getSkills(req: AuthenticatedRequest, res: Response) {
    try {
      return this.emptySearch(res, "Skills");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getColleges(req: AuthenticatedRequest, res: Response) {
    try {
      return this.emptySearch(res, "Colleges");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getSchools(req: AuthenticatedRequest, res: Response) {
    try {
      return this.emptySearch(res, "Schools");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getSchoolBoard(req: AuthenticatedRequest, res: Response) {
    try {
      return this.emptySearch(res, "School boards");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getCourses(req: AuthenticatedRequest, res: Response) {
    try {
      return this.emptySearch(res, "Courses");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getLanguages(req: AuthenticatedRequest, res: Response) {
    try {
      return this.emptySearch(res, "Languages");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getStream(req: AuthenticatedRequest, res: Response) {
    try {
      return this.emptySearch(res, "Streams");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getSkillsPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1 }: PaginationInterface = req.body;
      return this.emptyList(res, "Skills", page);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getCollegesPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1 }: PaginationInterface = req.body;
      return this.emptyList(res, "Colleges", page);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getSchoolsPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1 }: PaginationInterface = req.body;
      return this.emptyList(res, "Schools", page);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getSchoolBoardPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1 }: PaginationInterface = req.body;
      return this.emptyList(res, "School boards", page);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getCoursesPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1 }: PaginationInterface = req.body;
      return this.emptyList(res, "Courses", page);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getLanguagesPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1 }: PaginationInterface = req.body;
      return this.emptyList(res, "Languages", page);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getStreamsPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1 }: PaginationInterface = req.body;
      return this.emptyList(res, "Streams", page);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new Autocomplete();
