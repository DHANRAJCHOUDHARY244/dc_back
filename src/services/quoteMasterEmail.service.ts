import { sendEmail } from "@utils/email";
import logger from "@utils/pino";
import { quoteRepository, roleRepository, userRepository } from "@repositories";
import { Roles } from "src/data/dataInserter";
import { QuoteEmailOptions, QuoteEmailType } from "@constants/quoteEmailconstants";
import { eventTemplate } from "@template/eventTemplate";
import { EVENT_TASK_TYPE } from "@constants/socket.constants";
import { advertisingFeedBackEmailTemplate } from "@template/advertising";
import { closeQuoteEmailTemplate } from "@template/closeQuote";
import { getCompanyConfig } from "@services/crmSettings.service";
import { buildAssessmentLink } from "@services/assessment.service";

export const sendMasterQuoteEmail = async (
  options: QuoteEmailOptions,
  isAttachAssessmentWithQuoteMail?: boolean,
) => {
  try {
    const { quote_id, type, cc = [], bcc = [] } = options;

    const populate: any[] = [
      { path: "customer", select: "id name email mobile_no address" },
      { path: "sender", select: "id name email mobile_no" },
      { path: "cf", select: "name email address mobile postcode subsurb" },
    ];
    if (isAttachAssessmentWithQuoteMail) {
      populate.push({ path: "assessment", select: "id token" });
    }

    const quote: any = await quoteRepository.findOne(
      { id: quote_id },
      { populate, lean: true },
    );

    if (!quote) throw new Error("Quote not found");

    let assessmentLink = "";
    if (isAttachAssessmentWithQuoteMail && quote.assessment) {
      assessmentLink = buildAssessmentLink(quote.assessment.id, quote.assessment.token);
    }

    const { sender, customer, bypass_token, name, dateOfDue, customer_accepted } = quote;

    const customerName = customer?.name || name || quote.cf?.name;
    const customerEmail = customer?.email || quote.cf?.email;
    if (!customerEmail) {
      throw new Error("Customer email is missing for this quote");
    }

    const objectId = quote._id ? String(quote._id) : "";
    const link = quote.is_solar_sketch && objectId
      ? `${process.env.FRONT_URL}/#/green-sketch/proposal/${objectId}/${quote_id}/${bypass_token}`
      : `${process.env.FRONT_URL}/#/quote/customer-view/${quote_id}/${bypass_token}`;

    let ccList = [...cc];
    let bccList = [...bcc];
    const SUPER_ADMIN_EMAILS: string[] = [];

    const superAdminRole: any = await roleRepository.findOne(
      { name: Roles.SUPER_ADMIN },
      { select: "id", lean: true },
    );

    if (superAdminRole) {
      const superAdmins = await userRepository.find(
        { role_id: superAdminRole.id },
        { select: "email", lean: true },
      );
      SUPER_ADMIN_EMAILS.push(...superAdmins.map((u: any) => u.email));
    }

    if (sender?.email) {
      ccList.push(sender.email);
    }

    ccList = [...new Set(ccList)];
    bccList = [...new Set(bccList)];

    const emailPayload = {
      email: customerEmail,
      subject: "",
      client_name: customerName,
      id: quote_id,
      type: "QUOTE",
      title: `Quotation #${quote.id}`,
      status: customer_accepted,
      due_date: dateOfDue,
      link,
      event: "",
      assessmentLink: "",
    };

    const cfg = await getCompanyConfig();
    let htmlTemplate = "";

    switch (type) {
      case QuoteEmailType.CREATED:
        emailPayload.subject = "Your Quote Has Been Created ✔";
        emailPayload.event = EVENT_TASK_TYPE.CREATED;
        emailPayload.assessmentLink = assessmentLink;
        htmlTemplate = eventTemplate(
          emailPayload.client_name,
          emailPayload.id,
          emailPayload.type,
          emailPayload.title,
          emailPayload.status,
          emailPayload.due_date,
          emailPayload.link,
          emailPayload.event,
          emailPayload.assessmentLink,
          cfg,
        );
        break;

      case QuoteEmailType.UPDATED:
        emailPayload.subject = "Your Quote Has Been Updated ✨";
        emailPayload.event = EVENT_TASK_TYPE.UPDATED;
        ccList.push(...SUPER_ADMIN_EMAILS);
        htmlTemplate = eventTemplate(
          emailPayload.client_name,
          emailPayload.id,
          emailPayload.type,
          emailPayload.title,
          emailPayload.status,
          emailPayload.due_date,
          emailPayload.link,
          emailPayload.event,
          undefined,
          cfg,
        );
        break;

      case QuoteEmailType.STATUS_UPDATED:
        emailPayload.subject = `📄 Your Quote Status Has Been Updated to ${customer_accepted}`;
        emailPayload.event = EVENT_TASK_TYPE.UPDATED;
        ccList.push(...SUPER_ADMIN_EMAILS);
        htmlTemplate = eventTemplate(
          emailPayload.client_name,
          emailPayload.id,
          emailPayload.type,
          emailPayload.title,
          emailPayload.status,
          emailPayload.due_date,
          emailPayload.link,
          emailPayload.event,
          undefined,
          cfg,
        );
        break;

      case QuoteEmailType.FOLLOW_UP:
        ccList.push(...SUPER_ADMIN_EMAILS);
        emailPayload.subject = `🔔 Follow Up: Quotation #${quote_id}`;
        emailPayload.event = EVENT_TASK_TYPE.UPDATED;
        emailPayload.status = "Follow Up";
        htmlTemplate = eventTemplate(
          emailPayload.client_name,
          emailPayload.id,
          emailPayload.type,
          emailPayload.title,
          emailPayload.status,
          emailPayload.due_date,
          emailPayload.link,
          emailPayload.event,
          undefined,
          cfg,
        );
        break;

      case QuoteEmailType.CLOSED: {
        emailPayload.subject = "Your Quote Has Been Proceed To Closed ❗";
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        htmlTemplate = closeQuoteEmailTemplate({
          id: quote_id,
          name: customerName,
          link,
          due_date: dueDate.toISOString().split("T")[0],
        });
        break;
      }

      case QuoteEmailType.FEEDBACK:
        emailPayload.subject = "Share your feedback 🌞";
        ccList.push(...SUPER_ADMIN_EMAILS);
        htmlTemplate = advertisingFeedBackEmailTemplate(emailPayload.client_name, cfg);
        break;

      default:
        throw new Error("Invalid email type");
    }

    await sendEmail(
      emailPayload.email,
      emailPayload.subject,
      htmlTemplate,
      ccList,
      bccList,
    );

    logger.info(`Quote email sent → ${emailPayload.email}`);
  } catch (error: any) {
    logger.error(error);
    throw new Error(`Master Quote Email Failed: ${error.message}`);
  }
};
