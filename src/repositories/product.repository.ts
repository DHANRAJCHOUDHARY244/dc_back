import Product from "@models/product.model";
import { BaseRepository } from "./BaseRepository";

export class ProductRepository extends BaseRepository {
  constructor() {
    super(Product, true);
  }
}

export const productRepository = new ProductRepository();
