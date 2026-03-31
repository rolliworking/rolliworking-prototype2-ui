# RolliWorking Migration Plan

**Status:** 📋 **PLANNING** - Will migrate AFTER RolliSuite reaches 80%+

---

## 📊 **What is RolliWorking?**

**Purpose:** Workshop management application for watchmakers and technicians

**Users:**
- Watchmakers (repair technicians)
- Management (oversight)
- Customers (via approval emails)

**Key Features:**
- Job assignment and tracking
- Daily Hit List (color-coded priorities)
- Parts approval workflow
- Inspection notes
- Service options approval
- T&C acceptance
- Testing & quality control
- Client-facing approval emails (HTML)

---

## 🔗 **Integration with RolliSuite**

**Current Architecture:**
```
RolliSuite (Main ERP)
    ↓ (sends jobs via API)
RolliWorking (Workshop App)
    ↓ (sends status updates via webhooks)
RolliSuite (receives updates)
```

**8 Webhook Endpoints (RolliSuite receives):**
1. `/webhooks/rw/hit-list` - Daily Hit List push
2. `/webhooks/rw/job-status` - Job status updates
3. `/webhooks/rw/parts-approved` - Customer parts approval
4. `/webhooks/rw/tc-acceptance` - T&C accepted
5. `/webhooks/rw/watchmaker-assignment` - Job assigned
6. `/webhooks/rw/job-finished` - Job completed
7. `/webhooks/rw/inspection` - Inspection notes
8. `/webhooks/rw/testing` - Test results

**API Calls (RolliSuite → RolliWorking):**
- Push new jobs
- Sync model references
- Update customer info

---

## 📁 **RolliWorking Source Code**

**Location:** `/app/rolliworking-source/`

**Structure:**
```
rolliworking-source/
├── src/
│   ├── pages/              # React pages
│   ├── components/         # UI components
│   │   ├── jobs/           # Job management
│   │   ├── inspection/     # Inspection forms
│   │   ├── reports/        # Reporting
│   │   └── wiki/           # Reference wiki
│   ├── hooks/              # Custom hooks
│   └── types/              # TypeScript types
├── supabase/
│   ├── functions/          # Edge functions
│   └── migrations/         # Database schema
└── public/
```

---

## 🎯 **Migration Strategy**

### **Phase 1: RolliSuite First (Current)** ⏳
**Priority:** Finish RolliSuite to 80%+ completion

**Remaining RolliSuite Work:**
- ✅ Database schema (complete)
- ✅ QBO integration (complete)
- ✅ Customers API (complete)
- ✅ Estimates API (complete)
- ⏳ Sales Orders API
- ⏳ Jobs API
- ⏳ Inventory/Parts API
- ⏳ Frontend (0%)

**RolliWorking Preparation:**
- ✅ Source code downloaded
- ✅ Structure analyzed
- 🔄 Webhook stubs in RolliSuite (create minimal handlers)
- ⏳ Full migration (later)

---

### **Phase 2: RolliWorking Migration (Future)**

**When to Start:** After RolliSuite reaches 80%+

**Approach:** Separate project (Option A)

**Target Structure:**
```
rollisuite-emergent/          # Main ERP
├── apps/rollisuite-api/
└── apps/rollisuite-web/

rolliworking-emergent/        # Separate repo
├── apps/rolliworking-api/    # Node.js + Fastify
├── apps/rolliworking-web/    # React + TypeScript
└── packages/                 # Shared packages
```

**Migration Steps:**
1. Extract database schema from migrations
2. Create Prisma schema for RolliWorking
3. Port edge functions to Fastify
4. Port React components
5. Adapt hooks to new API
6. Test workflows end-to-end
7. Deploy separately from RolliSuite

**Estimated Time:** 1-2 weeks (faster than RolliSuite due to smaller scope)

---

## 🔄 **Interim Solution (Now)**

### **RolliWorking Webhook Stubs in RolliSuite**

Create minimal webhook handlers that work with **current Lovable RolliWorking**:

```typescript
// /app/apps/rollisuite-api/src/routes/webhooks/rolliworking.ts

// Daily Hit List webhook
POST /webhooks/rw/hit-list
- Receive hit list data
- Cache in database
- Log receipt

// Job Status webhook  
POST /webhooks/rw/job-status
- Update job status in RolliSuite
- Trigger notifications
- Log change

// Parts Approval webhook
POST /webhooks/rw/parts-approved
- Mark parts as approved
- Update estimate
- Notify office staff

// etc...
```

**Benefits:**
- RolliSuite can receive updates from existing RolliWorking
- Allows RolliSuite testing while RolliWorking still on Lovable
- Smooth transition when RolliWorking is migrated later

---

## 📋 **RolliWorking Features to Migrate**

### **Core Features:**
1. **Job Management**
   - View assigned jobs
   - Update job status
   - Add notes and photos
   - Complete jobs

2. **Daily Hit List**
   - Color-coded priorities
   - Overdue, Due Today, Due This Week
   - Parts Pending
   - Needs Attention
   - Completed

3. **Parts Approval**
   - Send approval emails to customers
   - Track responses
   - Update estimates with approved parts

4. **Inspection & Testing**
   - Timing tests
   - Pressure tests
   - Visual inspection
   - Photo documentation

5. **T&C Workflow**
   - Present terms to customers
   - Track acceptance
   - Store signatures

6. **Reporting**
   - Watchmaker productivity
   - Job completion rates
   - Average turnaround time

7. **Reference Wiki**
   - Model references
   - Caliber information
   - Part numbers
   - Service procedures

---

## 🚨 **Critical Dependencies**

**RolliSuite MUST have these before RolliWorking migration:**
- ✅ Jobs table (in schema)
- ⏳ Jobs API (create, read, update)
- ⏳ Job status management
- ⏳ Watchmaker assignment
- ⏳ Estimate/SO linking
- ⏳ Customer communication

**RolliWorking depends on RolliSuite for:**
- Customer data
- Estimate data
- Job data
- Model references
- Parts catalog

---

## 🎯 **Success Criteria**

### **RolliSuite (Must Complete First):**
- ✅ Database schema
- ✅ QBO integration
- ✅ Customer management
- ✅ Estimate management
- ⏳ Sales order management
- ⏳ Job management
- ⏳ Basic inventory
- ⏳ Email notifications
- ⏳ Frontend (at least core features)

### **RolliWorking (After RolliSuite):**
- Separate deployable application
- Receives jobs from RolliSuite
- Sends updates back via webhooks
- Client approval emails working
- Daily Hit List functional
- Testing workflows complete

---

## 📅 **Timeline Estimate**

**RolliSuite Completion:**
- Backend: ~3-5 days remaining (Sales Orders, Jobs, Inventory)
- Frontend: ~5-7 days (adapt hooks, build UI)
- Testing: ~2-3 days
- **Total: ~2 weeks to 80%+**

**RolliWorking Migration:**
- Database schema: ~1 day
- Backend APIs: ~3-4 days
- Frontend: ~3-4 days
- Testing: ~2 days
- **Total: ~1.5-2 weeks**

**Grand Total:** ~4 weeks for both applications

---

## 🔧 **Next Immediate Steps (RolliSuite)**

**Priority 1 (This Week):**
1. ✅ Complete Sales Orders API
2. ✅ Complete Jobs API
3. ✅ Create RolliWorking webhook stubs

**Priority 2 (Next Week):**
4. Frontend customer management
5. Frontend estimate creation
6. Frontend sales order management
7. Test full workflow

**Priority 3 (Week 3):**
8. Inventory/Parts API
9. Purchasing API
10. Additional features

**Then:** Start RolliWorking migration (Week 4)

---

## ✅ **Decision Summary**

**Confirmed Approach:**
- ✅ **Option A:** Separate projects
- ✅ **Priority:** Finish RolliSuite first (80%+)
- ✅ **RolliWorking:** Internal app for watchmakers
- ✅ **Source code:** Available for analysis
- ✅ **Interim:** Create webhook stubs in RolliSuite now
- ✅ **Full migration:** After RolliSuite is stable

**This approach ensures:**
- Clean separation of concerns
- Independent deployment
- RolliSuite can be tested while RolliWorking still on Lovable
- Minimal disruption to daily operations
- Systematic migration with clear milestones

---

**Status:** 📋 Plan complete, ready to continue RolliSuite development!
