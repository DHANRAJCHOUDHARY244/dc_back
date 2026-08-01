import ProductItem from "@models/productItems.model";
import { BaseRepository } from "./BaseRepository";

export class ProductItemRepository extends BaseRepository {
  constructor() {
    super(ProductItem, true);
  }
}

export const productItemRepository = new ProductItemRepository();
