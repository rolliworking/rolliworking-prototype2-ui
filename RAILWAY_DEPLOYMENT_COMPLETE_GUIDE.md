# 🚂 Complete Railway Deployment Guide - RolliSuite

**Last Updated**: April 1, 2026  
**Deployment Status**: ✅ Code Ready for Production  
**Target Platform**: Railway.app

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Database Configuration](#database-configuration)
4. [Backend Service Deployment](#backend-service-deployment)
5. [Frontend Service Deployment](#frontend-service-deployment)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Verification & Testing](#verification--testing)
8. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

Before you begin, ensure you have:

- [ ] Railway account created ([railway.app](https://railway.app))
- [ ] GitHub/GitLab repository with RolliSuite code
- [ ] Railway CLI installed (optional but recommended)
- [ ] PostgreSQL database ready (Railway provides this)
- [ ] QuickBooks Online credentials (for QBO integration)
- [ ] Cloudflare R2 credentials (for file storage)
- [ ] Resend API key (for emails)
- [ ] Twilio credentials (for SMS)

---

## 🏗️ Project Setup

### Step 1: Create New Railway Project

1. **Login to Railway Dashboard**
   - Visit [railway.app](https://railway.app)
   - Click "New Project"
   - Choose "Deploy from GitHub repo"

2. **Connect GitHub Repository**
   - Select your RolliSuite repository
   - Railway will detect the monorepo structure

3. **Project Structure**
   ```
   RolliSuite Project (Railway)
   ├── rollisuite-api (Backend Service)
   ├── rollisuite-web (Frontend Service)
   ├── PostgreSQL Database
   └── Redis (Optional)
   ```

---

## 🗄️ Database Configuration

### Step 2: Add PostgreSQL Database

1. **Add PostgreSQL Service**
   - In Railway project dashboard
   - Click "+ New" → "Database" → "Add PostgreSQL"
   - Railway auto-generates `DATABASE_URL` variable

2. **Add Redis (Optional)**
   - Click "+ New" → "Database" → "Add Redis"
   - Railway auto-generates `REDIS_URL` variable
   - **Note**: Redis is used for caching & job queues (optional for MVP)

3. **Verify Database Variables**
   ```bash
   # PostgreSQL variables auto-created by Railway:
   DATABASE_URL=postgresql://user:pass@host:port/db
   PGHOST=containers-us-west-xxx.railway.app
   PGPORT=5432
   PGUSER=postgres
   PGPASSWORD=xxxxx
   PGDATABASE=railway
   ```

---

## 🔧 Backend Service Deployment

### Step 3: Configure Backend Service

1. **Create Backend Service**
   - Click "+ New" → "GitHub Repo" (if not auto-created)
   - Name it: `rollisuite-api`

2. **Service Settings**

   **Root Directory:**
   ```
   apps/rollisuite-api
   ```

   **Build Command:**
   ```bash
   yarn install && npx prisma generate && yarn build
   ```

   **Start Command:**
   ```bash
   yarn start
   ```

   **Watch Paths (optional):**
   ```
   apps/rollisuite-api/**
   packages/**
   ```

3. **Add `start` Script to package.json**

   **File**: `/app/apps/rollisuite-api/package.json`
   
   Add this to `scripts` section:
   ```json
   {
     "scripts": {
       "dev": "tsx watch src/server.ts",
       "build": "tsc",
       "start": "node dist/server.js",
       "prisma:generate": "prisma generate",
       "prisma:migrate": "prisma migrate deploy"
     }
   }
   ```

4. **Environment Variables (Backend)**

   Go to Service Settings → Variables → Add the following:

   **Required Core Variables:**
   ```env
   NODE_ENV=production
   API_PORT=8001
   
   # Database (auto-injected by Railway PostgreSQL service)
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   
   # Redis (auto-injected if you added Redis service)
   REDIS_URL=${{Redis.REDIS_URL}}
   
   # Authentication
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   JWT_EXPIRES_IN=8h
   BCRYPT_ROUNDS=10
   
   # CORS - CRITICAL: Set this after frontend is deployed
   WEB_URL=http://localhost:3000
   WEB_URL_PRODUCTION=${{rollisuite-web.url}}
   
   # Encryption
   PROXY_ID_ENCRYPTION_KEY=your-32-char-encryption-key-here
   ```

   **QuickBooks Online:**
   ```env
   QBO_CLIENT_ID=your-qbo-client-id
   QBO_CLIENT_SECRET=your-qbo-client-secret
   QBO_REALM_ID=your-qbo-realm-id
   QBO_WEBHOOK_VERIFIER_TOKEN=your-qbo-webhook-token
   QBO_ENVIRONMENT=production
   QBO_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/qbo/callback
   ```

   **RolliWorking Integration:**
   ```env
   ROLLIWORKING_API_KEY=your-rolliworking-api-key
   ROLLISUITE_API_KEY=your-rollisuite-api-key
   ROLLIWORKING_BASE_URL=https://your-rolliworking-base-url
   ```

   **Email (Resend):**
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   EMAIL_FROM=noreply@quotes.rolliworks.com
   EMAIL_REPLY_TO=help@rolliworks.com
   ```

   **SMS (Twilio):**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your-twilio-auth-token
   TWILIO_PHONE_NUMBER=+1234567890
   SECURITY_ALERT_PHONE=+1234567890
   SECURITY_ALERT_CARRIER=verizon
   ```

   **Cloudflare R2 (File Storage):**
   ```env
   R2_ACCESS_KEY_ID=your-r2-access-key
   R2_SECRET_ACCESS_KEY=your-r2-secret-key
   R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
   R2_BUCKET_NAME=rollisuite-uploads
   R2_PUBLIC_URL=https://your-custom-domain.com
   ```

   **Optional:**
   ```env
   ENABLE_CRON_JOBS=true
   LOG_LEVEL=info
   ENABLE_QUERY_LOGGING=false
   RATE_LIMIT_MAX_REQUESTS=100
   RATE_LIMIT_WINDOW_MS=60000
   ```

5. **Networking Settings**
   - Railway auto-exposes services via HTTPS
   - Your backend will be available at: `https://rollisuite-api-production.up.railway.app`
   - **Copy this URL** - you'll need it for frontend configuration

6. **Deploy Backend**
   - Click "Deploy"
   - Watch build logs for errors
   - Verify successful deployment

---

## 🎨 Frontend Service Deployment

### Step 4: Configure Frontend Service

1. **Create Frontend Service**
   - Click "+ New" → "GitHub Repo"
   - Name it: `rollisuite-web`

2. **Service Settings**

   **Root Directory:**
   ```
   apps/rollisuite-web
   ```

   **Build Command:**
   ```bash
   yarn install && yarn build
   ```

   **Start Command:**
   ```bash
   yarn preview --host 0.0.0.0 --port $PORT
   ```

   **Watch Paths (optional):**
   ```
   apps/rollisuite-web/**
   packages/**
   ```

3. **Update Frontend package.json**

   **File**: `/app/apps/rollisuite-web/package.json`
   
   Ensure these scripts exist:
   ```json
   {
     "scripts": {
       "dev": "vite",
       "build": "tsc && vite build",
       "preview": "vite preview",
       "start": "vite preview --host 0.0.0.0 --port $PORT"
     }
   }
   ```

4. **Environment Variables (Frontend)**

   Go to Service Settings → Variables:

   ```env
   # Backend API URL - CRITICAL
   VITE_API_URL=${{rollisuite-api.url}}
   ```

   **Example**:
   ```env
   VITE_API_URL=https://rollisuite-api-production.up.railway.app
   ```

5. **Update Local .env File**

   **File**: `/app/apps/rollisuite-web/.env`
   
   Replace placeholder with your Railway backend URL:
   ```env
   VITE_API_URL=https://rollisuite-api-production.up.railway.app
   ```

6. **Deploy Frontend**
   - Click "Deploy"
   - Watch build logs
   - Frontend will be available at: `https://rollisuite-web-production.up.railway.app`

---

## 🔄 Final Configuration

### Step 5: Update Backend CORS

After frontend is deployed, update backend environment variable:

1. Go to `rollisuite-api` service settings
2. Find `WEB_URL_PRODUCTION` variable
3. Set to your frontend URL:
   ```env
   WEB_URL_PRODUCTION=https://rollisuite-web-production.up.railway.app
   ```
4. Redeploy backend service (Railway auto-redeploys on env change)

---

## 🗃️ Database Migrations

### Step 6: Run Prisma Migrations

**Option A: Via Railway Console**

1. Go to `rollisuite-api` service
2. Click "Settings" → "Deploy" → "Custom Start Command"
3. Temporarily set:
   ```bash
   npx prisma migrate deploy && yarn start
   ```
4. Redeploy service
5. After successful migration, revert to normal start command

**Option B: Via Railway CLI**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run npx prisma migrate deploy

# Generate Prisma client
railway run npx prisma generate
```

**Option C: Manual SQL**

1. Export your Prisma schema as SQL
2. Go to Railway → PostgreSQL service → "Data" tab
3. Run SQL commands manually

---

## ✅ Verification & Testing

### Step 7: Verify Deployment

1. **Backend Health Check**
   ```bash
   curl https://rollisuite-api-production.up.railway.app/health
   
   # Expected response:
   # {"status":"ok","timestamp":"2026-04-01T..."}
   ```

2. **API Test Endpoint**
   ```bash
   curl https://rollisuite-api-production.up.railway.app/api/test
   
   # Expected response:
   # {"message":"API routes working","timestamp":"..."}
   ```

3. **Frontend Loading**
   - Visit: `https://rollisuite-web-production.up.railway.app`
   - Should see: RolliSuite login page
   - Check browser console for errors

4. **CORS Verification**
   - Login attempt should not show CORS errors
   - Check Network tab in browser DevTools

5. **Database Connection**
   - Check backend logs for "✅ Database connected" message
   - Verify no Prisma connection errors

---

## 🧪 Test End-to-End Flow

### Step 8: Create Test User & Login

1. **Create Admin User** (via Railway PostgreSQL console):

   ```sql
   -- Insert user
   INSERT INTO users (id, email, created_at, updated_at)
   VALUES (gen_random_uuid(), 'admin@rollisuite.com', NOW(), NOW());
   
   -- Get user ID
   SELECT id FROM users WHERE email = 'admin@rollisuite.com';
   
   -- Create user role
   INSERT INTO user_roles (user_id, role, created_at, updated_at)
   VALUES ('<user-id-from-above>', 'admin', NOW(), NOW());
   
   -- Create password hash (bcrypt hash of "AdminPass123!")
   INSERT INTO user_credentials (user_id, password_hash, created_at, updated_at)
   VALUES ('<user-id-from-above>', '$2b$10$XYZ...', NOW(), NOW());
   ```

   **Generate bcrypt hash locally**:
   ```bash
   node -e "console.log(require('bcrypt').hashSync('AdminPass123!', 10))"
   ```

2. **Login Test**:
   - Visit frontend URL
   - Login with: `admin@rollisuite.com` / `AdminPass123!`
   - Should redirect to Dashboard
   - Verify stats cards show (0 or real counts)
   - Daily Hit List should show empty state

3. **Test API Integration**:
   - Dashboard stats should load from backend
   - Check Network tab for successful API calls to:
     - `GET /api/v1/dashboard/stats`
     - `GET /api/v1/daily-hit-list`

---

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### 1. Build Fails: "Cannot find module 'xxx'"

**Problem**: Missing dependencies  
**Solution**:
```bash
# Ensure yarn workspaces are configured
# Check /app/package.json has:
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}

# Railway should install from root first
```

#### 2. Frontend Shows Blank Page

**Problem**: Build output not served correctly  
**Solution**:
```bash
# Verify start command uses vite preview:
yarn preview --host 0.0.0.0 --port $PORT

# Check Railway logs for port binding errors
```

#### 3. CORS Errors

**Problem**: Backend rejecting frontend requests  
**Solution**:
```env
# Backend env vars must include:
WEB_URL_PRODUCTION=https://rollisuite-web-production.up.railway.app

# Verify CORS config in /app/apps/rollisuite-api/src/server.ts
```

#### 4. Database Connection Failed

**Problem**: Prisma can't connect to PostgreSQL  
**Solution**:
```bash
# Verify DATABASE_URL format:
postgresql://user:password@host:port/database

# Check Railway PostgreSQL service is running
# Ensure backend service is linked to PostgreSQL
```

#### 5. 502 Bad Gateway

**Problem**: Backend not responding  
**Solution**:
- Check backend logs for startup errors
- Verify port binding (should bind to `0.0.0.0:8001`)
- Ensure Prisma client is generated during build

#### 6. Environment Variables Not Loading

**Problem**: `undefined` values in config  
**Solution**:
- Railway injects env vars at runtime
- Don't use `.env` files in production
- Use Railway dashboard to set all variables
- Redeploy after adding new env vars

---

## 📊 Monitoring & Logs

### Railway Observability

1. **View Logs**:
   - Railway Dashboard → Service → "Deployments" tab
   - Real-time logs during build and runtime

2. **Metrics**:
   - CPU usage
   - Memory consumption
   - Network traffic

3. **Alerts** (Optional):
   - Set up alerts for service downtime
   - Monitor deployment failures

---

## 🔐 Security Checklist

Before going live:

- [ ] Change all default passwords
- [ ] Rotate `JWT_SECRET` to strong random value
- [ ] Enable HTTPS only (Railway default)
- [ ] Set secure CORS origins (no wildcards)
- [ ] Review exposed environment variables
- [ ] Enable rate limiting in production
- [ ] Set up proper error logging (don't expose stack traces)
- [ ] Configure Cloudflare R2 bucket permissions
- [ ] Review QuickBooks OAuth scopes

---

## 🚀 Post-Deployment Tasks

After successful deployment:

1. **Custom Domain** (Optional):
   - Railway Settings → "Domains"
   - Add custom domain: `app.rolliworks.com`
   - Update DNS records as instructed

2. **SSL Certificate**:
   - Railway auto-provisions Let's Encrypt SSL
   - Verify HTTPS is working

3. **Update QBO Redirect URI**:
   - QuickBooks Developer Portal
   - Update redirect URI to Railway production URL

4. **Configure Webhooks**:
   - QBO webhook URL: `https://<backend-url>/webhooks/qbo`
   - RolliWorking webhook URL: `https://<backend-url>/webhooks/rw/*`

5. **Test Integrations**:
   - Send test QBO webhook
   - Verify RolliWorking sync
   - Test email sending (Resend)
   - Test SMS sending (Twilio)

---

## 📝 Deployment Checklist

Use this checklist for your deployment:

**Pre-Deployment**:
- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] PostgreSQL database added
- [ ] Redis added (optional)

**Backend Deployment**:
- [ ] Service created and configured
- [ ] All environment variables set
- [ ] `start` script added to package.json
- [ ] Build command configured
- [ ] Prisma migrations run
- [ ] Health check passes

**Frontend Deployment**:
- [ ] Service created and configured
- [ ] `VITE_API_URL` environment variable set
- [ ] Build command configured
- [ ] Start command configured
- [ ] App loads successfully

**Post-Deployment**:
- [ ] CORS configured with production URL
- [ ] Test user created
- [ ] Login flow tested
- [ ] Dashboard displays correctly
- [ ] API integrations verified
- [ ] Custom domain configured (if applicable)

---

## 🆘 Need Help?

**Railway Support**:
- Discord: [discord.gg/railway](https://discord.gg/railway)
- Docs: [docs.railway.app](https://docs.railway.app)

**RolliSuite Issues**:
- Check `/app/DASHBOARD_IMPLEMENTATION.md` for feature documentation
- Review backend logs for API errors
- Verify database schema matches Prisma schema

---

## 🎉 Success!

If all checks pass, your RolliSuite application is now live on Railway! 🚀

**Next Steps**:
- Continue with Week 1 Day 5: Customer List/Detail pages
- Monitor application performance
- Set up backup strategy for PostgreSQL
- Plan for scaling (Railway auto-scales on Pro plan)

---

**Deployment Guide Version**: 1.0  
**Last Tested**: April 1, 2026  
**Railway Stack**: Node.js 18+, PostgreSQL 15+, Redis 7+
