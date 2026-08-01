import { sendEmail } from "@utils/email";
import notificationController from "@controllers/notification.controller";

export const buildAssessmentLink = (assessmentId: number, token: string) => {
  return `${process.env.FRONT_URL}/#/assessment/${assessmentId}?token=${token}`;
};

const buildAssessmentCreatedEmailTemplate = ({
  fullName,
  assessmentLink,
  services,
}: {
  fullName: string;
  assessmentLink: string;
  services: string[];
}) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin: 0 0 12px; color: #111827;">Site Assessment</h2>
        <p style="margin: 0 0 12px;">Hello ${fullName},</p>
        <p style="margin: 0 0 12px;">
          We've created a site assessment for you. Please complete the form by clicking the button below.
        </p>
        <p style="margin: 0 0 16px;">
          <a href="${assessmentLink}" style="background: #1890ff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
            Complete Assessment
          </a>
        </p>
        <p style="margin: 0 0 6px;"><strong>Services:</strong> ${services.join(", ")}</p>
        <p style="margin: 16px 0 0;">Best regards,<br/>SOMS Team</p>
      </div>
    </div>
  `;
};

export const sendAssessmentCreatedEmail = async ({
  email,
  fullName,
  services,
  assessmentLink,
}: {
  email: string;
  fullName: string;
  services: string[];
  assessmentLink: string;
}) => {
  const html = buildAssessmentCreatedEmailTemplate({
    fullName,
    assessmentLink,
    services,
  });
  await sendEmail(email, "Complete Your Site Assessment - SOMS", html);
};

export const notifyAssessmentCreated = async ({
  senderId,
  assessment,
  customerName,
  senderName,
  role,
  assessmentLink,
}: {
  senderId: number;
  assessment: any;
  customerName: string;
  senderName?: string;
  role?: string;
  assessmentLink: string;
}) => {
  await notificationController.createNotification({
    userId: senderId,
    message: `Assessment #${assessment.id} created.`,
    route: assessmentLink,
    meta: {
      customerId: assessment.customer_id,
      customerName,
      type: "ASSESSMENT",
      senderName,
      role,
    },
  });
};

export const notifyAssessmentFollowUp = async ({
  senderId,
  assessment,
  customerName,
  senderName,
  role,
  assessmentLink,
}: {
  senderId: number;
  assessment: any;
  customerName: string;
  senderName?: string;
  role?: string;
  assessmentLink: string;
}) => {
  await notificationController.createNotification({
    userId: senderId,
    message: `Follow-up sent for Assessment #${assessment.id}.`,
    route: assessmentLink,
    meta: {
      customerId: assessment.customer_id,
      customerName,
      type: "ASSESSMENT",
      senderName,
      role,
    },
  });
};

export const notifyAssessmentSubmitted = async ({
  senderId,
  assessment,
}: {
  senderId: number;
  assessment: any;
}) => {
  await notificationController.createNotification({
    userId: senderId,
    message: `Assessment #${assessment.id} submitted.`,
    route: `${process.env.FRONTEND_URL}/assessment/view/${assessment.id}`,
    meta: {
      customerId: assessment.customer_id,
      customerName: assessment.fullName,
      type: "ASSESSMENT",
      senderName: assessment.fullName,
    },
  });
};
