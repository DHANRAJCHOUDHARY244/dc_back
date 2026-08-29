import ActivityTracker from "./activityTracker.model";
import Advertising from "./advertising.model";
import AccountsStockInvoice from "./accountsStockInvoice.model";
import AccountsStockDelivery from "./accountsStockDelivery.model";
import AccountsInstallerInvoice from "./accountsInstallerInvoice.model";
import AccountsRebate from "./accountsRebate.model";
import AccountsPreApprovalGrid from "./accountsPreApprovalGrid.model";
import AccountsSalesCommission from "./accountsSalesCommission.model";
import AllInOneJob from "./allInOneJob.model";
import Assessment from "./assessment.model";
import Chat from "./chat.model";
import ChatPermission from "./chatPermission.model";
import Company from "./company.model";
import CompanyBudgetMonth from "./companyBudgetMonth.model";
import CompanyBudgetYear from "./companyBudgetYear.model";
import ContactForm from "./contactForm.model";
import CrmSettings from "./crmSettings.model";
import CustomContact from "./customContact.model";
import CustomContactDocument from "./customContactDocument.model";
import CustomInvoice from "./customInvoice.model";
import Document from "./document.model";
import DuctedAssessment from "./ducted_assessment.model";
import Expense from "./expense.model";
import FinanceSnapshot from "./finance_snapshot.model";
import InstallerAgreement from "./installerAgreement.model";
import InstallerDocument from "./installerDocument.model";
import InstallerJob from "./installerJob.model";
import InstallerAvailability from "./installerAvailability.model";
import Invoice from "./invoice.model";
import Lead from "./lead.model";
import LeadAgent from "./leadAgent.model";
import LeadServiceArea from "./leadServiceArea.model";
import LeadDistributionSettings from "./leadDistributionSettings.model";
import Message from "./message.model";
import Notification from "./notifications";
import PaymentHistory from "./paymentHistory.model";
import Permission from "./permission.model";
import PopupForm from "./popupForm.model";
import Product from "./product.model";
import ProductItem from "./productItems.model";
import Quote from "./quote.model";
import QuoteChat from "./quote-chat.model";
import QuoteWorkflow from "./quoteWorkflow";
import Role from "./roles.model";
import Salary from "./salary.model";
import SiteInfo from "./site_info.model";
import StockOrder from "./stockOrder.model";
import SystemLog from "./systemLog.model";
import Task from "./task.model";
import User from "./users.model";
import UserPermission from "./userPermissions.model";
import VisitorLogs from "./visitorLogs.model";
import EmployeeProfile from "./employeeProfile.model";
import Shift from "./shift.model";
import Holiday from "./holiday.model";
import AttendanceRecord from "./attendanceRecord.model";
import AttendanceSettings from "./attendanceSettings.model";
import { LeaveType, LeaveBalance, LeaveRequest } from "./leave.model";
import AttendanceCorrection from "./attendanceCorrection.model";
import { AttendanceMonthLock, AttendanceAuditLog } from "./attendanceMeta.model";
import {
	TrainingCategory,
	TrainingResource,
	TrainingCourse,
	TrainingAssignment,
	TrainingProgress,
	TrainingVersion,
	TrainingSettings,
} from "./training.model";
import {
	FeedbackCase,
	FeedbackMessage,
	FeedbackInternalNote,
	FeedbackAuditLog,
	FeedbackSettings,
} from "./feedback.model";
import { SlaStageConfig, SlaDelayReason, SlaStageRun } from "./sla.model";
import { TaskTypeCatalog, EscalationRule, CrmFollowUp } from "./masterTask.model";
import RebateScheme from "./rebateScheme.model";

/** Alias avoids clash with DOM Document type in some tooling */
const DocumentModel = Document;

export {
  ActivityTracker,
  Advertising,
  AccountsStockInvoice,
  AccountsStockDelivery,
  AccountsInstallerInvoice,
  AccountsRebate,
  AccountsPreApprovalGrid,
  AccountsSalesCommission,
  AllInOneJob,
  Assessment,
  Chat,
  ChatPermission,
  Company,
  CompanyBudgetMonth,
  CompanyBudgetYear,
  ContactForm,
  CrmSettings,
  CustomContact,
  CustomContactDocument,
  CustomInvoice,
  DocumentModel,
  DuctedAssessment,
  Expense,
  FinanceSnapshot,
  InstallerAgreement,
  InstallerDocument,
  InstallerJob,
  InstallerAvailability,
  Invoice,
  Lead,
  LeadAgent,
  LeadServiceArea,
  LeadDistributionSettings,
  Message,
  Notification,
  PaymentHistory,
  Permission,
  PopupForm,
  Product,
  ProductItem,
  Quote,
  QuoteChat,
  QuoteWorkflow,
  Role,
  Salary,
  SiteInfo,
  StockOrder,
  SystemLog,
  Task,
  User,
  UserPermission,
  VisitorLogs,
  EmployeeProfile,
  Shift,
  Holiday,
  AttendanceRecord,
  AttendanceSettings,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  AttendanceCorrection,
  AttendanceMonthLock,
  AttendanceAuditLog,
  TrainingCategory,
  TrainingResource,
  TrainingCourse,
  TrainingAssignment,
  TrainingProgress,
  TrainingVersion,
  TrainingSettings,
  FeedbackCase,
  FeedbackMessage,
  FeedbackInternalNote,
  FeedbackAuditLog,
  FeedbackSettings,
  SlaStageConfig,
  SlaDelayReason,
  SlaStageRun,
  TaskTypeCatalog,
  EscalationRule,
  CrmFollowUp,
  RebateScheme,
};
