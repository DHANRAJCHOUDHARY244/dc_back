import dayjs from "dayjs";
import { AuthenticatedRequest } from "@constants/common.interface";
import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { ReE, ReS } from "@services/generalHelper.service";
import { quoteRepository, invoiceRepository } from "@repositories";
import { Response } from "express";

const dateRangeFilter = (startDate: Date, endDate: Date) => ({
  $or: [
    { dateOfDue: { $gte: startDate, $lte: endDate } },
    { created_at: { $gte: startDate, $lte: endDate } },
  ],
});

export const CalenderController = {
  async getAll(req: AuthenticatedRequest, res: Response) {
    const { month, year } = req.query;

    if (!month || !year) {
      return ReE(res, BAD_REQUEST_CODE, "Month and Year required");
    }

    try {
      const startDate = dayjs(`${year}-${month}-01`).startOf("month").toDate();
      const endDate = dayjs(startDate).endOf("month").toDate();
      const filter = dateRangeFilter(startDate, endDate);

      const [quotes, invoices]: any = await Promise.all([
        quoteRepository.find(filter, { lean: true }),
        invoiceRepository.find(filter, { lean: true }),
      ]);

      const calendarItems = [
        ...quotes.map((q: any) => ({
          id: q.id,
          title: `Quotation: #${q.id || "Untitled"}`,
          start: dayjs(q.due_date || q.created_at).toISOString(),
          end: dayjs(q.dateOfDue).add(1, "hour").toISOString(),
          allDay: true,
          color: getColorByType("QUOTATION"),
          extendedProps: {
            type: "QUOTATION",
            status: q.customer_accepted,
          },
        })),
        ...invoices.map((inv: any) => ({
          id: inv.id,
          title: `Invoice: #${inv.id || "Untitled"}`,
          start: dayjs(inv.due_date || inv.created_at).toISOString(),
          end: dayjs(inv.dateOfDue).add(1, "hour").toISOString(),
          allDay: true,
          color: getColorByType("INVOICE"),
          extendedProps: {
            type: "INVOICE",
            status: inv.pay_status,
          },
        })),
      ];

      return ReS(res, SUCCESS_CODE, "Calendar items loaded", calendarItems);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch calendar items");
    }
  },
};

function getColorByType(type: string): string {
  const colorPalettes: Record<string, string[]> = {
    INVOICE: ["#42A5F5", "#64B5F6", "#2196F3", "#1E88E5"],
    QUOTATION: ["#66BB6A", "#81C784", "#43A047", "#388E3C"],
    DEFAULT: ["#BDBDBD", "#9E9E9E", "#757575"],
  };

  const palette = colorPalettes[type?.toUpperCase()] || colorPalettes.DEFAULT;
  return palette[Math.floor(Math.random() * palette.length)];
}
