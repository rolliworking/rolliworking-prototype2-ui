import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  apiPort: parseInt(process.env.API_PORT || '8001', 10),
  webUrl: process.env.WEB_URL || 'http://localhost:3000',
  webUrlProduction: process.env.WEB_URL_PRODUCTION || 'https://YOUR-WEB.up.railway.app',
  apiUrl: process.env.API_URL || 'http://localhost:8001',

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // Authentication
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  sessionTimeoutMinutes: parseInt(
    process.env.SESSION_TIMEOUT_MINUTES || '480',
    10
  ),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),

  // PIN Login
  pinLockoutAttempts: parseInt(process.env.PIN_LOCKOUT_ATTEMPTS || '5', 10),
  pinLockoutDurationMinutes: parseInt(
    process.env.PIN_LOCKOUT_DURATION_MINUTES || '15',
    10
  ),

  // Security
  allowedOfficeIps: (process.env.ALLOWED_OFFICE_IPS || '127.0.0.1').split(','),
  proxyIdEncryptionKey: process.env.PROXY_ID_ENCRYPTION_KEY!,

  // QuickBooks Online
  qbo: {
    clientId: process.env.QBO_CLIENT_ID!,
    clientSecret: process.env.QBO_CLIENT_SECRET!,
    realmId: process.env.QBO_REALM_ID!,
    webhookVerifierToken: process.env.QBO_WEBHOOK_VERIFIER_TOKEN!,
    environment: process.env.QBO_ENVIRONMENT || 'sandbox',
    redirectUri: process.env.QBO_REDIRECT_URI!,
  },

  // RolliWorking
  rolliworking: {
    apiKey: process.env.ROLLIWORKING_API_KEY!,
    rollisuiteApiKey: process.env.ROLLISUITE_API_KEY!,
    baseUrl:
      process.env.ROLLIWORKING_BASE_URL ||
      'https://pkgnrcfqrldwjibghefm.supabase.co/functions/v1',
  },

  // Wix
  wix: {
    webhookSecret: process.env.WIX_WEBHOOK_SECRET!,
  },

  // Email (Resend)
  email: {
    apiKey: process.env.RESEND_API_KEY!,
    from: process.env.EMAIL_FROM || 'noreply@quotes.rolliworks.com',
    replyTo: process.env.EMAIL_REPLY_TO || 'help@rolliworks.com',
  },

  // SMS (Twilio)
  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
    securityAlertPhone: process.env.SECURITY_ALERT_PHONE!,
    securityAlertCarrier: process.env.SECURITY_ALERT_CARRIER || 'verizon',
  },

  // Cloudflare R2
  r2: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    endpoint: process.env.R2_ENDPOINT!,
    bucketName: process.env.R2_BUCKET_NAME!,
    publicUrl: process.env.R2_PUBLIC_URL,
  },

  // External Webhooks
  partsWebhookApiKey: process.env.PARTS_WEBHOOK_API_KEY,
  lovableApiKey: process.env.LOVABLE_API_KEY,

  // Rate Limiting
  rateLimitWindowMs: parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || '60000',
    10
  ),
  rateLimitMaxRequests: parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || '100',
    10
  ),

  // Cron Jobs
  enableCronJobs: process.env.ENABLE_CRON_JOBS === 'true',
  cronSchedules: {
    rwStatus: process.env.RW_STATUS_CRON_SCHEDULE || '0 5 * * *',
    maintenance: process.env.MAINTENANCE_CRON_SCHEDULE || '0 2 * * *',
    vaultStorage: process.env.VAULT_STORAGE_CRON_SCHEDULE || '0 3 * * *',
    goldPrice: process.env.GOLD_PRICE_CRON_SCHEDULE || '0 */6 * * *',
  },

  // Public Domains
  publicDomain: process.env.PUBLIC_DOMAIN || 'upload.rolliworks.com',
  shortUrlDomain: process.env.SHORT_URL_DOMAIN || 'upload.rolliworks.com',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
};
