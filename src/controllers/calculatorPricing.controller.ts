import { Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { emptyStatePrice } from "@constants/auStatePrice.constants";
import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { ReE, ReS } from "@services/generalHelper.service";
import {
  estimateCalculatorPrice,
  getCalculatorCatalog,
  getOrCreateCalculatorSettings,
} from "@services/calculatorPricing.service";
import {
  calculatorBrandRepository,
  calculatorCategoryRepository,
  calculatorExtraRepository,
  calculatorProductRepository,
  calculatorSettingsRepository,
} from "@repositories";

function nameSearchFilter(search?: string): Record<string, unknown> {
  const q = String(search || "").trim();
  if (!q) return {};
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { name: { $regex: escaped, $options: "i" } };
}

class CalculatorPricingController {
  async getCatalog(_req: AuthenticatedRequest, res: Response) {
    try {
      const catalog = await getCalculatorCatalog();
      return ReS(res, SUCCESS_CODE, "Calculator catalog fetched.", catalog);
    } catch (error: any) {
      console.error("[getCatalog]", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async estimate(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await estimateCalculatorPrice(req.body || {});
      return ReS(res, SUCCESS_CODE, "Estimate calculated.", result);
    } catch (error: any) {
      console.error("[estimate]", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async getSettings(_req: AuthenticatedRequest, res: Response) {
    try {
      const settings = await getOrCreateCalculatorSettings();
      return ReS(res, SUCCESS_CODE, "Calculator settings fetched.", settings);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const body = { ...(req.body || {}) };
      // Strip immutable/meta fields — $set on these is rejected by MongoDB.
      delete body._id;
      delete body.id;
      delete body.__v;
      delete body.created_at;
      delete body.updated_at;
      delete body.deleted_at;
      const updated = await calculatorSettingsRepository.updateById(1, { $set: body });
      return ReS(res, SUCCESS_CODE, "Calculator settings updated.", updated);
    } catch (error: any) {
      console.error("[updateSettings]", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async listCategories(req: AuthenticatedRequest, res: Response) {
    try {
      const filter = nameSearchFilter(String(req.query.search || ""));
      const rows = await calculatorCategoryRepository.find(filter, { sort: { sort_order: 1, name: 1 } });
      return ReS(res, SUCCESS_CODE, "Categories fetched.", rows);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async createCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, rebate_options, size_fields, active, sort_order } = req.body;
      if (!name) return ReE(res, BAD_REQUEST_CODE, "name is required");
      const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const row = await calculatorCategoryRepository.create({
        name,
        slug,
        rebate_options: rebate_options || [],
        size_fields: size_fields || [],
        active: active !== false,
        sort_order: sort_order ?? 0,
      });
      return ReS(res, SUCCESS_CODE, "Category created.", row);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async updateCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await calculatorCategoryRepository.updateById(id, { $set: req.body });
      return ReS(res, SUCCESS_CODE, "Category updated.", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async deleteCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      await calculatorCategoryRepository.deleteById(id);
      return ReS(res, SUCCESS_CODE, "Category deleted.");
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async listBrands(req: AuthenticatedRequest, res: Response) {
    try {
      const filter: Record<string, unknown> = { ...nameSearchFilter(String(req.query.search || "")) };
      if (req.query.category_id) filter.category_id = Number(req.query.category_id);
      const rows = await calculatorBrandRepository.find(filter, { sort: { sort_order: 1, name: 1 } });
      return ReS(res, SUCCESS_CODE, "Brands fetched.", rows);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async createBrand(req: AuthenticatedRequest, res: Response) {
    try {
      const { category_id, name, active, sort_order } = req.body;
      if (!category_id || !name) return ReE(res, BAD_REQUEST_CODE, "category_id and name required");
      const row = await calculatorBrandRepository.create({
        category_id: Number(category_id),
        name,
        active: active !== false,
        sort_order: sort_order ?? 0,
      });
      return ReS(res, SUCCESS_CODE, "Brand created.", row);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async updateBrand(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await calculatorBrandRepository.updateById(id, { $set: req.body });
      return ReS(res, SUCCESS_CODE, "Brand updated.", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async deleteBrand(req: AuthenticatedRequest, res: Response) {
    try {
      await calculatorBrandRepository.deleteById(Number(req.params.id));
      return ReS(res, SUCCESS_CODE, "Brand deleted.");
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async listProducts(req: AuthenticatedRequest, res: Response) {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.category_id) filter.category_id = Number(req.query.category_id);
      if (req.query.brand_id) filter.brand_id = Number(req.query.brand_id);
      const rows = await calculatorProductRepository.find(filter, { sort: { sort_order: 1, name: 1 } });
      return ReS(res, SUCCESS_CODE, "Products fetched.", rows);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async createProduct(req: AuthenticatedRequest, res: Response) {
    try {
      const { category_id, brand_id, name, phase, variants, active, sort_order } = req.body;
      if (!category_id || !brand_id || !name) {
        return ReE(res, BAD_REQUEST_CODE, "category_id, brand_id, name required");
      }
      const row = await calculatorProductRepository.create({
        category_id: Number(category_id),
        brand_id: Number(brand_id),
        name,
        phase: phase || "both",
        variants: variants || [],
        active: active !== false,
        sort_order: sort_order ?? 0,
      });
      return ReS(res, SUCCESS_CODE, "Product created.", row);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async updateProduct(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await calculatorProductRepository.updateById(Number(req.params.id), { $set: req.body });
      return ReS(res, SUCCESS_CODE, "Product updated.", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async deleteProduct(req: AuthenticatedRequest, res: Response) {
    try {
      await calculatorProductRepository.deleteById(Number(req.params.id));
      return ReS(res, SUCCESS_CODE, "Product deleted.");
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async listExtras(_req: AuthenticatedRequest, res: Response) {
    try {
      const rows = await calculatorExtraRepository.find({}, { sort: { sort_order: 1 } });
      return ReS(res, SUCCESS_CODE, "Extras fetched.", rows);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async createExtra(req: AuthenticatedRequest, res: Response) {
    try {
      const { key, label, prices, active, sort_order } = req.body;
      if (!key || !label) return ReE(res, BAD_REQUEST_CODE, "key and label required");
      const row = await calculatorExtraRepository.create({
        key,
        label,
        prices: prices || emptyStatePrice(0),
        active: active !== false,
        sort_order: sort_order ?? 0,
      });
      return ReS(res, SUCCESS_CODE, "Extra created.", row);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async updateExtra(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await calculatorExtraRepository.updateById(Number(req.params.id), { $set: req.body });
      return ReS(res, SUCCESS_CODE, "Extra updated.", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async deleteExtra(req: AuthenticatedRequest, res: Response) {
    try {
      await calculatorExtraRepository.deleteById(Number(req.params.id));
      return ReS(res, SUCCESS_CODE, "Extra deleted.");
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }
}

export default new CalculatorPricingController();
