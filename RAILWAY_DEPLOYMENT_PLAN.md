# 🚂 RolliSuite Railway Deployment Plan

**Created:** March 31, 2026  
**Target Platform:** Railway.app  
**Stack:** Node.js/Fastify + PostgreSQL + Redis + React/Vite  
**Status:** Ready for Deployment

---

## 📦 **Railway Services Architecture**

Railway will host 4 services:

```
┌─────────────────────────────────────────────────────┐
│                  Railway Project                    │
│                  "rollisuite-prod"                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ PostgreSQL  │  │    Redis    │  │ RolliSuite  │ │
│  │  (Managed)  │  │  (Managed)  │  │     API     │ │
│  │   Port:     │  │   Port:     │  │  (Fastify)  │ │
│  │   Internal  │  │   Internal  │  │  Port: 8001 │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│         ▲                ▲                ▲         │
│         │                │                │         │
│         └────────────────┴────────────────┘         │
│                          │                          │
│                  ┌───────▼────────┐                 │
│                  │  RolliSuite    │                 │
│                  │      Web       │                 │
│                  │ (Static Vite)  │                 │
│                  │   Port: 3000   │                 │
│                  └────────────────┘                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 **Service 1: PostgreSQL Database**

### **Setup:**
1. In Railway dashboard: **New → Database → PostgreSQL**
2. Name: `rollisuite-db`
3. Plan: **Hobby ($5/month)** for development, **Pro ($10/month)** for production

### **Auto-Generated Environment Variables:**
Railway automatically provides these (no manual setup needed):
- `DATABASE_URL` - Connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### **Configuration:**
- **Version:** PostgreSQL 16
- **Storage:** 1GB (Hobby) / 8GB (Pro)
- **Max Connections:** 20 (Hobby) / 100 (Pro)
- **Backups:** Daily automatic backups (Pro only)

### **Post-Creation:**
✅ Copy `DATABASE_URL` value (will use in API service)

---

## 🔧 **Service 2: Redis Cache**

### **Setup:**
1. In Railway dashboard: **New → Database → Redis**
2. Name: `rollisuite-redis`
3. Plan: **Hobby ($5/month)**

### **Auto-Generated Environment Variables:**
- `REDIS_URL` - Connection string (e.g., `redis://default:password@host:port`)

### **Configuration:**
- **Version:** Redis 7
- **Memory:** 256MB (Hobby) / 1GB (Pro)
- **Persistence:** RDB snapshots
- **Eviction Policy:** `allkeys-lru`

### **Post-Creation:**
✅ Copy `REDIS_URL` value (will use in API service)

---

## 🔧 **Service 3: RolliSuite API (Fastify)**

### **Setup:**
1. In Railway dashboard: **New → GitHub Repo**
2. Connect to your GitHub repository
3. **Root Directory:** `/apps/rollisuite-api`
4. **Builder:** Nixpacks (auto-detected)

### **Build Configuration:**

#### **Nixpacks Config** (auto-detected from `package.json`):
- **Install:** `corepack enable && yarn install`
- **Build:** `yarn prisma:generate && yarn build`
- **Start:** `yarn start`

#### **Custom `nixpacks.toml`** (create in `/app/apps/rollisuite-api/`):
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "yarn"]

[phases.install]
cmds = [
  "corepack enable",
  "corepack prepare yarn@4.1.1 --activate",
  "yarn install --immutable"
]

[phases.build]
cmds = [
  "yarn prisma:generate",
  "yarn build"
]

[start]
cmd = "yarn start"
```

### **Environment Variables (Manual Configuration):**

Copy these into Railway's environment variables section:

#### **Core Configuration:**
```env
NODE_ENV=production
API_PORT=8001
LOG_LEVEL=info

# Database (auto-populated by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Security
JWT_SECRET=<GENERATE_RANDOM_32_CHAR_STRING>
ENCRYPTION_KEY=<GENERATE_RANDOM_32_CHAR_STRING>

# CORS
WEB_URL=https://rollisuite-web.up.railway.app
ALLOWED_IPS=*

# Cron Jobs
ENABLE_CRON_JOBS=true
RW_STATUS_CRON_SCHEDULE=0 5 * * *
MAINTENANCE_CRON_SCHEDULE=0 2 * * *
VAULT_STORAGE_CRON_SCHEDULE=0 3 * * SUN
GOLD_PRICE_CRON_SCHEDULE=0 9 * * 1-5
```

#### **QuickBooks Online Integration:**
```env
QBO_CLIENT_ID=<YOUR_QBO_CLIENT_ID>
QBO_CLIENT_SECRET=<YOUR_QBO_CLIENT_SECRET>
QBO_REDIRECT_URI=https://rollisuite-api.up.railway.app/api/qbo/callback
QBO_ENVIRONMENT=production
QBO_WEBHOOK_VERIFIER_TOKEN=<YOUR_QBO_WEBHOOK_TOKEN>
```

#### **RolliWorking Integration:**
```env
ROLLIWORKING_API_URL=https://rolliworking.up.railway.app
ROLLIWORKING_API_KEY=<YOUR_RW_API_KEY>
ROLLIWORKING_WEBHOOK_SECRET=<GENERATE_RANDOM_32_CHAR_STRING>
```

#### **Email (Resend):**
```env
RESEND_API_KEY=<YOUR_RESEND_API_KEY>
FROM_EMAIL=noreply@yourdomain.com
```

#### **SMS (Twilio):**
```env
TWILIO_ACCOUNT_SID=<YOUR_TWILIO_SID>
TWILIO_AUTH_TOKEN=<YOUR_TWILIO_TOKEN>
TWILIO_PHONE_NUMBER=<YOUR_TWILIO_PHONE>
```

#### **Storage (Cloudflare R2):**
```env
R2_ACCOUNT_ID=<YOUR_R2_ACCOUNT_ID>
R2_ACCESS_KEY_ID=<YOUR_R2_ACCESS_KEY>
R2_SECRET_ACCESS_KEY=<YOUR_R2_SECRET>
R2_BUCKET_NAME=rollisuite-media
R2_PUBLIC_URL=https://media.yourdomain.com
```

### **Deploy Commands:**

#### **1. Initial Deployment:**
Railway will automatically run on push:
```bash
# Railway runs these automatically:
corepack enable
yarn install
yarn prisma:generate
yarn build
```

#### **2. Database Migration (One-Time):**
After first deployment, run migration via Railway CLI or dashboard:
```bash
railway run yarn prisma:migrate deploy
```

#### **3. Optional Seed Data:**
```bash
railway run yarn prisma:seed
```

### **Health Check:**
Railway will monitor: `GET https://rollisuite-api.up.railway.app/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-31T12:00:00.000Z"
}
```

### **Exposed Endpoints:**
- **API Base:** `https://rollisuite-api.up.railway.app/api`
- **Webhooks:** `https://rollisuite-api.up.railway.app/webhooks`
- **Public:** `https://rollisuite-api.up.railway.app/public`

---

## 🔧 **Service 4: RolliSuite Web (React/Vite)**

### **Setup:**
1. In Railway dashboard: **New → GitHub Repo**
2. Same repository as API
3. **Root Directory:** `/apps/rollisuite-web`
4. **Builder:** Nixpacks

### **Build Configuration:**

#### **Custom `nixpacks.toml`** (create in `/app/apps/rollisuite-web/`):
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "yarn"]

[phases.install]
cmds = [
  "corepack enable",
  "corepack prepare yarn@4.1.1 --activate",
  "yarn install --immutable"
]

[phases.build]
cmds = ["yarn build"]

[start]
cmd = "npx serve -s dist -l 3000"
```

### **Environment Variables:**
```env
NODE_ENV=production
VITE_API_URL=https://rollisuite-api.up.railway.app
```

### **Deploy Commands:**
```bash
# Auto-run by Railway:
yarn install
yarn build
npx serve -s dist -l 3000
```

### **Static Site Alternative (Recommended):**
Use Railway's **Static Site** feature:
1. Build command: `yarn build`
2. Output directory: `dist`
3. No start command needed (Railway serves static files)

---

## 🚀 **Deployment Steps (Complete Workflow)**

### **Phase 1: Pre-Deployment (Local Setup)**

#### **1. Enable Corepack:**
```bash
cd /app
corepack enable
corepack prepare yarn@4.1.1 --activate
```

#### **2. Install Dependencies:**
```bash
yarn install
```

#### **3. Generate Prisma Client:**
```bash
yarn workspace @rollisuite/api prisma:generate
```

#### **4. Create `.env` Files:**

**Backend** (`apps/rollisuite-api/.env`):
```env
DATABASE_URL=postgresql://rollisuite:password@localhost:5432/rollisuite
REDIS_URL=redis://localhost:6379
NODE_ENV=development
API_PORT=8001
JWT_SECRET=dev-secret-change-in-production
# ... (copy from .env.example)
```

**Frontend** (`apps/rollisuite-web/.env`):
```env
VITE_API_URL=http://localhost:8001
```

#### **5. Test Build Locally:**
```bash
# Backend
yarn workspace @rollisuite/api build

# Frontend
yarn workspace @rollisuite/web build
```

---

### **Phase 2: Railway Setup**

#### **1. Create Railway Account:**
- Go to https://railway.app
- Sign up with GitHub
- Create new project: `rollisuite-prod`

#### **2. Add PostgreSQL:**
- Click **New** → **Database** → **PostgreSQL**
- Name: `rollisuite-db`
- Plan: Hobby ($5/mo)
- ✅ Copy `DATABASE_URL` from **Variables** tab

#### **3. Add Redis:**
- Click **New** → **Database** → **Redis**
- Name: `rollisuite-redis`
- Plan: Hobby ($5/mo)
- ✅ Copy `REDIS_URL` from **Variables** tab

#### **4. Deploy API Service:**
- Click **New** → **GitHub Repo**
- Select your repository
- **Root Directory:** `apps/rollisuite-api`
- **Name:** `rollisuite-api`

**Configure Environment Variables:**
- Click **Variables** tab
- Paste all environment variables from section above
- Use Railway variable references:
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
  - `REDIS_URL=${{Redis.REDIS_URL}}`

**Custom Start Command (Settings → Deploy):**
- Build Command: `corepack enable && yarn install && yarn prisma:generate && yarn build`
- Start Command: `yarn start`

#### **5. Run Database Migration:**
After API deploys successfully:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Run migration
railway run --service rollisuite-api yarn prisma:migrate deploy
```

#### **6. Deploy Web Service:**
- Click **New** → **GitHub Repo**
- Same repository
- **Root Directory:** `apps/rollisuite-web`
- **Name:** `rollisuite-web`

**Environment Variables:**
```env
VITE_API_URL=${{rollisuite-api.RAILWAY_PUBLIC_DOMAIN}}
```

**Deploy Settings:**
- Build Command: `yarn install && yarn build`
- Output Directory: `dist`
- Use **Static Site** deployment

---

### **Phase 3: Post-Deployment Verification**

#### **1. Health Check:**
```bash
curl https://rollisuite-api.up.railway.app/health
# Expected: {"status":"ok","timestamp":"..."}
```

#### **2. Database Connection Test:**
```bash
curl https://rollisuite-api.up.railway.app/api/test
# Expected: {"message":"API routes working","timestamp":"..."}
```

#### **3. Test Endpoints (in order):**

**a. Customers API:**
```bash
# Create test customer (requires auth token - skip for now)
curl -X POST https://rollisuite-api.up.railway.app/api/customers \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"Customer","email":"test@example.com"}'
```

**b. QuickBooks OAuth:**
```bash
# Initiate QBO connection (requires admin auth)
open https://rollisuite-api.up.railway.app/api/qbo/connect
```

**c. Frontend:**
```bash
# Visit web app
open https://rollisuite-web.up.railway.app
```

---

## 🔐 **Authentication Setup Priority**

Before most endpoints are usable, implement auth middleware:

### **1. JWT Authentication Middleware** (`apps/rollisuite-api/src/middleware/auth.ts`):

Current status: **STUB** - needs implementation

**Required Implementation:**
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/client';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return reply.status(401).send({ error: 'Missing authentication token' });
    }

    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    
    // Fetch user from database
    const user = await prisma.profile.findUnique({
      where: { userId: decoded.userId },
      include: { userRole: true },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Attach user to request
    request.user = user;
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    if (!user || !user.userRole) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (!allowedRoles.includes(user.userRole.role)) {
      return reply.status(403).send({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: user.userRole.role 
      });
    }
  };
}
```

### **2. Login/Register Endpoints** (create `apps/rollisuite-api/src/modules/auth/`):

**Priority:** HIGH - Blocks all other testing

**Files to create:**
- `auth/service.ts` - bcrypt password hashing, JWT generation
- `auth/routes.ts` - POST /api/auth/login, POST /api/auth/register
- Register in `routes/api/index.ts`

---

## 🔗 **RolliWorking Webhook Handlers**

Current status: **STUB** - needs full implementation

**Location:** `apps/rollisuite-api/src/routes/webhooks/rolliworking.ts`

**Priority Webhooks to Implement:**

### **1. Job Status Update** (CRITICAL):
```typescript
POST /webhooks/rw/job-status-update
Payload: JobStatusUpdateEvent (from integration-contracts)
Action: Update job.status in database
```

### **2. Daily Hit List** (HIGH):
```typescript
POST /webhooks/rw/hit-list
Payload: DailyHitListEvent
Action: Store/replace hit list items, trigger notifications
```

### **3. Parts Approved** (HIGH):
```typescript
POST /webhooks/rw/parts-approved
Payload: PartsApprovedEvent
Action: Create sales order line items, update estimate
```

### **4. T&C Acceptance** (MEDIUM):
```typescript
POST /webhooks/rw/tc-acceptance
Payload: TcAcceptanceEvent
Action: Update sales order, store legal acceptance record
```

### **5. Watchmaker Assignment** (MEDIUM):
```typescript
POST /webhooks/rw/watchmaker-assigned
Payload: WatchmakerAssignmentEvent
Action: Update job.assignedTo field
```

### **6. Job Finished** (MEDIUM):
```typescript
POST /webhooks/rw/job-finished
Payload: JobFinishedEvent
Action: Update job.status = 'ready_to_ship', trigger notifications
```

**Implementation Order:**
1. Job Status Update (blocks all RW sync)
2. Daily Hit List (operational visibility)
3. Parts Approved (revenue flow)
4. T&C Acceptance (legal compliance)
5. Watchmaker Assignment (operational tracking)
6. Job Finished (completion flow)

---

## 📊 **Testable Endpoints After Auth Implementation**

### **Tier 1: Auth Required, No External Dependencies**
✅ Ready to test immediately after auth middleware:

1. `GET /api/customers` - List customers (pagination, search)
2. `POST /api/customers` - Create customer
3. `GET /api/customers/:id` - Get customer details
4. `PUT /api/customers/:id` - Update customer
5. `DELETE /api/customers/:id` - Delete customer
6. `POST /api/customers/check-duplicates` - Duplicate detection

7. `GET /api/estimates` - List estimates
8. `POST /api/estimates` - Create estimate
9. `GET /api/estimates/:id` - Get estimate details
10. `PUT /api/estimates/:id` - Update estimate

11. `GET /api/jobs` - List jobs
12. `POST /api/jobs` - Create job
13. `GET /api/jobs/:id` - Get job details
14. `PUT /api/jobs/:id` - Update job

15. `GET /api/sales-orders` - List sales orders
16. `POST /api/sales-orders` - Create SO
17. `GET /api/sales-orders/:id` - Get SO details

### **Tier 2: Requires QuickBooks Setup**
🟡 Testable after QBO OAuth connection:

18. `GET /api/qbo/connect` - Initiate OAuth
19. `GET /api/qbo/callback` - OAuth callback
20. `POST /api/qbo/customer/push` - Push customer to QBO
21. `POST /api/qbo/sales-order/push` - Create QBO invoice
22. `POST /api/qbo/invoice/sync-status` - Sync invoice payment status

### **Tier 3: Requires RolliWorking Deployment**
🟡 Testable after RW is deployed:

23. `POST /webhooks/rw/job-status-update`
24. `POST /webhooks/rw/hit-list`
25. `POST /webhooks/rw/parts-approved`
26. `POST /webhooks/rw/tc-acceptance`

---

## 🎨 **Frontend Migration Priority Order**

Based on operational value and dependency chain:

### **Phase 1: Foundation (Week 1)**

#### **Module 1: Authentication & Layout** (CRITICAL - BLOCKS EVERYTHING)
**Priority:** P0 - Start immediately  
**Files to Port:** 12 files
- `/pages/Auth.tsx` (Login page)
- `/components/auth/*` (Login form, password reset)
- `/components/layout/AppLayout.tsx` (Main app shell)
- `/components/layout/Navbar.tsx`
- `/components/layout/Sidebar.tsx`
- `/hooks/useAuth.ts` (Auth context + JWT storage)

**Why First:** Blocks all other pages, establishes routing foundation

**Estimated Time:** 2 days

---

#### **Module 2: Dashboard & Daily Hit List** (HIGH OPERATIONAL VALUE)
**Priority:** P1 - Start after auth  
**Files to Port:** 8 files
- `/pages/Dashboard.tsx` (Main dashboard with metrics)
- `/pages/DashboardNew.tsx` (Alternate dashboard view)
- `/components/workspace/DailyHitList.tsx`
- `/components/workspace/MetricCards.tsx`
- `/hooks/useJobs.ts` (Job data fetching)
- `/hooks/useDashboardStats.ts`

**Why Second:** Primary operational visibility, used daily by all users

**Estimated Time:** 3 days

---

### **Phase 2: Core CRUD (Week 2)**

#### **Module 3: Customers** (FOUNDATION FOR ALL SALES)
**Priority:** P1  
**Files to Port:** 10 files
- `/pages/estimates/CustomersPage.tsx` (Customer list)
- `/pages/estimates/CustomerDetailPage.tsx` (Customer detail view)
- `/components/customers/CustomerForm.tsx`
- `/components/customers/CustomerSearch.tsx`
- `/components/customers/AddressForm.tsx`
- `/hooks/useCustomers.ts`

**Why Third:** Required for creating estimates, jobs, sales orders

**Estimated Time:** 2 days

---

#### **Module 4: Estimates** (SALES FUNNEL START)
**Priority:** P1  
**Files to Port:** 15 files
- `/pages/estimates/EstimatesPage.tsx` (Estimate list)
- `/pages/estimates/EstimateDetailPage.tsx` (View/edit estimate)
- `/pages/estimates/CreateEstimatePage.tsx` (New estimate wizard)
- `/pages/estimates/EstimateTemplatesPage.tsx` (Template management)
- `/components/estimates/EstimateForm.tsx`
- `/components/estimates/EstimateLineItems.tsx`
- `/components/estimates/EstimatePricingTable.tsx`
- `/hooks/useEstimates.ts`
- `/hooks/useEstimateTemplates.ts`

**Why Fourth:** Core revenue generation, feeds into jobs and sales orders

**Estimated Time:** 4 days

---

### **Phase 3: Operations (Week 3)**

#### **Module 5: Jobs** (WORKSHOP OPERATIONS)
**Priority:** P1  
**Files to Port:** 12 files
- `/pages/JobDetail.tsx` (Job detail/edit)
- `/pages/CreateJob.tsx` (New job creation)
- `/pages/jobs/ShopTimePage.tsx` (Time tracking)
- `/components/workspace/JobCard.tsx`
- `/components/workspace/JobStatusBadge.tsx`
- `/components/workspace/JobTimeline.tsx`
- `/hooks/useJobs.ts` (if not done in Dashboard module)
- `/hooks/useJobStatusHistory.ts`

**Why Fifth:** Links estimates → workshop → completion

**Estimated Time:** 3 days

---

#### **Module 6: Sales Orders** (FULFILLMENT & INVOICING)
**Priority:** P1  
**Files to Port:** 10 files
- `/pages/sales/SalesOrdersPage.tsx` (SO list)
- `/pages/sales/SalesOrderDetailPage.tsx`
- `/components/sales/SalesOrderForm.tsx`
- `/components/sales/SalesOrderLineItems.tsx`
- `/components/sales/ShippingInfo.tsx`
- `/hooks/useSalesOrders.ts`

**Why Sixth:** Completes revenue cycle (estimate → job → SO → invoice)

**Estimated Time:** 3 days

---

### **Phase 4: Intake & Receiving (Week 4)**

#### **Module 7: Intake/Receiving** (CUSTOMER ONBOARDING)
**Priority:** P2  
**Files to Port:** 12 files
- `/pages/intake/ClientWatchEntryPage.tsx` (Manual intake)
- `/pages/intake/ReceivePackagesPage.tsx` (Package receiving)
- `/pages/intake/InspectionsPage.tsx` (Inspections list)
- `/pages/intake/IntakeLeadsPage.tsx` (Lead management)
- `/pages/intake/IntakeEmailPage.tsx` (Email intake)
- `/components/intake/ClientWatchForm.tsx`
- `/components/intake/BarcodeScanner.tsx`
- `/hooks/useIntake.ts`

**Why Seventh:** Customer onboarding, watch receiving, inspection flow

**Estimated Time:** 4 days

---

### **Phase 5: RolliWorking Integration Touchpoints (Week 5)**

#### **Module 8: RolliWorking Sync UI** (WORKSHOP INTEGRATION)
**Priority:** P2  
**Files to Port:** 8 files (estimated - may be embedded in other modules)
- `/components/workspace/RWStatusSync.tsx`
- `/components/workspace/HitListViewer.tsx`
- `/components/workspace/WatchmakerAssignment.tsx`
- `/components/workspace/PartsApprovalPanel.tsx`
- `/hooks/useRWStatus.ts`
- `/hooks/useHitList.ts`

**Why Eighth:** Operational sync between office (RS) and workshop (RW)

**Estimated Time:** 2 days

---

### **Phase 6: Inventory & Purchasing (Week 6)**

#### **Module 9: Inventory Management** (PARTS TRACKING)
**Priority:** P3 (Can operate without initially)  
**Files to Port:** 18 files
- `/pages/inventory/*` (Stock, locations, adjustments)
- `/components/inventory/*`
- `/hooks/useInventory.ts`
- `/hooks/useParts.ts`

**Estimated Time:** 5 days

---

#### **Module 10: Purchasing** (VENDOR MANAGEMENT)
**Priority:** P3  
**Files to Port:** 15 files
- `/pages/purchasing/*` (POs, vendors, receipts)
- `/components/purchasing/*`
- `/hooks/usePurchaseOrders.ts`
- `/hooks/useVendors.ts`

**Estimated Time:** 4 days

---

### **Phase 7: Reports & Settings (Week 7)**

#### **Module 11: Reports & Analytics** (BUSINESS INTELLIGENCE)
**Priority:** P3  
**Files to Port:** 10 files
- `/pages/reports/*`
- `/components/reports/*`
- `/hooks/useReports.ts`

**Estimated Time:** 3 days

---

#### **Module 12: Settings & Setup** (CONFIGURATION)
**Priority:** P3  
**Files to Port:** 12 files
- `/pages/setup/*`
- `/components/settings/*`
- `/components/users/*`
- `/hooks/useSettings.ts`

**Estimated Time:** 2 days

---

## 📈 **Frontend Migration Timeline Summary**

| Week | Modules | Files | Days | Cumulative | Value |
|------|---------|-------|------|------------|-------|
| **1** | Auth + Dashboard | 20 | 5 | 5 | 🔥 Critical - Enables login + visibility |
| **2** | Customers + Estimates | 25 | 6 | 11 | 🔥 Core revenue generation |
| **3** | Jobs + Sales Orders | 22 | 6 | 17 | ⭐ Operations + fulfillment |
| **4** | Intake/Receiving | 12 | 4 | 21 | ⭐ Customer onboarding |
| **5** | RW Integration UI | 8 | 2 | 23 | ⭐ Workshop sync |
| **6** | Inventory + Purchasing | 33 | 9 | 32 | ✅ Parts management |
| **7** | Reports + Settings | 22 | 5 | 37 | ✅ Admin & insights |

**Total:** ~37 days of development (7-8 weeks with QA/testing)

---

## 🎯 **Minimum Viable Deployment (MVD)**

To get RolliSuite operational as quickly as possible:

### **Backend MVD (Ready after auth implementation):**
✅ Customers CRUD  
✅ Estimates CRUD  
✅ Jobs CRUD  
✅ Sales Orders CRUD  
✅ QuickBooks integration  
🟡 Auth middleware (IMPLEMENT FIRST)  
🟡 RW webhook handlers (6 endpoints)  

**Time to MVD:** 3-5 days backend work

### **Frontend MVD (Core operational flow):**
✅ Login/Auth  
✅ Dashboard  
✅ Customers  
✅ Estimates  
✅ Jobs  
✅ Sales Orders  

**Time to MVD:** 17 days frontend work (Weeks 1-3)

### **Total Time to Operational System:**
**20-22 days** (4-5 weeks) to have a working ERP that can:
- Log in users
- Manage customers
- Create estimates
- Create jobs
- Fulfill sales orders
- Sync with QuickBooks
- Receive RolliWorking status updates

---

## 💰 **Railway Monthly Cost Estimate**

| Service | Plan | Cost |
|---------|------|------|
| PostgreSQL | Hobby | $5/mo |
| Redis | Hobby | $5/mo |
| RolliSuite API | Hobby (512MB RAM) | $5/mo |
| RolliSuite Web | Static (Free tier) | $0/mo |
| **Total** | | **$15/mo** |

**Pro Plan (Production):** $30-50/mo with higher limits and backups

---

## ✅ **Deployment Checklist**

### **Pre-Deployment:**
- [ ] Enable Corepack locally
- [ ] Install dependencies (`yarn install`)
- [ ] Generate Prisma client
- [ ] Test local build
- [ ] Create Railway account
- [ ] Prepare all API keys

### **Railway Setup:**
- [ ] Create new project
- [ ] Add PostgreSQL database
- [ ] Add Redis database
- [ ] Deploy API service
- [ ] Configure environment variables
- [ ] Run database migrations
- [ ] Deploy Web service
- [ ] Configure custom domain (optional)

### **Backend Development (Pre-Frontend):**
- [ ] Implement auth middleware (JWT)
- [ ] Create login/register endpoints
- [ ] Test customer CRUD with auth
- [ ] Implement RW webhook handlers (6 endpoints)
- [ ] Test QBO OAuth flow
- [ ] Verify all Prisma queries work

### **Frontend Migration:**
- [ ] Week 1: Auth + Dashboard
- [ ] Week 2: Customers + Estimates
- [ ] Week 3: Jobs + Sales Orders
- [ ] Week 4: Intake/Receiving
- [ ] Week 5: RW Integration UI
- [ ] Week 6+: Inventory, Purchasing, Reports (optional for MVD)

### **Testing & Cutover:**
- [ ] Backend API tests
- [ ] Frontend E2E tests
- [ ] Data migration from Supabase
- [ ] Webhook re-pointing (QBO, RW)
- [ ] Production deployment
- [ ] DNS cutover

---

**Next Step:** Proceed with Railway deployment and auth middleware implementation?
