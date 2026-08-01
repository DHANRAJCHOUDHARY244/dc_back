import { UpdateUser } from "./common.interface";

export interface UpdateInstaller extends UpdateUser {
  role_id?: number;
  [x: string]: any;
}
