import { AuthenticatedRequest } from "@constants/common.interface";
import { ICreatePaymentBody, IUpdateInstallerBody, IUpdateSalesPersonBody } from "@constants/paymentHistory.interface";
import {
  BAD_REQUEST_CODE,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import {
  paymentHistoryRepository,
  quoteRepository,
  userRepository,
} from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import { Request, Response } from "express";

const attachUsers = async (record: any) => {
  if (!record) return record;
  const plain = record?.toObject?.() ?? record;
  const [installer, sales_person] = await Promise.all([
    plain.installer_id
      ? userRepository.findById(plain.installer_id, {
          select: "id name email profile_image",
          lean: true,
        })
      : null,
    plain.sales_person_id
      ? userRepository.findById(plain.sales_person_id, {
          select: "id name email profile_image",
          lean: true,
        })
      : null,
  ]);
  return { ...plain, installer, sales_person };
};

class PaymentHistoryController {
  async createPayment(req: Request, res: Response) {
    try {
      const data:ICreatePaymentBody = req.body;
      const paymentRecord = await paymentHistoryRepository.create({...data});
      return ReS(res, SUCCESS_CODE, "Payment history created successfully", {
        data: paymentRecord,
      });
    } catch (error) {
      console.error("Error in createPayment:", error);
      return ReE(res, SERVER_ERROR_CODE, "Error creating payment history");
    }
  }

  async getPaymentByQuoteId(req: AuthenticatedRequest, res: Response) {
    try {
      const { quote_id } = req.query;
      if (!quote_id) return ReE(res, BAD_REQUEST_CODE, "Invalid quote_id");

      let payHistory: any = await paymentHistoryRepository.findOne(
        { quote_id: Number(quote_id) },
        { sort: { created_at: -1 } },
      );
      if(!payHistory){
        const quote = await quoteRepository.findById(Number(quote_id));
        if(quote){
          payHistory = await paymentHistoryRepository.create({ quote_id: Number(quote_id) });
        }
      }
      const enriched = await attachUsers(payHistory);
      return ReS(res, SUCCESS_CODE, "Payment history fetched successfully", enriched);
    } catch (error) {
      console.error("Error in getPaymentByQuoteId:", error);
      return ReE(res, SERVER_ERROR_CODE, "Error fetching payment history");
    }
  }

  async deletePayment(req: Request, res: Response) {
    try {
      const { id }:any = req.params;
      const paymentRecord = await paymentHistoryRepository.findById(Number(id));
      if (!paymentRecord)
        return ReE(res, BAD_REQUEST_CODE, "Payment history not found");

      await paymentHistoryRepository.deleteById(Number(id));
      return ReS(res, SUCCESS_CODE, "Payment history deleted successfully");
    } catch (error) {
      console.error("Error in deletePayment:", error);
      return ReE(res, SERVER_ERROR_CODE, "Error deleting payment history");
    }
  }

  async updateInstaller(req: Request,res: Response) {
    try {
      const { id }:any = req.params;
      const updates:IUpdateInstallerBody = req.body;

      const paymentRecord:any = await paymentHistoryRepository.findById(Number(id));
      if (!paymentRecord)
        return ReE(res, BAD_REQUEST_CODE, "Payment history not found");

      const plain = paymentRecord?.toObject?.() ?? paymentRecord;
      const due =
        (updates.installer_total_amount ?? plain.installer_total_amount) -
        (updates.installer_partial_paid_amount ??
          plain.installer_partial_paid_amount);

      const updated = await paymentHistoryRepository.updateById(Number(id), {
        $set: {
          ...updates,
          installer_due_amount: due,
        },
      });

      return ReS(res, SUCCESS_CODE, "Installer payment updated successfully", {
        data: updated,
      });
    } catch (error) {
      console.error("Error in updateInstaller:", error);
      return ReE(res, SERVER_ERROR_CODE, "Error updating installer payment");
    }
  }

  async updateSalesPerson(req: Request,res: Response) {
    try {
      const { id }:any = req.params;
      const updates:IUpdateSalesPersonBody = req.body;

      const paymentRecord:any = await paymentHistoryRepository.findById(Number(id));
      if (!paymentRecord)
        return ReE(res, BAD_REQUEST_CODE, "Payment history not found");

      const plain = paymentRecord?.toObject?.() ?? paymentRecord;
      const due =
        (updates.sales_person_total_amount ??
          plain.sales_person_total_amount) -
        (updates.sales_person_partial_paid_amount ??
          plain.sales_person_partial_paid_amount);

      const updated = await paymentHistoryRepository.updateById(Number(id), {
        $set: {
          ...updates,
          sales_person_due_amount: due,
        },
      });

      return ReS(res, SUCCESS_CODE, "Sales person payment updated successfully", {
        data: updated,
      });
    } catch (error) {
      console.error("Error in updateSalesPerson:", error);
      return ReE(res, SERVER_ERROR_CODE, "Error updating sales person payment");
    }
  }
}

export default new PaymentHistoryController();
