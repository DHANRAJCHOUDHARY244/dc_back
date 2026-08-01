// interfaces/contactForm.interface.ts

export interface ContactFormPayload {
  name: string;
  email: string;
  mobile: string;
  address: string;
  postcode: string;
  subsurb: string;
  select_property_type: string;
  installation_date: string;
  interested_in: string[]; // checkbox-12
  message: string;
  heard_about_us: string[]; // checkbox-336
  consent: string; // always true
  signature_link: string;
}


export interface ContactFormPaginationFilterRequest {
    limit?: number;
    page?: number;
    name?: string;
    email?: string;
    mobile?: string;
    postcode?: string;
    select_property_type?: string;
    interested_in?: string;
    started_date?: string;
    end_date?: string;
}