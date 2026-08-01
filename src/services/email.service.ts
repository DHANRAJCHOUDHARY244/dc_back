import { CustomEmailContent, OtpContentData, SendEmailRegSignOtp, SendEventEmailParams } from "@constants/common.interface";
import { advertisingEmailTemplate, advertisingFeedBackEmailTemplate } from "@template/advertising";
import { closeQuoteEmailTemplate } from "@template/closeQuote";
import { customContent, otpContent, registrationContent } from "@template/contentEmail";
import { emailTemplate } from "@template/emailTemplate";
import { eventTemplate, otpRegSignEvents } from "@template/eventTemplate";
import { marketingSendEmail, sendEmail } from "@utils/email";
import { getCompanyConfig } from "@services/crmSettings.service";
import logger from "@utils/pino";

export const sendEmailRegistration = async (email: string) => {
    try {
        const template = emailTemplate(registrationContent(email));
        const resp = await sendEmail(email, 'Enrolled new course', template);
        logger.info(JSON.stringify(resp));
        return { ...resp };
    } catch (error) {
        logger.error(`${error}`)
        throw new Error(`'Internal Server Error!😞'+ ${error}`)
    }
}

export const sendEmailOtp = async (email: string, content: OtpContentData) => {
    try {
        const template = emailTemplate(otpContent(email, content));
        const resp = await sendEmail(email, content.title, template);
        return { ...resp };
    } catch (error) {
        logger.error(`${error}`);
        throw new Error(`Internal Server Error! 😞 ${error}`);
    }
};

export const sendEmailRegSignOtp = async ({ email, subject, client_name, id, type, message, otp }: SendEmailRegSignOtp): Promise<any> => {
    try {
        const cfg = await getCompanyConfig();
        const htmlContent = otpRegSignEvents(client_name,id,type,message,otp, cfg);
        const response = await sendEmail(email, subject, htmlContent);
        logger.info(JSON.stringify(response));
        return { ...response };
    } catch (error: any) {
        logger.error(`${error?.message || error}`);
        throw new Error(`Internal Server Error! 😞 ${error?.message || error}`);
    }
}


export const sendEventEmail = async (
    { email, subject, client_name, id, type, title, status, due_date, link, event }:
        SendEventEmailParams,cc?:string[],bcc?:string[]): Promise<any> => {
    try {
        const cfg = await getCompanyConfig();
        const htmlContent = eventTemplate(client_name, id, type, title, status, due_date, link, event, undefined, cfg);
        const response = await sendEmail(email, subject, htmlContent,cc,bcc);
        logger.info(JSON.stringify(response));
        return { ...response };
    } catch (error: any) {
        logger.error(`${error?.message || error}`);
        throw new Error(`Internal Server Error! 😞 ${error?.message || error}`);
    }
};
export const sendFeedbackEmail = async ({ email, client_name }) => {
    try {
        const cfg = await getCompanyConfig();
        const htmlContent = advertisingFeedBackEmailTemplate(client_name, cfg);
        const response = await sendEmail(email, 'Share your feedback 🌞', htmlContent);
        logger.info(JSON.stringify(response));
        return { ...response };
    } catch (error: any) {
        logger.error(`${error?.message || error}`);
        throw new Error(`Internal Server Error! 😞 ${error?.message || error}`);
    }
};

export const closeQuoteEmail = async ({email,name,link,id,due_date})=>{
    try {
        const htmlContent = closeQuoteEmailTemplate({name,link,id,due_date});
        const response = await sendEmail(email,"Close Quotation Information",htmlContent);
        logger.info(JSON.stringify(response));
        return { ...response };
    }  catch (error: any) {
        logger.error(`${error?.message || error}`);
        throw new Error(`Internal Server Error! 😞 ${error?.message || error}`);
    }
}


export const sendMarketingEmail = async (email: string, name:string) => {
    try {
        const cfg = await getCompanyConfig();
        const template = advertisingEmailTemplate(name, cfg);
        const resp = await marketingSendEmail(email, 'Save on Energy Bills with Solar, Battery & Heat Pump Solutions ⚡', template);
        logger.info(JSON.stringify(resp));
        return { ...resp };
    } catch (error) {
        logger.error(`${error}`)
        throw new Error(`'Internal Server Error!😞'+ ${error}`)
    }
};
