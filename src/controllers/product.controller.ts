import fs from "fs";
import path from "path";
import crypto from "crypto";
import slugify from "slugify";
import { Response } from "express";
import { productRepository, quoteBuilderSettingsRepository } from "@repositories";
import {
  DEFAULT_INSTALLATION_TYPES,
  categoryQueryFilter,
} from "@constants/categoryMeta";
import { enrichCategoryRows, upsertCategoryConfig as saveCategoryConfig } from "@services/productCategoryConfig.service";
import { getOrCreateQuoteBuilderSettings } from "@services/quoteBuilderSettings.service";
import { UploadedFile } from "express-fileupload";
import { ReS, ReE } from "@services/generalHelper.service";
import {
  SUCCESS_CODE,
  SERVER_ERROR_CODE,
  BAD_REQUEST_CODE,
} from "@constants/serverCode";
import { DocumentsAuthenticatedRequest } from "@constants/common.interface";
import { resolveBrandLogoUrl, resolveProductDisplayImage } from "@utils/brandLogoUrl";

const productPopulate = [
  { path: "creator", select: "id name email" },
];

class ProductController {
  private readonly baseUploadDir: string;
  private readonly prefixUploadUrl: string = "/uploads/products-new";

  constructor() {
    this.baseUploadDir = path.join(process.cwd(), "uploads", "products-new");
    if (!fs.existsSync(this.baseUploadDir))
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
  }

  private safeSlug(value: string): string {
    return slugify(value, { lower: true, strict: true });
  }

  private uploadFile(
    file: UploadedFile,
    folder: string,
    relativeUrl: string
  ): string {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${Date.now()}_${crypto
      .randomBytes(4)
      .toString("hex")}_${safeFileName}`;
    const filePath = path.join(folder, storedName);
    file.mv(filePath);
    return `${process.env.BASE_URL || ""}${relativeUrl}/${storedName}`;
  }

  private resolveFilePath(storedUrl: string | null): string | null {
    if (!storedUrl) return null;
    const baseUrl = process.env.BASE_URL || "";
    const relative = storedUrl.startsWith(baseUrl) && baseUrl
      ? storedUrl.slice(baseUrl.length)
      : storedUrl;
    return path.join(process.cwd(), relative);
  }

  private deleteOldFile(storedUrl: string | null): void {
    const filePath = this.resolveFilePath(storedUrl);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private parseJson(value: any, fallback: any = []): any {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return value ?? fallback;
  }

  /** Attach uploaded PDFs keyed as `variant_pdf_<variantId>` onto variant rows. */
  private applyVariantPdfUploads(
    variants: any[],
    files: DocumentsAuthenticatedRequest["files"],
    folder: string,
    prefix: string,
  ): any[] {
    if (!Array.isArray(variants) || !files) return Array.isArray(variants) ? variants : [];

    return variants.map((variant) => {
      const id = String(variant?.id || "");
      if (!id) return variant;
      const raw = (files as any)[`variant_pdf_${id}`] as UploadedFile | UploadedFile[] | undefined;
      const file = Array.isArray(raw) ? raw[0] : raw;
      if (!file) return variant;
      if (file.mimetype !== "application/pdf") return variant;
      if (variant.pdf) this.deleteOldFile(variant.pdf);
      return { ...variant, pdf: this.uploadFile(file, folder, prefix) };
    });
  }

  async createProduct(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const {
        name,
        category,
        brand,
        description,
        specifications,
        tags,
        variants,
        status,
        logo_url: bodyLogoUrl,
        img_url: bodyImgUrl,
      } = req.body;
      const createdBy = req.user?.id;

      if (!name || !category)
        return ReE(res, BAD_REQUEST_CODE, "Name and category are required.");

      const slug = this.safeSlug(name);
      const catSlug = this.safeSlug(category);
      const productFolder = path.join(this.baseUploadDir, catSlug, slug);
      if (!fs.existsSync(productFolder))
        fs.mkdirSync(productFolder, { recursive: true });

      let imgUrl: string | null = null;
      let pdfUrl: string | null = null;
      let compliancePdfUrl: string | null = null;
      let warrantyPdfUrl: string | null = null;
      const prefix = `${this.prefixUploadUrl}/${catSlug}/${slug}`;

      if (req.files) {
        const imgFile = req.files?.img as UploadedFile;
        const pdfFile = req.files?.pdf as UploadedFile;
        const compliancePdfFile = req.files?.compliance_pdf as UploadedFile;
        const warrantyPdfFile = req.files?.warranty_pdf as UploadedFile;
        if (imgFile && !imgFile.mimetype.startsWith("image/"))
          return ReE(res, BAD_REQUEST_CODE, "Invalid image file type.");
        if (pdfFile && pdfFile.mimetype !== "application/pdf")
          return ReE(res, BAD_REQUEST_CODE, "Invalid PDF file type.");
        if (compliancePdfFile && compliancePdfFile.mimetype !== "application/pdf")
          return ReE(res, BAD_REQUEST_CODE, "Invalid compliance PDF file type.");
        if (warrantyPdfFile && warrantyPdfFile.mimetype !== "application/pdf")
          return ReE(res, BAD_REQUEST_CODE, "Invalid warranty PDF file type.");
        if (imgFile) imgUrl = this.uploadFile(imgFile, productFolder, prefix);
        if (pdfFile) pdfUrl = this.uploadFile(pdfFile, productFolder, prefix);
        if (compliancePdfFile) compliancePdfUrl = this.uploadFile(compliancePdfFile, productFolder, prefix);
        if (warrantyPdfFile) warrantyPdfUrl = this.uploadFile(warrantyPdfFile, productFolder, prefix);
      }

      const parsedLogoUrl =
        (typeof bodyLogoUrl === "string" && bodyLogoUrl.trim()) ||
        resolveBrandLogoUrl(brand) ||
        null;
      const parsedImgUrl = typeof bodyImgUrl === "string" && bodyImgUrl.trim() ? bodyImgUrl.trim() : null;
      const display = resolveProductDisplayImage({
        img: imgUrl || parsedImgUrl,
        logo_url: parsedLogoUrl,
        brand,
      });

      const parsedVariants = this.applyVariantPdfUploads(
        this.parseJson(variants, []),
        req.files,
        productFolder,
        prefix,
      );

      const product = await productRepository.create({
        name,
        slug,
        category,
        brand: brand || null,
        description: description || null,
        img: display.img,
        logo_url: display.logo_url,
        pdf: pdfUrl,
        compliance_pdf: compliancePdfUrl,
        warranty_pdf: warrantyPdfUrl,
        specifications: this.parseJson(specifications, []),
        tags: this.parseJson(tags, []),
        variants: parsedVariants,
        status: status || "ACTIVE",
        created_by: createdBy,
      });

      return ReS(res, SUCCESS_CODE, "Product created successfully.", product);
    } catch (error: any) {
      console.error("[createProduct] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getAllProducts(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const {
        limit = 12,
        page = 1,
        category,
        brand,
        status,
        search,
        tags,
        order_by = "created_at",
        order_direction = "DESC",
      } = req.body;

      const parsedLimit = parseInt(limit as string, 10);
      const parsedPage = parseInt(page as string, 10);
      const filter: Record<string, unknown> = {};

      const catFilter = categoryQueryFilter(category);
      if (catFilter !== undefined) filter.category = catFilter;
      if (brand) filter.brand = { $regex: brand, $options: "i" };
      if (status) filter.status = status;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { brand: { $regex: search, $options: "i" } },
        ];
      }

      const { count, rows } = await productRepository.findPaginated(filter, {
        page: parsedPage,
        limit: parsedLimit,
        sort: { [order_by]: order_direction === "DESC" ? -1 : 1 },
        populate: productPopulate,
      });

      return ReS(res, SUCCESS_CODE, "Products fetched successfully", {
        currentPage: parsedPage,
        totalPages: Math.ceil(count / parsedLimit),
        totalProducts: count,
        data: rows,
      });
    } catch (error: any) {
      console.error("[getAllProducts] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getProductById(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const product = await productRepository.findById(id, {
        populate: productPopulate,
      });
      if (!product) return ReE(res, BAD_REQUEST_CODE, "Product not found.");
      return ReS(
        res,
        SUCCESS_CODE,
        "Product details fetched successfully.",
        product
      );
    } catch (error: any) {
      console.error("[getProductById] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async updateProduct(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const updaterId = req.user?.id;
      const updates = req.body;

      const product: any = await productRepository.findById(id, { lean: true });
      if (!product) return ReE(res, BAD_REQUEST_CODE, "Product not found.");

      const oldCatSlug = this.safeSlug(product.category);
      const oldSlug = this.safeSlug(product.name);
      const newCatSlug = this.safeSlug(updates.category || product.category);
      const newSlug = this.safeSlug(updates.name || product.name);

      const oldFolder = path.join(this.baseUploadDir, oldCatSlug, oldSlug);
      const newFolder = path.join(this.baseUploadDir, newCatSlug, newSlug);

      if (oldFolder !== newFolder) {
        fs.mkdirSync(path.dirname(newFolder), { recursive: true });
        if (fs.existsSync(oldFolder)) fs.renameSync(oldFolder, newFolder);
      }

      if (!fs.existsSync(newFolder)) {
        fs.mkdirSync(newFolder, { recursive: true });
      }

      let imgUrl = product.img;
      let logoUrl =
        updates.logo_url !== undefined && updates.logo_url !== null
          ? String(updates.logo_url).trim() || null
          : product.logo_url;
      let pdfUrl = product.pdf;
      let compliancePdfUrl = product.compliance_pdf;
      let warrantyPdfUrl = product.warranty_pdf;
      const prefix = `${this.prefixUploadUrl}/${newCatSlug}/${newSlug}`;

      if (req.files) {
        const imgFile = req.files?.img as UploadedFile;
        const pdfFile = req.files?.pdf as UploadedFile;
        const compliancePdfFile = req.files?.compliance_pdf as UploadedFile;
        const warrantyPdfFile = req.files?.warranty_pdf as UploadedFile;

        if (imgFile) {
          this.deleteOldFile(imgUrl);
          imgUrl = this.uploadFile(imgFile, newFolder, prefix);
        }
        if (pdfFile) {
          this.deleteOldFile(pdfUrl);
          pdfUrl = this.uploadFile(pdfFile, newFolder, prefix);
        }
        if (compliancePdfFile) {
          if (compliancePdfFile.mimetype !== "application/pdf")
            return ReE(res, BAD_REQUEST_CODE, "Invalid compliance PDF file type.");
          this.deleteOldFile(compliancePdfUrl);
          compliancePdfUrl = this.uploadFile(compliancePdfFile, newFolder, prefix);
        }
        if (warrantyPdfFile) {
          if (warrantyPdfFile.mimetype !== "application/pdf")
            return ReE(res, BAD_REQUEST_CODE, "Invalid warranty PDF file type.");
          this.deleteOldFile(warrantyPdfUrl);
          warrantyPdfUrl = this.uploadFile(warrantyPdfFile, newFolder, prefix);
        }
      }

      const nextBrand = updates.brand !== undefined ? updates.brand : product.brand;
      if (!logoUrl && nextBrand) {
        logoUrl = resolveBrandLogoUrl(nextBrand);
      }
      const parsedImgUrl =
        typeof updates.img_url === "string" && updates.img_url.trim() ? updates.img_url.trim() : null;
      const display = resolveProductDisplayImage({
        img: imgUrl || parsedImgUrl,
        logo_url: logoUrl,
        brand: nextBrand,
      });
      imgUrl = display.img;
      logoUrl = display.logo_url;

      const parsedVariants = this.applyVariantPdfUploads(
        this.parseJson(updates.variants, product.variants),
        req.files,
        newFolder,
        prefix,
      );

      const updatedProduct = await productRepository.updateById(id, {
        $set: {
          name: updates.name || product.name,
          slug: newSlug,
          category: updates.category || product.category,
          brand: updates.brand !== undefined ? updates.brand : product.brand,
          description:
            updates.description !== undefined
              ? updates.description
              : product.description,
          img: imgUrl,
          logo_url: logoUrl,
          pdf: pdfUrl,
          compliance_pdf: compliancePdfUrl,
          warranty_pdf: warrantyPdfUrl,
          specifications: this.parseJson(
            updates.specifications,
            product.specifications
          ),
          tags: this.parseJson(updates.tags, product.tags),
          variants: parsedVariants,
          status: updates.status || product.status,
          updated_by: updaterId,
          updated_at: new Date(),
        },
      });

      return ReS(res, SUCCESS_CODE, "Product updated successfully.", updatedProduct);
    } catch (error: any) {
      console.error("[updateProduct] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async deleteProduct(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const product: any = await productRepository.findById(id, { lean: true });
      if (!product) return ReE(res, BAD_REQUEST_CODE, "Product not found.");

      [product.img, product.pdf, product.compliance_pdf, product.warranty_pdf].forEach(
        (url) => this.deleteOldFile(url)
      );

      const catSlug = this.safeSlug(product.category);
      const prodSlug = this.safeSlug(product.name);
      const productFolder = path.join(this.baseUploadDir, catSlug, prodSlug);
      if (fs.existsSync(productFolder)) {
        fs.rmSync(productFolder, { recursive: true, force: true });
      }

      await productRepository.deleteById(id);
      return ReS(res, SUCCESS_CODE, "Product deleted successfully.", { id });
    } catch (error: any) {
      console.error("[deleteProduct] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async duplicateProduct(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const createdBy = req.user?.id;
      const original: any = await productRepository.findById(id, { lean: true });
      if (!original) return ReE(res, BAD_REQUEST_CODE, "Product not found.");

      const newName = `${original.name} (Copy)`;
      const slug = this.safeSlug(newName);

      const duplicate = await productRepository.create({
        name: newName,
        slug,
        category: original.category,
        brand: original.brand,
        description: original.description,
        img: original.img,
        logo_url: original.logo_url,
        pdf: original.pdf,
        compliance_pdf: original.compliance_pdf,
        warranty_pdf: original.warranty_pdf,
        specifications: original.specifications,
        tags: original.tags,
        variants: original.variants,
        status: "DRAFT",
        created_by: createdBy,
      });

      return ReS(
        res,
        SUCCESS_CODE,
        "Product duplicated successfully.",
        duplicate
      );
    } catch (error: any) {
      console.error("[duplicateProduct] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getCategories(_req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const rows: any = await productRepository.aggregateRaw([
        { $match: { deleted_at: null } },
        { $group: { _id: "$category" } },
        { $project: { _id: 0, category: "$_id" } },
      ]);
      const categories = rows.map((r: any) => r.category);
      return ReS(
        res,
        SUCCESS_CODE,
        "Categories fetched successfully.",
        categories
      );
    } catch (error: any) {
      console.error("[getCategories] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getBrands(_req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const rows: any = await productRepository.aggregateRaw([
        { $match: { deleted_at: null, brand: { $nin: [null, ""] } } },
        { $group: { _id: "$brand" } },
        { $project: { _id: 0, brand: "$_id" } },
      ]);
      const brands = rows.map((r: any) => r.brand);
      return ReS(res, SUCCESS_CODE, "Brands fetched successfully.", brands);
    } catch (error: any) {
      console.error("[getBrands] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getBrandsWithCounts(
    req: DocumentsAuthenticatedRequest,
    res: Response
  ) {
    try {
      const { category } = req.query as { category?: string };
      const match: Record<string, unknown> = {
        deleted_at: null,
        brand: { $nin: [null, ""] },
        status: "ACTIVE",
      };
      if (category) {
        const catFilter = categoryQueryFilter(category);
        if (catFilter !== undefined) match.category = catFilter;
      }

      const rows: any = await productRepository.aggregateRaw([
        { $match: match },
        { $group: { _id: "$brand", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, brand: "$_id", count: 1 } },
      ]);

      const brands = rows.map((r: any) => ({
        brand: r.brand,
        count: r.count,
      }));

      const total = brands.reduce(
        (sum: number, b: any) => sum + b.count,
        0
      );

      return ReS(
        res,
        SUCCESS_CODE,
        "Brands with counts fetched successfully.",
        { brands, total }
      );
    } catch (error: any) {
      console.error("[getBrandsWithCounts] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getCategoriesWithCounts(
    _req: DocumentsAuthenticatedRequest,
    res: Response
  ) {
    try {
      const rows: any = await productRepository.aggregateRaw([
        { $match: { deleted_at: null, status: "ACTIVE" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, category: "$_id", count: 1 } },
      ]);

      const categories = await enrichCategoryRows(
        rows.map((r: any) => ({ category: r.category, count: r.count })),
      );
      const total = categories.reduce((sum: number, c: any) => sum + c.count, 0);

      return ReS(res, SUCCESS_CODE, "Categories with counts fetched successfully.", {
        categories,
        total,
      });
    } catch (error: any) {
      console.error("[getCategoriesWithCounts] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getQuoteBuilderConfig(_req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const rows: any = await productRepository.aggregateRaw([
        { $match: { deleted_at: null, status: "ACTIVE" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, category: "$_id", count: 1 } },
      ]);

      const categories = await enrichCategoryRows(
        rows.map((r: any) => ({ category: r.category, count: r.count })),
      );

      const settings = await getOrCreateQuoteBuilderSettings();

      return ReS(res, SUCCESS_CODE, "Quote builder config fetched.", {
        categories,
        installationTypes: settings.installation_types ?? DEFAULT_INSTALLATION_TYPES,
      });
    } catch (error: any) {
      console.error("[getQuoteBuilderConfig] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getQuoteBuilderSettings(_req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const settings = await getOrCreateQuoteBuilderSettings();
      return ReS(res, SUCCESS_CODE, "Quote builder settings fetched.", settings);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async updateQuoteBuilderSettings(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { installation_types } = req.body || {};
      if (!Array.isArray(installation_types)) {
        return ReE(res, BAD_REQUEST_CODE, "installation_types array is required");
      }
      await getOrCreateQuoteBuilderSettings();
      const updated = await quoteBuilderSettingsRepository.updateById(1, {
        $set: { installation_types },
      });
      return ReS(res, SUCCESS_CODE, "Quote builder settings updated.", updated);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async upsertCategoryConfig(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const category = String(req.params.category || "");
      const { label, icon, color, gradient, sort_order, is_active } = req.body || {};
      if (!label?.trim()) return ReE(res, BAD_REQUEST_CODE, "label is required");
      const row = await saveCategoryConfig(category, {
        label: label.trim(),
        icon,
        color,
        gradient,
        sort_order,
        is_active,
      });
      return ReS(res, SUCCESS_CODE, "Category config saved.", row);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async getCategoryConfig(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const category = String(req.params.category || "").trim().toUpperCase();
      const rows = await enrichCategoryRows([{ category, count: 0 }]);
      return ReS(res, SUCCESS_CODE, "Category config fetched.", rows[0] ?? null);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async getProductsForSelector(
    req: DocumentsAuthenticatedRequest,
    res: Response
  ) {
    try {
      const { category, brand, search, page, limit } = req.query as {
        category?: string;
        search?: string;
        brand?: string;
        page?: string;
        limit?: string;
      };

      const filter: Record<string, unknown> = { deleted_at: null, status: "ACTIVE" };
      if (category) {
        const catFilter = categoryQueryFilter(category);
        if (catFilter !== undefined) filter.category = catFilter;
      }
      if (brand?.trim()) filter.brand = brand.trim();
      if (search?.trim()) {
        filter.$or = [
          { name: { $regex: search.trim(), $options: "i" } },
          { brand: { $regex: search.trim(), $options: "i" } },
        ];
      }

      const selectFields = {
        id: 1,
        name: 1,
        category: 1,
        brand: 1,
        description: 1,
        img: 1,
        logo_url: 1,
        pdf: 1,
        compliance_pdf: 1,
        warranty_pdf: 1,
        specifications: 1,
        variants: 1,
      };

      const wantsPagination = page !== undefined || limit !== undefined;
      if (wantsPagination) {
        const parsedLimit = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
        const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
        const totalCount = await productRepository.count(filter);
        const totalPages = Math.max(1, Math.ceil(totalCount / parsedLimit));
        const currentPage = totalCount === 0 ? 1 : Math.min(parsedPage, totalPages);
        const rows = await productRepository.find(filter, {
          select: Object.keys(selectFields).join(" "),
          sort: { name: 1 },
          skip: (currentPage - 1) * parsedLimit,
          limit: parsedLimit,
          lean: true,
        });

        return ReS(res, SUCCESS_CODE, "Products for selector fetched successfully.", {
          data: rows,
          totalItems: totalCount,
          totalPages,
          currentPage,
          pageSize: parsedLimit,
        });
      }

      const rows = await productRepository.find(filter, {
        select: Object.keys(selectFields).join(" "),
        sort: { name: 1 },
        lean: true,
      });

      return ReS(
        res,
        SUCCESS_CODE,
        "Products for selector fetched successfully.",
        rows
      );
    } catch (error: any) {
      console.error("[getProductsForSelector] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
}

export default new ProductController();
