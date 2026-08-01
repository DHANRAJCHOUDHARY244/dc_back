export interface ProductItemBaseDTO {
  category: string;
  name: string;
  img?: string | null;
  pdf?: string | null;
  compliance_pdf?: string | null;
  warranty_pdf?: string | null;
  description?: string | null;
  moreDescription?: string[];
  rebate?: string[];
  price?: string[];
  phase?: string;
  size?: string | null;
}

export interface CreateProductItemDTO extends ProductItemBaseDTO {
  created_by: number;
}

export interface UpdateProductItemDTO extends Partial<ProductItemBaseDTO> {
  updated_by?: number;
}

export interface ProductUserInfo {
  id: number;
  name?: string;
  email?: string;
}


export interface ProductResponse  extends ProductItemBaseDTO {
  id: string;
  created_by: number;
  updated_by?: number | null;
  created_at: Date;
  updated_at: Date;
  creator?: ProductUserInfo | null;
  updater?: ProductUserInfo | null;
}
