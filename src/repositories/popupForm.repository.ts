import PopupForm from "@models/popupForm.model";
import { BaseRepository } from "./BaseRepository";

export class PopupFormRepository extends BaseRepository {
  constructor() {
    super(PopupForm, true);
  }
}

export const popupFormRepository = new PopupFormRepository();
