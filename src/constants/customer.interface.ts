import { UpdateUser } from "./common.interface";

export interface UpdateCustomer extends UpdateUser {
  role_id?: number;
  [x: string]: any;
}
