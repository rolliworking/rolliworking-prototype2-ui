# RolliSuite + RolliWorking Monorepo

**Unified codebase for both applications with shared integration contracts**

---

## 🏗️ **Monorepo Structure (Option C)**

```
rollisuite-emergent/
├── apps/
│   ├── rollisuite-api/          ✅ In Progress (50%)
│   │   └── Fastify backend for main ERP
│   │
│   ├── rollisuite-web/          🟡 Scaffolded
│   │   └── React frontend for main ERP
│   │
│   ├── rolliworking-api/        ⏳ Future (after RolliSuite 80%+)
│   │   └── Fastify backend for workshop
│   │
│   └── rolliworking-web/        ⏳ Future
│       └── React frontend for workshop
│
├── packages/
│   ├── types/                   ✅ Complete
│   │   └── Shared TypeScript types
│   │
│   ├── lib/                     ✅ Complete
│   │   └── Shared utilities
│   │
│   └── integration-contracts/   ✅ NEW! Complete
│       └── RolliWorking ↔ RolliSuite event contracts
│
├── docker-compose.yml
├── .env.example
└── package.json (workspace root)
```

---

## 🔗 **Integration Architecture**

### **Communication Pattern:**
```
RolliSuite (Main ERP)
    ↓ REST API
    Push jobs, model references
    ↓
RolliWorking (Workshop App)
    ↓ Webhooks (8 event types)
    Job status, parts approvals, T&C, hit list
    ↓
RolliSuite (Updates & notifications)
```

### **Shared Integration Contracts:**
All event types, data structures, and API contracts defined in:
📦 **`packages/integration-contracts/`**

**Benefits:**
- ✅ Type safety across both apps
- ✅ Single source of truth for contracts
- ✅ Prevents integration drift
- ✅ Compile-time validation
- ✅ Shared between frontend & backend

---

## 📋 **Integration Contracts (Defined)**

### **RolliWorking → RolliSuite (8 Webhook Events):**

1. **`job.status.updated`** - Job status changes
   ```typescript
   interface JobStatusUpdateEvent {
     jobId: string;
     estimateNumber?: string;
     previousStatus?: JobStatus;
     newStatus: JobStatus;
     updatedBy?: string;
     notes?: string;
   }
   ```

2. **`job.watchmaker.assigned`** - Watchmaker assignment
   ```typescript
   interface WatchmakerAssignmentEvent {
     jobId: string;
     watchmakerId: string;
     watchmakerName?: string;
   }
   ```

3. **`job.finished`** - Job completion
   ```typescript
   interface JobFinishedEvent {
     jobId: string;
     completedBy?: string;
     completionNotes?: string;
     testResults?: any;
   }
   ```

4. **`parts.approved`** - Customer approved parts
   ```typescript
   interface PartsApprovedEvent {
     eventId: string; // Idempotency
     estimateNumber: string;
     approvedParts: Array<{
       description: string;
       quantity: number;
       unitPrice: number;
     }>;
     approvedAt: string;
   }
   ```

5. **`tc.accepted`** - T&C acceptance
   ```typescript
   interface TcAcceptanceEvent {
     estimateNumber: string;
     acceptedAt: string;
     signatureData?: string;
   }
   ```

6. **`hit_list.updated`** - Daily Hit List (full replacement)
   ```typescript
   interface DailyHitListEvent {
     generatedAt: string;
     items: HitListItem[];
     metadata: {
       totalJobs: number;
       overdueCount: number;
       // etc...
     };
   }
   ```

7. **`inspection.completed`** - Inspection notes
   ```typescript
   interface InspectionEvent {
     jobId: string;
     inspectionType: 'visual' | 'timing' | 'pressure';
     notes: string;
     photos?: string[];
   }
   ```

8. **`test.completed`** - Test results
   ```typescript
   interface TestResultsEvent {
     jobId: string;
     testType: 'timing' | 'pressure';
     passed: boolean;
     results: any;
   }
   ```

### **RolliSuite → RolliWorking (API Calls):**

1. **Push Job to Workshop**
   ```typescript
   POST /api/jobs
   interface PushJobToWorkshopRequest {
     jobId: string;
     estimateNumber: string;
     customerName: string;
     watch: { brand, model, etc };
     priority: 'low' | 'normal' | 'high' | 'urgent';
     dueDate?: string;
   }
   ```

2. **Query Job Status**
   ```typescript
   GET /api/jobs/:jobId/status
   interface QueryJobStatusResponse {
     status: JobStatus;
     assignedTo?: string;
     lastUpdated: string;
   }
   ```

3. **Sync Model References**
   ```typescript
   POST /api/model-references/sync
   interface SyncModelReferencesRequest {
     models: Array<{ brand, model, caliber }>;
   }
   ```

---

## 🎯 **Development Approach**

### **Phase 1: RolliSuite Core (Current - 80% target)**
**Timeline:** ~2 weeks

**Backend:**
- ✅ Database schema (complete)
- ✅ QBO integration (complete)
- ✅ Customers API (complete)
- ✅ Estimates API (complete)
- ✅ Integration contracts (complete) ← **NEW!**
- ⏳ Sales Orders API
- ⏳ Jobs API (with RolliWorking contracts)
- ⏳ Inventory/Parts API

**Frontend:**
- ⏳ Customer management
- ⏳ Estimate creation
- ⏳ Sales order management
- ⏳ Job tracking

### **Phase 2: RolliWorking (Future - after RolliSuite 80%+)**
**Timeline:** ~1.5-2 weeks

**Backend (apps/rolliworking-api/):**
- Extract database schema
- Create Prisma schema
- Implement job management
- Implement webhook sending (using contracts)
- Daily Hit List generation
- Parts approval workflow
- T&C workflow

**Frontend (apps/rolliworking-web/):**
- Job list & details
- Watchmaker assignment
- Testing & inspection forms
- Daily Hit List display

---

## 🛡️ **Architectural Principles**

### **1. Contract-First Integration**
- ✅ All events defined in `integration-contracts`
- ✅ Both apps import from same package
- ✅ Type safety enforced at compile time
- ✅ No integration drift

### **2. Clean Separation**
- ✅ RolliSuite = Main ERP (office, estimates, QBO, fulfillment)
- ✅ RolliWorking = Workshop (job tracking, testing, assignments)
- ✅ Shared contracts = Integration layer
- ✅ Shared utilities = Common code

### **3. Deployment Flexibility**
- Can deploy together as monorepo
- Can deploy separately if needed
- Shared packages ensure compatibility
- Coordinated versioning

### **4. Future-Proof**
- RolliWorking contracts defined NOW
- RolliSuite built with integration in mind
- No retrofitting needed
- Clean migration path

---

## 📊 **Current Status**

### **RolliSuite:**
| Component | Status | Progress |
|-----------|--------|----------|
| Database Schema | ✅ Complete | 100% |
| QBO Integration | ✅ Complete | 100% |
| Customers API | ✅ Complete | 100% |
| Estimates API | ✅ Complete | 100% |
| **Integration Contracts** | ✅ **Complete** | **100%** ← **NEW!** |
| Sales Orders API | ⏳ Next | 0% |
| Jobs API | ⏳ Next | 0% |
| Frontend | ⏳ Later | 0% |

**Overall:** ~55% complete (+5% for contracts)

### **RolliWorking:**
| Component | Status | Progress |
|-----------|--------|----------|
| Integration Contracts | ✅ Complete | 100% |
| Source Code | 📦 Available | - |
| Database Schema | ⏳ Waiting for spec | 0% |
| Backend API | ⏳ Future | 0% |
| Frontend | ⏳ Future | 0% |

**Overall:** Contracts ready, awaiting detailed spec

---

## 🚀 **Next Steps**

### **Immediate (This Session):**
1. ✅ **Integration contracts created**
2. ⏳ **Sales Orders API** (using contracts for job linking)
3. ⏳ **Jobs API** (using contracts for RolliWorking events)
4. ⏳ **RolliWorking webhook handlers** (receive events)

### **This Week:**
- Complete Sales Orders + Jobs APIs
- Create RolliWorking webhook receivers
- Test job workflow: Create → Assign → Status Update → Complete

### **Next Week:**
- Frontend development
- End-to-end testing
- Inventory/Parts API

### **Week 3-4:**
- RolliWorking migration (after receiving spec)

---

## 💡 **Key Advantages of This Approach**

### **1. Type Safety Everywhere**
```typescript
// Both apps use same contracts
import { JobStatusUpdateEvent } from '@rollisuite/integration-contracts';

// RolliWorking sends
const event: JobStatusUpdateEvent = { ... };

// RolliSuite receives (type-checked!)
function handleJobStatus(event: JobStatusUpdateEvent) { ... }
```

### **2. No Integration Drift**
- Contracts versioned together
- Breaking changes caught at compile time
- Documentation lives with types
- Single source of truth

### **3. Coordinated Development**
- Work on RolliSuite knowing RolliWorking contracts
- No guessing about event formats
- Clear integration boundaries
- Easy to test stubs

### **4. Future Flexibility**
- Can refactor either app independently
- Contracts remain stable
- Can add new events easily
- Can deprecate old events safely

---

## 📁 **Files Created (Integration Contracts)**

**New Package:**
- `/app/packages/integration-contracts/package.json`
- `/app/packages/integration-contracts/tsconfig.json`
- `/app/packages/integration-contracts/src/index.ts` (350+ lines)

**Defined:**
- 8 webhook event types (RolliWorking → RolliSuite)
- 3 API contracts (RolliSuite → RolliWorking)
- Shared data structures (Job, HitList, etc.)
- Error types
- Event constants

---

## ✅ **Ready to Proceed**

**Architecture:** ✅ Monorepo (Option C) with integration contracts  
**Contracts:** ✅ All RolliWorking events defined  
**RolliSuite:** ✅ 55% complete, RolliWorking-aware  
**Next:** ⏳ Sales Orders + Jobs APIs (using contracts)  

**Waiting for:** RolliWorking detailed spec (to start rolliworking-api/web)

**The foundation is now RolliWorking-ready!** 🎉
