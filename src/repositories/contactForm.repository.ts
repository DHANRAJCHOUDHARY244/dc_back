import ContactForm from "@models/contactForm.model";
import { BaseRepository } from "./BaseRepository";

export class ContactFormRepository extends BaseRepository {
  constructor() {
    super(ContactForm, true);
  }
}

export const contactFormRepository = new ContactFormRepository();
