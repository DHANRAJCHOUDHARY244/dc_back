import { sendEventEmail } from "@services/email.service";
import notificationController from "@controllers/notification.controller";
import { followUpEmailTemplate } from "@template/followUpEmailTemplate";
import { getCompanyConfig } from "@services/crmSettings.service";
import { sendEmail } from "@utils/email";

const FRONT = process.env.FRONT_URL || "";

class StockOrderService {
  async sendCreatedNotification(order: any) {
    try {
      const tokens = order.bypass_token || {};
      const companyLink = `${FRONT}/#/stock-order/confirm/${order.id}/${tokens.company}`;
      const crmLink = `${FRONT}/#/stock-order/crm/${order.id}/${tokens.crm}`;

      const emailPayload = {
        email: order.emails_sent?.to,
        subject: `Stock Order #${order.id} Created`,
        client_name: "",
        id: order.id,
        type: "STOCK_ORDER",
        title: `Stock Order #${order.id}`,
        status: order.stock_order_status,
        event: "CREATED",
        link: companyLink,
      };
      if (emailPayload.email)
        await sendEventEmail(emailPayload as any, order.emails_sent?.cc, order.emails_sent?.bcc);

      await notificationController.createNotification({
        userId: order.sender_id,
        message: `Stock Order #${order.id} has been created.`,
        route: crmLink,
        meta: { type: "STOCK_ORDER", senderName: order.sender?.name, quoteId: order.quote_id },
      });
    } catch (err) {
      console.error("sendCreatedNotification error:", err);
    }
  }

  async sendConfirmedNotification(order: any) {
    try {
      const tokens = order.bypass_token || {};
      const driverLink = `${FRONT}/#/stock-order/deliveried/${order.id}/${tokens.driver}`;
      const crmLink = `${FRONT}/#/stock-order/crm/${order.id}/${tokens.crm}`;

      const emailPayload = {
        email: order.emails_sent?.to,
        subject: `Stock Order #${order.id} Confirmed`,
        id: order.id,
        type: "STOCK_ORDER",
        title: `Stock Order #${order.id}`,
        status: order.stock_order_status,
        event: "CONFIRMED",
        link: driverLink,
      };
      if (emailPayload.email)
        await sendEventEmail(emailPayload as any, order.emails_sent?.cc, order.emails_sent?.bcc);

      await notificationController.createNotification({
        userId: order.sender_id,
        message: `Stock Order #${order.id} has been confirmed.`,
        route: crmLink,
        meta: { type: "STOCK_ORDER", quoteId: order.quote_id },
      });
    } catch (err) {
      console.error("sendConfirmedNotification error:", err);
    }
  }

  async sendDeliveredNotification(order: any) {
    try {
      const tokens = order.bypass_token || {};
      const crmLink = `${FRONT}/#/stock-order/crm/${order.id}/${tokens.crm}`;

      const emailPayload = {
        email: order.emails_sent?.to,
        subject: `Stock Order #${order.id} Delivered`,
        id: order.id,
        type: "STOCK_ORDER",
        title: `Stock Order #${order.id}`,
        status: order.stock_order_status,
        event: "DELIVERED",
        link: crmLink,
      };
      if (emailPayload.email)
        await sendEventEmail(emailPayload as any, order.emails_sent?.cc, order.emails_sent?.bcc);

      await notificationController.createNotification({
        userId: order.sender_id,
        message: `Stock Order #${order.id} has been delivered.`,
        route: crmLink,
        meta: { type: "STOCK_ORDER", quoteId: order.quote_id },
      });
    } catch (err) {
      console.error("sendDeliveredNotification error:", err);
    }
  }

  async sendStatusUpdateNotification(order: any, oldStatus: string, newStatus: string, user: any) {
    try {
      const tokens = order.bypass_token || {};
      const crmLink = `${FRONT}/#/stock-order/crm/${order.id}/${tokens.crm}`;

      const emailPayload = {
        email: order.emails_sent?.to,
        subject: `Stock Order #${order.id} Status Updated to ${newStatus}`,
        id: order.id,
        type: "STOCK_ORDER",
        title: `Stock Order #${order.id}`,
        status: newStatus,
        event: "STATUS_UPDATED",
        link: crmLink,
      };
      if (emailPayload.email)
        await sendEventEmail(emailPayload as any, order.emails_sent?.cc, order.emails_sent?.bcc);

      await notificationController.createNotification({
        userId: order.sender_id,
        message: `Stock Order #${order.id} status changed from ${oldStatus} to ${newStatus} by ${user?.name || "System"}.`,
        route: crmLink,
        meta: {
          type: "STOCK_ORDER",
          event: "STATUS_UPDATED",
          oldStatus,
          newStatus,
          quoteId: order.quote_id,
          changedBy: user?.name,
        },
      });
    } catch (err) {
      console.error("sendStatusUpdateNotification error:", err);
    }
  }

  async sendFollowUpNotification(order: any, entry: any, user: any, recipientEmails: string[] = []) {
    try {
      const tokens = order.bypass_token || {};
      const crmLink = `${FRONT}/#/stock-order/crm/${order.id}/${tokens.crm}`;
      const companyLink = `${FRONT}/#/stock-order/confirm/${order.id}/${tokens.company}`;
      const driverLink = `${FRONT}/#/stock-order/deliveried/${order.id}/${tokens.driver}`;

      const noteSnippet = `"${entry.note.substring(0, 80)}${entry.note.length > 80 ? '...' : ''}"`;
      const priorityLabel = entry.priority === "urgent" ? " [URGENT]" : "";
      const subject = `Stock Order #${order.id}${priorityLabel} — New Follow-Up Note`;
      const companyName = order.company?.company_name || "";
      const followUpDateFormatted = entry.follow_up_date
        ? new Date(entry.follow_up_date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })
        : null;

      const emailsToSend = recipientEmails.length > 0
        ? [...new Set(recipientEmails)]
        : order.emails_sent?.to ? [order.emails_sent.to] : [];

      const cfg = await getCompanyConfig();

      for (const email of emailsToSend) {
        const isDriver = email === order.driver_email;
        const isCompany = email === order.emails_sent?.to;
        const recipientRole = isDriver ? "driver" : isCompany ? "company" : "team";
        const link = isDriver ? driverLink : isCompany ? companyLink : crmLink;

        const html = followUpEmailTemplate({
          orderId: order.id,
          note: entry.note,
          priority: entry.priority || "normal",
          createdBy: user?.name || "System",
          followUpDate: followUpDateFormatted,
          status: order.stock_order_status,
          link,
          companyName,
          recipientRole,
          cfg,
        });

        await sendEmail(email, subject, html).catch((e: any) =>
          console.error(`Follow-up email to ${email} failed:`, e.message)
        );
      }

      await notificationController.createNotification({
        userId: order.sender_id,
        message: `New follow-up on Stock Order #${order.id}: ${noteSnippet}`,
        route: crmLink,
        meta: {
          type: "STOCK_ORDER",
          event: "FOLLOW_UP",
          priority: entry.priority || "normal",
          sentTo: recipientEmails,
          quoteId: order.quote_id,
          followUpDate: entry.follow_up_date,
          createdBy: user?.name,
        },
      });
    } catch (err) {
      console.error("sendFollowUpNotification error:", err);
    }
  }
}

export default new StockOrderService();
