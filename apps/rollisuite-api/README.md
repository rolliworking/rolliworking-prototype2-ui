# RolliSuite API

**Fastify + TypeScript + Prisma Backend**

---

## 📁 **Structure**

```
src/
├── modules/              # Business logic modules (8 core modules)
│   ├── qbo/              # QuickBooks Online (15 functions)
│   ├── rolliworking/     # RolliWorking integration (8 functions)
│   ├── notifications/    # Email & SMS (19 functions)
│   ├── shipping/         # Shipping & logistics (4 functions)
│   ├── referenceData/    # Model references, calibers
│   ├── media/            # Photo storage (R2)
│   ├── authSecurity/     # Auth, PIN, MFA, IP verification
│   └── maintenance/      # Cron jobs, utilities
│
├── routes/
│   ├── api/              # Internal API routes (authenticated)
│   ├── webhooks/         # External webhook endpoints
│   └── public/           # Public client-facing routes
│
├── middleware/
│   ├── auth.ts           # JWT, role, permission checks
│   ├── rate-limit.ts     # Custom rate limiting
│   └── error.ts          # Error handling
│
├── db/
│   └── client.ts         # Prisma client singleton
│
├── cron/
│   ├── rw-status-cron.ts        # Daily 5 AM
│   ├── maintenance-cron.ts      # Daily 2 AM
│   ├── vault-storage-cron.ts    # Daily 3 AM
│   └── gold-price-cron.ts       # Every 6 hours
│
├── config.ts             # Environment configuration
└── server.ts             # Fastify server entry point
```

---

## 🚀 **Development**

```bash
# Install dependencies
yarn install

# Generate Prisma client
yarn prisma:generate

# Run migrations
yarn prisma:migrate

# Start dev server (hot reload)
yarn dev

# Build for production
yarn build

# Start production
yarn start
```

---

## 🗄️ **Database**

### **Prisma Commands:**
```bash
# Open Prisma Studio (GUI)
yarn prisma:studio

# Create migration
yarn prisma:migrate dev --name migration_name

# Apply migrations
yarn prisma:migrate deploy

# Seed database
yarn prisma:seed
```

---

## 📦 **Module Structure**

Each module follows this pattern:

```typescript
modules/qbo/
├── index.ts              # Module exports
├── routes.ts             # Fastify routes
├── service.ts            # Business logic
├── oauth.ts              # OAuth2 flow
├── customers.ts          # Customer sync
├── invoices.ts           # Invoice sync
├── payments.ts           # Payment webhook
└── types.ts              # TypeScript types
```

---

## 🔐 **Authentication Flow**

1. User logs in → `/api/auth/login`
2. Backend verifies credentials
3. Backend generates JWT token (8h expiry)
4. Frontend stores token
5. Frontend sends token in `Authorization: Bearer <token>` header
6. Middleware verifies JWT on protected routes
7. Middleware checks role/permission

---

## 🔄 **Cron Jobs**

Scheduled jobs configured in `src/cron/`:

- **RW Status Cache** (5 AM) - Batch-fetch RolliWorking statuses
- **Maintenance** (2 AM) - Cache cleanup, view refresh
- **Vault Storage** (3 AM) - Apply $50/month fees to unpaid orders >45 days
- **Gold Price** (Every 6h) - Update spot price for appraisals

---

## 🧪 **Testing**

```bash
# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run coverage
yarn test:coverage
```

---

## 📝 **Adding a New Module**

1. Create `src/modules/my-module/`
2. Add `index.ts`, `routes.ts`, `service.ts`
3. Register routes in `src/routes/api/index.ts`
4. Add types to `packages/types`
5. Write tests in `__tests__/`

---

## 🔑 **Environment Variables**

See `../../.env.example` for all required variables.

**Critical:**
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - Token signing key
- `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET` - QuickBooks
- `ROLLIWORKING_API_KEY` - Workshop integration
- `RESEND_API_KEY` - Email
- `TWILIO_*` - SMS
- `R2_*` - Photo storage

---

## 📊 **API Documentation**

API documentation will be auto-generated from route schemas using Fastify's built-in support for Swagger/OpenAPI.

Access at: `http://localhost:8001/documentation`
