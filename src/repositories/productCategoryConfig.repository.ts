import ProductCategoryConfig from "@models/productCategoryConfig.model";
import { BaseRepository } from "./BaseRepository";

export class ProductCategoryConfigRepository extends BaseRepository {
  constructor() {
    super(ProductCategoryConfig, true);
  }
}

export const productCategoryConfigRepository = new ProductCategoryConfigRepository();
