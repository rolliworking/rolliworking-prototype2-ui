# 🚂 RolliSuite Railway Deployment Guide - Step by Step

**Date:** March 31, 2026  
**Estimated Time:** 1-2 hours  
**Cost:** $15/month

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### **1. Accounts & Keys Needed:**
- [ ] Railway account (https://railway.app)
- [ ] GitHub account with repository access
- [ ] QuickBooks Developer account (for OAuth keys)
- [ ] Resend account (for email)
- [ ] RolliWorking deployment URL & API key

### **2. Generate Secrets:**
```bash
# Generate random 32-character secrets
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
# Run this 3 times for: JWT_SECRET, ENCRYPTION_KEY, ROLLIWORKING_WEBHOOK_SECRET
```

---

## 🚀 STEP-BY-STEP DEPLOYMENT

### **STEP 1: Install Railway CLI** (5 min)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Verify installation
railway --version

# Login to Railway
railway login
# This opens browser for authentication
```

---

### **STEP 2: Create Railway Project** (5 min)

```bash
# Navigate to your project
cd /app

# Initialize Railway project
railway init

# When prompted:
# Project name: rollisuite-prod
# Create new project: Yes
```

**Or via Railway Dashboard:**
1. Go to https://railway.app/new
2. Click "New Project"
3. Name: `rollisuite-prod`

---

### **STEP 3: Add PostgreSQL Database** (5 min)

**Via CLI:**
```bash
railway add --database postgresql
# Service name: rollisuite-db
```

**Or via Dashboard:**
1. In project → Click "New"
2. Select "Database" → "PostgreSQL"
3. Name: `rollisuite-db`
4. Plan: Hobby ($5/mo)

**Copy Database URL:**
```bash
# Get DATABASE_URL
railway variables --service rollisuite-db

# Or from Dashboard: 
# Click rollisuite-db → Variables → Copy DATABASE_URL
```

Save this for later: `postgresql://user:pass@host:port/dbname`

---

### **STEP 4: Add Redis** (5 min)

**Via CLI:**
```bash
railway add --database redis
# Service name: rollisuite-redis
```

**Or via Dashboard:**
1. In project → Click "New"
2. Select "Database" → "Redis"
3. Name: `rollisuite-redis`
4. Plan: Hobby ($5/mo)

**Copy Redis URL:**
```bash
railway variables --service rollisuite-redis
```

Save: `redis://default:password@host:port`

---

### **STEP 5: Deploy Backend API** (15 min)

#### **5a. Link GitHub Repository**

**Via Dashboard:**
1. In project → Click "New"
2. Select "GitHub Repo"
3. Connect your repository
4. Select branch: `main`
5. Root Directory: `apps/rollisuite-api`
6. Name: `rollisuite-api`

#### **5b. Configure Build Settings**

Railway auto-detects Node.js, but verify:

**Build Command:**
```bash
corepack enable && yarn install && yarn prisma:generate && yarn build
```

**Start Command:**
```bash
yarn start
```

**Health Check Path:**
```
/health
```

#### **5c. Set Environment Variables**

**Via Dashboard:**
Go to `rollisuite-api` → Variables → Raw Editor

Paste this (replace `<...>` with actual values):

```env
# Database (auto-populated by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Core
NODE_ENV=production
API_PORT=8001
LOG_LEVEL=info

# Security (generate with: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
JWT_SECRET=<YOUR_32_CHAR_SECRET>
JWT_EXPIRES_IN=8h
ENCRYPTION_KEY=<YOUR_32_CHAR_SECRET>
BCRYPT_ROUNDS=10

# URLs (update after deployment)
WEB_URL=https://rollisuite-web.up.railway.app
API_URL=${{RAILWAY_PUBLIC_DOMAIN}}

# CORS
ALLOWED_IPS=*

# QuickBooks Online (from QBO Developer Portal)
QBO_CLIENT_ID=<YOUR_QBO_CLIENT_ID>
QBO_CLIENT_SECRET=<YOUR_QBO_CLIENT_SECRET>
QBO_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/qbo/callback
QBO_ENVIRONMENT=production
QBO_WEBHOOK_VERIFIER_TOKEN=<YOUR_QBO_WEBHOOK_TOKEN>

# RolliWorking Integration
ROLLIWORKING_API_URL=<YOUR_RW_URL>
ROLLIWORKING_API_KEY=<YOUR_RW_API_KEY>
ROLLIWORKING_WEBHOOK_SECRET=<YOUR_32_CHAR_SECRET>

# Email (Resend)
RESEND_API_KEY=<YOUR_RESEND_API_KEY>
FROM_EMAIL=noreply@yourdomain.com

# SMS (Twilio) - Optional
TWILIO_ACCOUNT_SID=<YOUR_TWILIO_SID>
TWILIO_AUTH_TOKEN=<YOUR_TWILIO_TOKEN>
TWILIO_PHONE_NUMBER=<YOUR_TWILIO_PHONE>

# Storage (Cloudflare R2) - Optional for MVP
R2_ACCOUNT_ID=<YOUR_R2_ACCOUNT_ID>
R2_ACCESS_KEY_ID=<YOUR_R2_ACCESS_KEY>
R2_SECRET_ACCESS_KEY=<YOUR_R2_SECRET>
R2_BUCKET_NAME=rollisuite-media
R2_PUBLIC_URL=https://media.yourdomain.com

# Cron Jobs
ENABLE_CRON_JOBS=true
RW_STATUS_CRON_SCHEDULE=0 5 * * *
MAINTENANCE_CRON_SCHEDULE=0 2 * * *
VAULT_STORAGE_CRON_SCHEDULE=0 3 * * SUN
GOLD_PRICE_CRON_SCHEDULE=0 9 * * 1-5
```

**Via CLI:**
```bash
railway variables set JWT_SECRET=<your_secret> --service rollisuite-api
railway variables set ENCRYPTION_KEY=<your_secret> --service rollisuite-api
# ... repeat for all variables
```

#### **5d. Deploy**

Railway auto-deploys on push to `main`. Or trigger manually:

```bash
railway up --service rollisuite-api
```

**Watch deployment:**
```bash
railway logs --service rollisuite-api
```

---

### **STEP 6: Run Database Migrations** (5 min)

After API deploys successfully:

```bash
# Run Prisma migrations
railway run --service rollisuite-api yarn prisma:migrate deploy

# Verify migration status
railway run --service rollisuite-api yarn prisma:migrate status
```

**Expected output:**
```
✔ Generated Prisma Client to ./node_modules/@prisma/client
✔ Applied migration: 20260331_add_security_and_auth_features
```

**This creates:**
- `user_credentials` table
- `tc_acceptances` table  
- `daily_hit_lists` table

---

### **STEP 7: Deploy Frontend** (10 min)

#### **7a. Create Web Service**

**Via Dashboard:**
1. In project → Click "New"
2. Select "GitHub Repo"
3. Same repository
4. Root Directory: `apps/rollisuite-web`
5. Name: `rollisuite-web`

#### **7b. Configure Build**

**Build Command:**
```bash
yarn install && yarn build
```

**Output Directory:**
```
dist
```

**Start Command:**
```bash
npx serve -s dist -l 3000
```

Or use Railway's **Static Site** deployment:
- Build command: `yarn build`
- Output directory: `dist`

#### **7c. Set Environment Variable**

```env
VITE_API_URL=${{rollisuite-api.RAILWAY_PUBLIC_DOMAIN}}
```

**Note:** Railway automatically provides service references like `${{rollisuite-api.RAILWAY_PUBLIC_DOMAIN}}`

---

### **STEP 8: Get Deployment URLs** (1 min)

**Via CLI:**
```bash
# Get API URL
railway domain --service rollisuite-api

# Get Web URL  
railway domain --service rollisuite-web
```

**Via Dashboard:**
- Click service → Settings → Public Networking → Copy URL

**Expected URLs:**
- API: `https://rollisuite-api-production-XXXX.up.railway.app`
- Web: `https://rollisuite-web-production-XXXX.up.railway.app`

**Update Environment Variables:**

Go back to `rollisuite-api` variables and update:
```env
WEB_URL=https://rollisuite-web-production-XXXX.up.railway.app
```

---

## 🧪 TESTING DEPLOYMENT

### **Test 1: Health Check**

```bash
curl https://rollisuite-api-production-XXXX.up.railway.app/health
```

**Expected:**
```json
{"status":"ok","timestamp":"2026-03-31T12:00:00.000Z"}
```

✅ **If this works:** Database connection successful

---

### **Test 2: Register Admin User**

```bash
curl -X POST https://rollisuite-api-production-XXXX.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@rollisuite.com",
    "password":"AdminPass123!",
    "fullName":"System Admin",
    "role":"admin"
  }'
```

**Expected:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@rollisuite.com",
    "fullName": "System Admin",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

✅ **If this works:** Auth system working, password hashing working, JWT generation working

**Save the token for next tests.**

---

### **Test 3: Login**

```bash
curl -X POST https://rollisuite-api-production-XXXX.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@rollisuite.com",
    "password":"AdminPass123!"
  }'
```

**Expected:** Same response as register (with new token)

✅ **If this works:** Password verification working

---

### **Test 4: Get Current User**

```bash
export TOKEN="<token_from_login>"

curl https://rollisuite-api-production-XXXX.up.railway.app/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@rollisuite.com",
    "fullName": "System Admin",
    "role": "admin"
  }
}
```

✅ **If this works:** JWT verification working

---

### **Test 5: Create Customer**

```bash
curl -X POST https://rollisuite-api-production-XXXX.up.railway.app/api/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName":"John",
    "lastName":"Doe",
    "email":"john@example.com",
    "phone":"5551234567"
  }'
```

**Expected:**
```json
{
  "success": true,
  "customer": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "5551234567",
    ...
  }
}
```

✅ **If this works:** Database CRUD working, auth middleware working

---

### **Test 6: List Customers**

```bash
curl https://rollisuite-api-production-XXXX.up.railway.app/api/customers \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:**
```json
{
  "success": true,
  "customers": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      ...
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

✅ **If this works:** All CRUD endpoints working

---

### **Test 7: QBO Webhook Security** (CRITICAL)

```bash
# This should FAIL (no signature)
curl -X POST https://rollisuite-api-production-XXXX.up.railway.app/api/qbo/webhook/payment \
  -H "Content-Type: application/json" \
  -d '{"test":"payload"}'
```

**Expected:**
```json
{"error":"Missing signature"}
```

✅ **If this fails with 401:** Security fix working! (Prevents fake payment webhooks)

---

### **Test 8: RolliWorking Webhook**

```bash
curl -X POST https://rollisuite-api-production-XXXX.up.railway.app/webhooks/rw/job-status \
  -H "Content-Type: application/json" \
  -d '{
    "eventId":"test-001",
    "timestamp":"2026-03-31T12:00:00Z",
    "payload":{
      "jobId":"J-000001",
      "estimateNumber":"E2601",
      "newStatus":"in_service",
      "updatedBy":"watchmaker-1"
    }
  }'
```

**Expected:**
```json
{"success":true,"message":"Status updated"}
```

**Note:** Job won't exist yet, so may return error. That's OK - webhook handler is working.

---

### **Test 9: Frontend**

Visit in browser:
```
https://rollisuite-web-production-XXXX.up.railway.app
```

**Expected:** React app loads (currently empty scaffold)

---

## 📊 DEPLOYMENT SUCCESS CHECKLIST

- [ ] Health check returns `{"status":"ok"}`
- [ ] User registration works
- [ ] User login works
- [ ] JWT verification works (`/api/auth/me`)
- [ ] Customer CRUD works
- [ ] QBO webhook rejects unsigned requests (security fix verified)
- [ ] RolliWorking webhook accepts requests
- [ ] Frontend loads

---

## 🐛 TROUBLESHOOTING

### **Issue: Build fails**

**Check logs:**
```bash
railway logs --service rollisuite-api
```

**Common causes:**
- Missing `corepack enable` in build command
- Yarn version mismatch
- Missing Prisma generate step

**Fix:**
Update build command to:
```bash
corepack enable && corepack prepare yarn@4.1.1 --activate && yarn install && yarn prisma:generate && yarn build
```

---

### **Issue: Database connection failed**

**Check:**
```bash
railway logs --service rollisuite-api | grep "DATABASE"
```

**Fix:**
Verify `DATABASE_URL` variable is set correctly:
```bash
railway variables --service rollisuite-api | grep DATABASE
```

Should show: `DATABASE_URL=${{Postgres.DATABASE_URL}}`

---

### **Issue: Migration failed**

**Check migration status:**
```bash
railway run --service rollisuite-api yarn prisma:migrate status
```

**Force migration:**
```bash
railway run --service rollisuite-api yarn prisma:migrate deploy --force
```

---

### **Issue: 401 Unauthorized on all requests**

**Check JWT_SECRET:**
```bash
railway variables --service rollisuite-api | grep JWT_SECRET
```

If missing, set it:
```bash
railway variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))") --service rollisuite-api
```

Then redeploy.

---

### **Issue: CORS errors from frontend**

**Check ALLOWED_IPS and WEB_URL:**
```bash
railway variables --service rollisuite-api | grep -E "WEB_URL|ALLOWED_IPS"
```

Should show:
```
WEB_URL=https://rollisuite-web-production-XXXX.up.railway.app
ALLOWED_IPS=*
```

---

## 📝 POST-DEPLOYMENT TASKS

### **1. Update QuickBooks OAuth Redirect**

In QuickBooks Developer Portal:
1. Go to your app settings
2. Update Redirect URI to:
   ```
   https://rollisuite-api-production-XXXX.up.railway.app/api/qbo/callback
   ```

### **2. Configure RolliWorking Webhooks**

In RolliWorking admin:
1. Update webhook URLs to point to:
   ```
   https://rollisuite-api-production-XXXX.up.railway.app/webhooks/rw/job-status
   https://rollisuite-api-production-XXXX.up.railway.app/webhooks/rw/hit-list
   # ... etc for all 8 webhooks
   ```

### **3. Set Up Custom Domain** (Optional)

**Via Dashboard:**
1. Go to service → Settings → Public Networking
2. Click "Add Domain"
3. Enter: `api.yourdomain.com`
4. Add CNAME record to your DNS:
   ```
   api.yourdomain.com CNAME rollisuite-api-production-XXXX.up.railway.app
   ```

Then update all env vars that reference the domain.

---

## 💰 COST MONITORING

**View costs:**
```bash
railway status
```

**Expected monthly:**
- PostgreSQL: $5
- Redis: $5
- API: ~$5 (based on usage)
- Web: $0 (static)

**Total:** ~$15/month

**Upgrade to Pro** if you need:
- More RAM/CPU
- Daily backups
- Priority support

---

## 🎉 SUCCESS!

**If all tests pass, you have:**
- ✅ Backend deployed to Railway
- ✅ PostgreSQL + Redis running
- ✅ Auth system working
- ✅ CRUD endpoints functional
- ✅ QBO webhook security verified
- ✅ RolliWorking webhooks ready

**URLs to save:**
```
API: https://rollisuite-api-production-XXXX.up.railway.app
Web: https://rollisuite-web-production-XXXX.up.railway.app
Admin: admin@rollisuite.com / AdminPass123!
```

---

**Next:** Frontend migration (Week 1)
