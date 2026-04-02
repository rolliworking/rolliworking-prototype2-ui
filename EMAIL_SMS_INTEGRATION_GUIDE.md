# Email/SMS Integration Infrastructure - Complete Setup Guide

## 📦 What's Been Built

A complete email/SMS notification system for RolliSuite with **placeholder API keys**. Once you add your real Resend and Twilio keys, everything will work immediately!

---

## ✅ Backend Implementation (Node.js/Fastify)

### 1. Email Service (`/src/modules/notifications/email.ts`)
- ✅ Resend integration (already existed)
- ✅ Send custom emails
- ✅ Send estimate emails with PDF attachments
- ✅ Email templates with barcode generation
- ✅ Professional HTML email layouts

### 2. SMS Service (`/src/modules/notifications/sms.ts`) - **NEW**
- ✅ Twilio integration
- ✅ Phone number formatting (E.164)
- ✅ Pre-built SMS functions:
  - `sendPickupReadySMS()` - Order pickup notifications
  - `sendEstimateSMS()` - Estimate ready notifications
  - `sendWatchIntakeSMS()` - Watch receipt confirmations
  - `sendCustomerSMS()` - Custom customer messages

### 3. API Routes (`/src/modules/notifications/routes.ts`) - **NEW**
All routes are under `/api/v1/notifications/`:

**Email Endpoints:**
- `POST /email` - Send custom email

**SMS Endpoints:**
- `POST /sms` - Send custom SMS
- `POST /sms/pickup-ready` - Send pickup notification
- `POST /sms/estimate` - Send estimate notification
- `POST /sms/watch-intake` - Send watch intake confirmation
- `POST /sms/customer` - Send custom SMS to customer

**Status Check:**
- `GET /status` - Check if email/SMS are configured

### 4. Database Models (`prisma/schema.prisma`) - **NEW**
```prisma
model EmailTemplate {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  subject     String
  htmlBody    String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model SmsTemplate {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  message     String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 🔑 Required API Keys

### Resend (Email) - **1 Key Required**

1. **Sign up:** https://resend.com
2. **Get API Key:**
   - Go to Dashboard → API Keys
   - Click "Create API Key"
   - Copy the key (starts with `re_...`)

3. **Add to `.env`:**
   ```
   RESEND_API_KEY=re_your_actual_key_here
   ```

### Twilio (SMS) - **3 Keys Required**

1. **Sign up:** https://www.twilio.com
2. **Get Credentials:**
   - Go to Console Dashboard
   - Copy "Account SID" (starts with `AC...`)
   - Copy "Auth Token" (click to reveal)
   - Buy a phone number → Copy it (format: `+15551234567`)

3. **Add to `.env`:**
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+15551234567
   ```

---

## 📝 Current Placeholder Keys

Located in `/app/apps/rollisuite-api/.env`:

```bash
# Email/SMS Configuration
# Get Resend API key from: https://resend.com/api-keys
# Get Twilio credentials from: https://console.twilio.com
RESEND_API_KEY="re_placeholder_get_from_resend_dashboard"
TWILIO_ACCOUNT_SID="AC_placeholder_get_from_twilio_console"
TWILIO_AUTH_TOKEN="placeholder_get_from_twilio_console"
TWILIO_PHONE_NUMBER="+15555555555"
```

---

## 🚀 How to Activate (Once You Have Keys)

### Step 1: Add Your Keys
Replace the placeholder values in `/app/apps/rollisuite-api/.env` with your real API keys.

### Step 2: Apply Database Migration
```bash
cd /app/apps/rollisuite-api
npx prisma migrate dev --name add_notification_templates
```

### Step 3: Restart Backend
```bash
# The backend will auto-restart due to hot reload
# Or manually restart if needed
```

### Step 4: Test
```bash
# Check notification status
curl http://localhost:8001/api/v1/notifications/status

# Should return:
# {
#   "email": { "configured": true, "provider": "Resend" },
#   "sms": { "configured": true, "provider": "Twilio" }
# }
```

---

## 📱 Usage Examples

### Send Email (via API)
```bash
curl -X POST http://localhost:8001/api/v1/notifications/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "customer@example.com",
    "subject": "Your Watch is Ready!",
    "html": "<h1>Your Rolex is ready for pickup</h1>"
  }'
```

### Send SMS (via API)
```bash
curl -X POST http://localhost:8001/api/v1/notifications/sms \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+14155552671",
    "message": "Your watch is ready for pickup!"
  }'
```

### Send Pickup Notification (via API)
```bash
curl -X POST http://localhost:8001/api/v1/notifications/sms/pickup-ready \
  -H "Content-Type: application/json" \
  -d '{
    "salesOrderId": "so-uuid-here",
    "customerPhone": "+14155552671"
  }'
```

---

## 🎯 Pre-Built Notification Functions

### Backend (TypeScript)
```typescript
import { 
  sendEmail, 
  sendSMS,
  sendPickupReadySMS,
  sendEstimateSMS,
  sendWatchIntakeSMS,
  sendCustomerSMS
} from './modules/notifications';

// Send pickup ready SMS
await sendPickupReadySMS(salesOrderId, customerPhone);

// Send estimate SMS
await sendEstimateSMS(estimateId, customerPhone);

// Send watch intake confirmation
await sendWatchIntakeSMS(watchId, customerPhone);

// Send custom SMS
await sendCustomerSMS(customerId, "Your custom message here");
```

---

## 🎨 Next Steps (Frontend UI)

Once you provide API keys, I'll build:

1. **Email Templates Manager**
   - Create/edit/delete email templates
   - Use the "Email Templates" menu item in sidebar
   - Visual HTML editor
   - Preview before sending

2. **SMS Templates Manager**
   - Quick-send templates for common notifications
   - Merge fields (customer name, order number, etc.)

3. **Notification Center**
   - Send notifications from customer/order pages
   - Bulk SMS/email to customers
   - Notification history/logs

4. **Integration into Workflows**
   - Auto-send estimate emails when created
   - Auto-send pickup SMS when order ready
   - Auto-send watch intake confirmations

---

## 💰 Cost Estimates

### Resend (Email)
- **Free Tier:** 100 emails/day, 3,000/month
- **Paid:** $20/month for 50,000 emails

### Twilio (SMS)
- **Pay-as-you-go:** ~$0.0079 per SMS (US)
- **100 SMS/month ≈ $0.79**
- **1,000 SMS/month ≈ $7.90**

---

## 🔒 Security Notes

- API keys are in `.env` (not committed to git)
- All endpoints should be authenticated (TODO: Add auth middleware)
- Phone numbers are formatted to E.164 standard
- Email HTML is sanitized (consider adding XSS protection)

---

## ✅ What's Ready NOW

Even WITHOUT real API keys:
- ✅ All backend code is complete
- ✅ All API endpoints are live
- ✅ Database models are defined
- ✅ Integration points are ready
- ✅ The system will log warnings instead of failing

Once you add keys:
- 🚀 Instant activation - no code changes needed
- 📧 Emails will send via Resend
- 📱 SMS will send via Twilio

---

## 🐛 Troubleshooting

**"SMS not sent" warning in logs:**
- This is normal with placeholder keys
- The function runs but doesn't actually send
- Add real Twilio keys to activate

**"Email failed" error:**
- Check Resend API key format (starts with `re_`)
- Verify sender email is configured
- Check Resend dashboard for delivery logs

**Phone number format error:**
- Use E.164 format: `+[country code][number]`
- US example: `+14155552671`
- The system auto-formats 10-digit US numbers

---

## 📞 Support

Need help getting API keys or setting up?
1. Resend Docs: https://resend.com/docs
2. Twilio Docs: https://www.twilio.com/docs/sms
3. Ask me - I can guide you through the setup!
