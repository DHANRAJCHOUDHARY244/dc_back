import fs from "fs";
import path from "path";
import crypto from "crypto";
import slugify from "slugify";
import { Response } from "express";
import { productItemRepository } from "@repositories";
import { UploadedFile } from "express-fileupload";
import { ReS, ReE } from "@services/generalHelper.service";
import {
  SUCCESS_CODE,
  SERVER_ERROR_CODE,
  BAD_REQUEST_CODE,
} from "@constants/serverCode";
import { DocumentsAuthenticatedRequest } from "@constants/common.interface";
import { categoryQueryFilter } from "@constants/categoryMeta";

class ProductItemsController {
  private readonly baseUploadDir: string;
  private readonly prefixUploadUrl: string = "/uploads/products";

  constructor() {
    this.baseUploadDir = path.join(process.cwd(), "uploads", "products");
    if (!fs.existsSync(this.baseUploadDir)) fs.mkdirSync(this.baseUploadDir, { recursive: true });
  }

  private safeSlug(value: string): string {
    return slugify(value, { lower: true, strict: true });
  }

  private uploadFile(file: UploadedFile, folder: string, relativeUrl: string): string {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${safeFileName}`;
    const filePath = path.join(folder, storedName);
    file.mv(filePath);
    return `${relativeUrl}/${storedName}`;
  }

  async createProduct(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { category, name, description, moreDescription, rebate, price, phase, size } = req.body;
      const createdBy = req.user?.id;
      if (!category || !name) return ReE(res, BAD_REQUEST_CODE, "Category and Product name required.");

      const categorySlug = this.safeSlug(category);
      const productSlug = this.safeSlug(name);
      const categoryFolder = path.join(this.baseUploadDir, categorySlug);
      const productFolder = path.join(categoryFolder, productSlug);

      if (!fs.existsSync(productFolder)) fs.mkdirSync(productFolder, { recursive: true });

      let imgUrl: string | null = null;
      let pdfUrl: string | null = null;
      let compliancePdfUrl: string | null = null;
      let warrantyPdfUrl: string | null = null;

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

        const prefix = `${this.prefixUploadUrl}/${categorySlug}/${productSlug}`;
        if (imgFile)
          imgUrl = this.uploadFile(imgFile, productFolder, prefix);
        if (pdfFile)
          pdfUrl = this.uploadFile(pdfFile, productFolder, prefix);
        if (compliancePdfFile)
          compliancePdfUrl = this.uploadFile(compliancePdfFile, productFolder, prefix);
        if (warrantyPdfFile)
          warrantyPdfUrl = this.uploadFile(warrantyPdfFile, productFolder, prefix);
      }

      const product = await productItemRepository.create({
        category,
        name,
        description,
        moreDescription: typeof moreDescription === "string" ? JSON.parse(moreDescription || `[]`) : moreDescription||[],
        rebate: typeof rebate === "string" ? JSON.parse(rebate || `[]`) : rebate || [],
        price: typeof price === "string" ? JSON.parse(price || `[]`) : price||[],
        size: typeof size === "string" ? JSON.parse(size || `[]`) :size|| [],
        phase,
        img: imgUrl,
        pdf: pdfUrl,
        compliance_pdf: compliancePdfUrl,
        warranty_pdf: warrantyPdfUrl,
        created_by: createdBy,
      });

      return ReS(res, SUCCESS_CODE, "✅ Product created successfully.", product);
    } catch (error: any) {
      console.error("❌ [createProduct] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getAllProducts(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const {
        limit = 10,
        page = 1,
        category,
        name,
        phase,
        search,
        order_by = "created_at",
        order_direction = "DESC",
      } = req.body;

      const parsedLimit = parseInt(limit as string, 10);
      const parsedPage = parseInt(page as string, 10);
      const filter: Record<string, unknown> = {};

      const catFilter = categoryQueryFilter(category);
      if (catFilter !== undefined) filter.category = catFilter;
      if (name) filter.name = { $regex: name, $options: "i" };
      if (phase) filter.phase = { $regex: phase, $options: "i" };
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      const { count, rows } = await productItemRepository.findPaginated(filter, {
        page: parsedPage,
        limit: parsedLimit,
        sort: { [order_by]: order_direction === "DESC" ? -1 : 1 },
      });

      return ReS(res, SUCCESS_CODE, "Products fetched successfully", {
        currentPage: parsedPage,
        totalPages: Math.ceil(count / parsedLimit),
        totalProducts: count,
        data: rows,
      });
    } catch (error: any) {
      console.error("❌ [getAllProducts] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getProductById(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const product = await productItemRepository.findById(id);

      if (!product) return ReE(res, BAD_REQUEST_CODE, "Product not found.");
      return ReS(res, SUCCESS_CODE, "Product details fetched successfully.", product);
    } catch (error: any) {
      console.error("❌ [getProductById] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

async updateProduct(req: DocumentsAuthenticatedRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    const updaterId = req.user?.id;
    const updates = req.body;

    const product: any = await productItemRepository.findById(id, { lean: true });
    if (!product) return ReE(res, BAD_REQUEST_CODE, "Product not found.");

    const oldCategorySlug = this.safeSlug(product.category);
    const oldProductSlug = this.safeSlug(product.name);
    const newCategorySlug = this.safeSlug(updates.category || product.category);
    const newProductSlug = this.safeSlug(updates.name || product.name);

    const oldFolder = path.join(this.baseUploadDir, oldCategorySlug, oldProductSlug);
    const newFolder = path.join(this.baseUploadDir, newCategorySlug, newProductSlug);

    if (oldFolder !== newFolder) {
      fs.mkdirSync(path.dirname(newFolder), { recursive: true });
      if (fs.existsSync(oldFolder)) fs.renameSync(oldFolder, newFolder);
    }

    let imgUrl = product.img;
    let pdfUrl = product.pdf;
    let compliancePdfUrl = product.compliance_pdf;
    let warrantyPdfUrl = product.warranty_pdf;
    const prefix = `${this.prefixUploadUrl}/${newCategorySlug}/${newProductSlug}`;

    const unlinkIfExists = (url: string | null) => {
      if (!url) return;
      const fullPath = path.join(this.baseUploadDir, url.replace(this.prefixUploadUrl + "/", ""));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    };

    if (req.files) {
      const imgFile = req.files?.img as UploadedFile;
      const pdfFile = req.files?.pdf as UploadedFile;
      const compliancePdfFile = req.files?.compliance_pdf as UploadedFile;
      const warrantyPdfFile = req.files?.warranty_pdf as UploadedFile;

      if (imgFile) {
        unlinkIfExists(imgUrl);
        imgUrl = this.uploadFile(imgFile, newFolder, prefix);
      }
      if (pdfFile) {
        unlinkIfExists(pdfUrl);
        pdfUrl = this.uploadFile(pdfFile, newFolder, prefix);
      }
      if (compliancePdfFile) {
        if (compliancePdfFile.mimetype !== "application/pdf")
          return ReE(res, BAD_REQUEST_CODE, "Invalid compliance PDF file type.");
        unlinkIfExists(compliancePdfUrl);
        compliancePdfUrl = this.uploadFile(compliancePdfFile, newFolder, prefix);
      }
      if (warrantyPdfFile) {
        if (warrantyPdfFile.mimetype !== "application/pdf")
          return ReE(res, BAD_REQUEST_CODE, "Invalid warranty PDF file type.");
        unlinkIfExists(warrantyPdfUrl);
        warrantyPdfUrl = this.uploadFile(warrantyPdfFile, newFolder, prefix);
      }
    }

    const updatedProduct = await productItemRepository.updateById(id, {
      $set: {
        ...updates,
        moreDescription: typeof updates.moreDescription === "string" ? JSON.parse(updates.moreDescription || `[]`) : updates.moreDescription||[],
        rebate: typeof updates.rebate === "string" ? JSON.parse(updates.rebate || `[]`) : updates.rebate || [],
        price:  typeof updates.price === "string" ? JSON.parse(updates.price || `[]`) : updates.price || [],
        size:   typeof updates.size === "string" ? JSON.parse(updates.size || `[]`) : updates.size || [],
        img: imgUrl,
        pdf: pdfUrl,
        compliance_pdf: compliancePdfUrl,
        warranty_pdf: warrantyPdfUrl,
        updated_by: updaterId,
        updated_at: new Date(),
      },
    });

    return ReS(res, SUCCESS_CODE, "✅ Product updated successfully.", updatedProduct);
  } catch (error: any) {
    console.error("❌ [updateProduct] Error:", error);
    return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
  }
}

  async deleteProduct(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const product: any = await productItemRepository.findById(id, { lean: true });
      if (!product) return ReE(res, BAD_REQUEST_CODE, "Product not found.");

      const categorySlug = this.safeSlug(product.category);
      const productSlug = this.safeSlug(product.name);
      const productFolder = path.join(this.baseUploadDir, categorySlug, productSlug);

      if (fs.existsSync(productFolder)) {
        fs.rmSync(productFolder, { recursive: true, force: true });
      }

      await productItemRepository.deleteById(id);
      return ReS(res, SUCCESS_CODE, "🗑️ Product deleted successfully.", { id });
    } catch (error: any) {
      console.error("❌ [deleteProduct] Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
}

export default new ProductItemsController();
