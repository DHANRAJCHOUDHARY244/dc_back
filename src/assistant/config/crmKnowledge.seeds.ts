/**
 * Complete DC CRM knowledge catalogue for RAG seeding.
 * Copilot uses these articles to answer employee questions about any CMS module or problem.
 * Bump SEED_CATALOG_VERSION when you add or change articles — startup will refresh embeddings.
 */
export const SEED_CATALOG_VERSION = "2026-08-28-v3";

export type CrmKnowledgeSeed = {
  title: string;
  category: string;
  seed_key: string;
  content: string;
};

export const CRM_KNOWLEDGE_SEEDS: CrmKnowledgeSeed[] = [
  {
    seed_key: "crm-overview",
    title: "DC CRM — Platform Overview",
    category: "general",
    content: `DC CRM (CMS) is the internal business system for solar sales and operations at Som's Energy / Crestwave.

SIDEBAR MENU ORDER (main modules):
1 Dashboard — KPIs, workbench, sales pipeline
2 Chat — internal team messaging
3 Assessment — site assessments and analysis
4 Quote — create, list, kanban task status, customer quote view
5 Solar Sketch — green sketch proposals and solar design
6 Invoice — invoices and custom invoices
7 Contact Form — website form submissions
8 Leads — sales pipeline, webhooks, manual entry
9 Product Items — product catalogue
10 Stock Orders — stock ordering and delivery
11 Master Tasks — follow-ups and task centre
12 Rebates & Incentives — rebate tracking
13 Calculator — solar system pricing with STC/rebates
14 Solar Battery CRM — battery-specific CRM
15 Pre Approval + Grid Assessment — all-in-one jobs, grid paperwork
16 Job SLA — SLA alerts and delayed jobs
17 Customer — customer accounts
18 Sales Person — sales team users
19 Installers — installer accounts
20 Map — geographic map view
21 Company — company units and branding
22 Finance — accounts, commissions, marketing spend
23 Training — LMS courses and assignments
24 Installer Jobs — installer workbench, calendar, job workspace
25 Management — users, roles, permissions, CRM settings, AI Assistant
26 Documents — letters, contracts, joining letters
27 Monitor — system health monitor
28 System Logs — application logs
29 Activity Tracker — user activity
30 Workflow — quote workflow automation
31 HR — attendance, leave, shifts, payroll
32 Feedback — employee feedback
33 Calendar — shared calendar
34 QR — QR code tools
35 Task — general tasks

NAVIGATION: Use the left sidebar menu. The breadcrumb at the top shows where you are.
Your role decides which menus you see — ask your manager or Super Admin if something is missing.
HELP CHAT: Click the chat button bottom-right to ask questions about any module.`,
  },
  {
    seed_key: "dashboard",
    title: "Dashboard & Workbench",
    category: "general",
    content: `DASHBOARD MODULE — Workbench and KPIs

LOCATION: Sidebar > Dashboard

FEATURES:
- Workbench: personalised home with greeting, company branding, quick stats
- Sales Pipeline: funnel view under Dashboard (if permission enabled)
- Analysis: dashboard analytics and charts
- Installer workbench: installers see their active jobs, upcoming visits, stats

COMMON TASKS:
- Check daily KPIs and pending work
- Sales leaders review pipeline counts
- Installers open active job cards from workbench

PROBLEMS:
- "Access restricted" on dashboard → your role lacks dashboard permission; contact Super Admin
- Missing metrics → may need permission for specific dashboard widgets
- Installer sees job board instead of full dashboard → normal for INSTALLER role`,
  },
  {
    seed_key: "chat",
    title: "Internal Chat",
    category: "general",
    content: `CHAT MODULE — Internal team messaging

LOCATION: Sidebar > Chat

FEATURES:
- Send messages to colleagues inside CRM
- Attach files to messages
- See new messages when you are online

NOT FOR: Talking to customers — use the customer quote link or email instead.

PROBLEMS:
- Chat not connecting → check internet; refresh page; verify logged in as staff not customer
- Missing chat menu → permission not enabled for your role`,
  },
  {
    seed_key: "assessment",
    title: "Assessment Module",
    category: "operations",
    content: `ASSESSMENT MODULE — Site assessments

LOCATION: Sidebar > Assessment

FEATURES:
- Assessment list and analysis views
- Site assessment data capture
- Linked to sales and quote workflow

WORKFLOW:
1. Create or receive assessment from lead/enquiry
2. Complete site details and photos
3. Use data for quote and solar sketch

PROBLEMS:
- Cannot find assessment → check filters and list view
- Missing menu → request Assessment permission from admin`,
  },
  {
    seed_key: "quotes-full",
    title: "Quotes — Complete Guide",
    category: "quotes",
    content: `QUOTE MODULE — Full workflow

LOCATION: Sidebar > Quote

SUB-MENUS:
- List: all quotes with search and filters
- Add New: create new quote
- Analysis: quote analytics
- Task Status: kanban board for quote progress stages
- Customer view: shareable link for customer to view/sign quote

CREATE A QUOTE:
1. Go to Quote > Add New (or List > Add)
2. Select or create customer
3. Add products, system size, pricing
4. Apply rebates (STC, state incentives) via Calculator if needed
5. Save and send to customer

TASK STATUS KANBAN:
- Drag quotes through pipeline stages
- Track team progress on open quotes

CONVERT TO INVOICE:
- From approved quote, convert to Invoice module

CUSTOMER QUOTE LINK:
- Generate customer view URL
- Customer can view without staff login (quote token)

PROBLEMS:
- Quote not saving → check required fields and permissions (create/update)
- Wrong pricing → verify Calculator settings and product items
- Customer cannot open link → check quote token and link expiry
- Missing quote in list → check filters, owner assignment, date range`,
  },
  {
    seed_key: "solar-sketch",
    title: "Solar Sketch & Proposals",
    category: "quotes",
    content: `SOLAR SKETCH MODULE — Design proposals

LOCATION: Sidebar > Solar Sketch

FEATURES:
- Solar system design on map/roof
- Proposal PDF generation
- Energy generation estimates
- Customer proposal share link

WORKFLOW:
1. Create sketch from lead or quote context
2. Configure panels, inverter, battery
3. Generate proposal document
4. Share proposal link with customer

PROBLEMS:
- Map not loading → check GOOGLE_MAPS_API_KEY configured on server
- Proposal PDF blank → ensure design data saved before export`,
  },
  {
    seed_key: "invoice-full",
    title: "Invoices — Complete Guide",
    category: "finance",
    content: `INVOICE MODULE

LOCATION: Sidebar > Invoice

FEATURES:
- Invoice list and create
- Custom invoices
- Customer invoice view (public link)
- Revenue tracking on dashboard

WORKFLOW:
1. Create from quote or standalone
2. Add line items, GST, payment terms
3. Send to customer
4. Track payment status

CUSTOM INVOICE:
- Separate flow for non-standard billing

PROBLEMS:
- Cannot edit invoice → may be locked after send; check role permissions
- Customer view not working → verify invoice token and status
- Logo wrong on PDF → update CRM Settings > invoice logo`,
  },
  {
    seed_key: "leads-full",
    title: "Leads — Complete Guide",
    category: "leads",
    content: `LEADS MODULE — Sales pipeline

LOCATION: Sidebar > Leads

FEATURES:
- Manual lead entry
- Web form and webhook ingestion
- Lead statuses and assignment
- Notes and activity history
- AI qualification (if enabled)

COMMON STATUSES: NEW_LEAD, AI_QUALIFIED, CONTACTED, QUALIFIED, CONVERTED, LOST (exact list may vary)

WORKFLOW:
1. Lead arrives (form, webhook, or manual)
2. Assign sales owner
3. Contact customer, add notes
4. Move through pipeline
5. Convert to quote or customer

WEBHOOKS:
- External sites can POST leads to CRM API
- Contact admin for webhook URL and keys

PROBLEMS:
- Lead not appearing → check webhook logs, duplicate email rules
- Cannot assign lead → verify leads update permission
- Wrong owner → edit assignment or ask manager
- Missing leads menu → permission not enabled`,
  },
  {
    seed_key: "contact-form",
    title: "Contact Form Submissions",
    category: "leads",
    content: `CONTACT FORM MODULE

LOCATION: Sidebar > Contact Form

FEATURES:
- View website contact form submissions
- Link submissions to leads pipeline

WORKFLOW:
1. Review new submissions
2. Qualify and convert to lead or customer
3. Assign to sales person

PROBLEMS:
- Submission missing → check website integration and backend logs
- Duplicate entries → normal if customer submitted twice`,
  },
  {
    seed_key: "product-stock",
    title: "Product Items & Stock Orders",
    category: "operations",
    content: `PRODUCT ITEMS & STOCK ORDERS

PRODUCT ITEMS (Sidebar > Product Items):
- Master catalogue of panels, inverters, batteries, accessories
- Used in quotes and calculator
- Admin maintains SKU, pricing, specs

STOCK ORDERS (Sidebar > Stock Orders):
- Order stock from suppliers
- Track delivery and confirmation
- Customer delivery confirmation links

WORKFLOW STOCK:
1. Create stock order
2. Add products and quantities
3. Submit and track status
4. Mark delivered when received

PROBLEMS:
- Product not in quote dropdown → check product is active in catalogue
- Stock order stuck → check status and approver`,
  },
  {
    seed_key: "master-tasks-rebates",
    title: "Master Tasks & Rebates",
    category: "operations",
    content: `MASTER TASKS (Sidebar > Master Tasks):
- Task Centre: all follow-up tasks
- Follow-ups: scheduled callbacks and actions
- Task Settings: configure task types and SLA (admin)

REBATES & INCENTIVES (Sidebar > Rebates):
- Track STC, state rebates, incentive programs
- Link to quotes and finance

PROBLEMS:
- Task not showing → check assignee and due date filters
- Missing follow-up badge → refresh page; check notification permissions`,
  },
  {
    seed_key: "calculator-battery",
    title: "Calculator & Solar Battery CRM",
    category: "quotes",
    content: `CALCULATOR (Sidebar > Calculator):
- Price solar systems with STC calculator
- Victoria, NSW, QLD rebate rules
- Admin can manage calculator catalogue

SOLAR BATTERY CRM (Sidebar > Solar Battery CRM):
- Battery-specific sales workflow
- Separate from standard solar quotes

PROBLEMS:
- Calculator wrong STC → verify system size, postcode, and year
- Catalogue item missing → admin: Calculator catalog settings`,
  },
  {
    seed_key: "pre-approval-grid",
    title: "Pre Approval & Grid Assessment",
    category: "operations",
    content: `PRE APPROVAL + GRID ASSESSMENT (Sidebar > Pre Approval)

Also called "All-in-One" jobs internally.

SUB-MENUS:
- Jobs list
- New Job
- Job Detail

WORKFLOW:
1. Create pre-approval / grid assessment job
2. Collect customer and site data
3. Track stages: pre-approval, grid application, approval
4. Upload documents and correspondence
5. Complete when grid connection approved

PROBLEMS:
- Job stage stuck → check assigned owner and required documents
- Cannot create job → verify create permission on module`,
  },
  {
    seed_key: "job-sla",
    title: "Job SLA Alerts",
    category: "operations",
    content: `JOB SLA MODULE (Sidebar > Job SLA)

FEATURES:
- Delayed jobs dashboard
- SLA settings (thresholds per stage)
- Alerts summary in header badge

WORKFLOW:
1. Configure SLA rules in SLA Settings
2. System flags jobs exceeding time limits
3. Managers review delayed jobs list

PROBLEMS:
- Too many SLA alerts → review SLA Settings thresholds
- Badge not updating → refresh; check polling not blocked`,
  },
  {
    seed_key: "installer-jobs-full",
    title: "Installer Jobs — Complete Guide",
    category: "operations",
    content: `INSTALLER JOBS (Sidebar > Installer Jobs)

FOR INSTALLERS:
- Job board with active, upcoming, completed jobs
- Job workspace: checklist, serials, photos, messages
- Calendar view for scheduled visits
- Dashboard workbench shows today's jobs

FOR ADMINS/MANAGERS:
- All jobs view
- Assign installer to site
- Track status: ASSIGNED, CONFIRMED, SCHEDULED, IN_PROGRESS, COMPLETED

WORKFLOW:
1. Quote/site approved → create installer job
2. Assign installer
3. Installer confirms and schedules
4. On-site: complete checklist, upload serials
5. Mark the job as complete

PROBLEMS:
- Installer sees no jobs → verify assignment and job status
- Cannot upload photo → check file size (max 40MB)
- Job not syncing → admin: site info sync runs on startup`,
  },
  {
    seed_key: "customers-sales-installers",
    title: "Customers, Sales Person & Installers",
    category: "admin",
    content: `CUSTOMER (Sidebar > Customer):
- Customer accounts and profiles
- Linked quotes, invoices, jobs
- Customer portal role (limited access)

SALES PERSON (Sidebar > Sales Person):
- Sales team user management
- Performance and assignments

INSTALLERS (Sidebar > Installers):
- Installer accounts
- Certifications and agreements
- Job assignment pool

CREATE USER (Admin):
Go to Management > System > User > Users List > Add

PROBLEMS:
- Customer cannot log in → check email is verified and account is active
- Wrong role → admin updates role in user management
- Installer missing from dropdown → check installer account is active`,
  },
  {
    seed_key: "company-map",
    title: "Company & Map",
    category: "admin",
    content: `COMPANY (Sidebar > Company):
- Multi company unit management
- Per-unit branding overrides
- Company unit selection on user profile

MAP (Sidebar > Map):
- Geographic view of jobs, leads, or sites
- Requires location data on records

CRM SETTINGS (Management > System > CRM Settings):
- Company name, ABN, logos, favicon
- Quote logo, invoice logo, email logo
- Used by PDFs, emails, and AI Copilot branding

PROBLEMS:
- Wrong logo on quote → Management > CRM Settings > quote logo
- Map empty → records need a full address saved on them`,
  },
  {
    seed_key: "finance-full",
    title: "Finance Module",
    category: "finance",
    content: `FINANCE (Sidebar > Finance)

SUB-AREAS:
- Accounts: financial accounts overview
- Sales commissions
- Marketing spend
- Installer invoices
- Stock invoices and delivery
- Pre-approval grid accounts
- Rebates accounts

WORKFLOW COMMISSIONS:
1. Sales person closes deal
2. Commission record created
3. Accounts manager reviews and approves
4. Payment processed

PROBLEMS:
- Cannot see finance menu → role needs finance permission
- Commission wrong → verify quote value and commission rules
- Export failed → check date range and filters`,
  },
  {
    seed_key: "hr-training",
    title: "HR & Training",
    category: "hr",
    content: `HR MODULE (Sidebar > HR):
- Attendance tracking
- Leave management and approvals
- Shift management
- Payroll and salary
- HR settings

TRAINING (Sidebar > Training):
- Courses and modules
- Assign training to staff
- Track completion
- Training settings (admin)

PROBLEMS:
- Leave not approved → check approver chain and HR settings
- Attendance missing → verify clock-in/out or shift assignment
- Training not visible → assign course to user or role`,
  },
  {
    seed_key: "documents-workflow",
    title: "Documents & Workflow",
    category: "admin",
    content: `DOCUMENTS (Sidebar > Documents Center):
- Letter pad
- Joining letters
- User documents
- Custom contacts and contracts

WORKFLOW (Sidebar > Workflow):
- Quote workflow automation
- Stage-based approvals
- Document generation triggers

PROBLEMS:
- Document template wrong → check template in Documents admin
- Workflow stuck → verify all approval steps completed`,
  },
  {
    seed_key: "management-permissions",
    title: "Management, Permissions & Roles",
    category: "admin",
    content: `MANAGEMENT MODULE (Sidebar > Management)

SYSTEM SUB-MENUS:
- Permission: assign menu access per role (enable, create, update, delete)
- Role: define roles
- User: system user list and analysis
- CRM Settings: company branding
- AI Assistant: copilot config, knowledge, rules

SYNC PERMISSIONS:
When a new menu is added to CRM, your Super Admin or IT support may need to refresh permissions. After that, log out and log back in.

Super Admin can access all menus.

PROBLEMS:
- Menu missing → Management > Permission: enable for your role, then log out and back in
- Access denied page → you do not have permission; contact Super Admin
- Cannot delete a user → Super Admin and the system owner account cannot be deleted
- Breadcrumb looks wrong → refresh the page (Ctrl+F5)`,
  },
  {
    seed_key: "ai-assistant-guide",
    title: "How to Use the Help Chat",
    category: "general",
    content: `DC CRM HELP CHAT (floating button, bottom-right)

FOR ALL STAFF:
1. Click the chat button on any CRM page
2. Type your question in normal words — e.g. "How do I make a quote?" or "I can't see my installer jobs"
3. Follow the steps in the answer
4. Use the quick buttons for common topics: quotes, leads, jobs, invoices

GOOD QUESTIONS TO ASK:
- Where do I find pre-approval?
- How do I assign a lead to someone?
- Why is a menu missing after login?
- What do I do when a customer cannot open their quote link?

FOR ADMINS (Management > System > AI Assistant):
- Turn help chat on or off
- Set welcome message and company rules
- Control which teams see which help topics
- Upload company PDF or Word guides (policies, SOPs)

PROBLEMS:
- Chat not answering → contact Super Admin (system may need setup)
- Chat button missing → your role may not have access, or you are logged in as a customer
- Wrong answer → tell admin to upload the correct company guide in AI Assistant settings`,
  },
  {
    seed_key: "auth-login-problems",
    title: "Login & Account Problems",
    category: "general",
    content: `LOGIN & ACCOUNT TROUBLESHOOTING

COMMON ERRORS:
- "Invalid credentials" → wrong email/username or password
- "Email not verified" → check inbox for OTP; admin can verify in user management
- "Account is deactivated" → admin must set is_active = true
- "Access restricted" → role lacks permission for that page

PASSWORD RESET:
- Use Forgot password on the login page
- Admin can set a new password from user management

AFTER PERMISSION CHANGES:
Always log out and log back in so your menus refresh.`,
  },
  {
    seed_key: "common-cms-problems",
    title: "Common CMS Problems & Fixes",
    category: "general",
    content: `COMMON DC CRM PROBLEMS & FIXES

MENU / ACCESS:
- Missing menu item → ask admin: Management > Permission > enable for your role, then log out and back in
- Access denied page → no permission for that page; contact Super Admin
- Super Admin should see everything → log in with Super Admin account

DATA NOT SHOWING:
- Clear date filters and the search box
- You may only see records assigned to you — check with your manager
- Refresh the page (Ctrl+F5)

UPLOAD FAILURES:
- Maximum file size is 40 MB
- Try a smaller file or a different format (photo, PDF)

EMAIL NOT ARRIVING:
- Check spam/junk folder
- Confirm the email address is correct
- Ask admin to check email settings

SLOW PAGES:
- Check your internet connection
- Clear browser cache and try again

WHEN STILL STUCK:
1. Write down the exact error message
2. Note which menu you were in
3. Contact your manager or Super Admin
4. Or ask the help chat on this page`,
  },
  {
    seed_key: "roles-explained",
    title: "User Roles Explained",
    category: "admin",
    content: `CRM USER ROLES (plain names)

LEADERSHIP & ADMIN:
- Super Admin — full access to everything
- CEO — executive access
- Admin — system administration
- Manager — team oversight

SALES TEAM:
- Sales person, sales leader, sales executive, business development

OPERATIONS:
- Operations manager, installer, customer support

FINANCE:
- Accounts manager

HR:
- HR executive

CUSTOMERS:
- Customer — portal only, no staff menus, no help chat

Each role sees different sidebar menus. Admins set this under Management > Permission.
Installers usually see Installer Jobs as their home instead of the full dashboard.`,
  },
];
