// QuickBooks Online OAuth2 Token Management
import { prisma } from '../../db/client';
import { config } from '../../config';

interface QboTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Refresh QBO access token if expired (< 5 minutes remaining)
 * Returns valid access token
 */
export async function getValidAccessToken(
  environment: 'sandbox' | 'production' = 'production'
): Promise<string> {
  // Get current token from database
  const tokenRecord = await prisma.qboToken.findFirst({
    where: { environment },
  });

  if (!tokenRecord) {
    throw new Error(
      `No ${environment} QBO token found. Please run OAuth flow first.`
    );
  }

  // Check if token needs refresh (expires in < 5 minutes)
  const expiresAt = new Date(tokenRecord.expiresAt);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  // Return existing token if still valid
  if (expiresAt.getTime() - now.getTime() > fiveMinutes) {
    return tokenRecord.accessToken;
  }

  console.log('[QBO OAuth] Token expiring soon, refreshing...');

  // Refresh the token
  const tokens = await refreshAccessToken(tokenRecord.refreshToken);

  // Update database with new tokens
  const newExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  await prisma.qboToken.update({
    where: { id: tokenRecord.id },
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: newExpiresAt,
      updatedAt: new Date(),
    },
  });

  console.log('[QBO OAuth] Token refreshed successfully');

  return tokens.accessToken;
}

/**
 * Call QBO OAuth2 refresh token endpoint
 */
async function refreshAccessToken(refreshToken: string): Promise<QboTokens> {
  const { clientId, clientSecret } = config.qbo;

  if (!clientId || !clientSecret) {
    throw new Error('QBO credentials not configured');
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  );

  const response = await fetch(
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QBO token refresh failed: ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Initialize OAuth2 flow (redirect to Intuit)
 */
export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri, environment } = config.qbo;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state,
  });

  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<QboTokens> {
  const { clientId, clientSecret, redirectUri } = config.qbo;

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  );

  const response = await fetch(
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Save tokens to database
 */
export async function saveTokens(
  tokens: QboTokens,
  realmId: string,
  environment: 'sandbox' | 'production'
) {
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  await prisma.qboToken.upsert({
    where: { realmId },
    create: {
      realmId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      environment,
      expiresAt,
    },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      updatedAt: new Date(),
    },
  });

  console.log('[QBO OAuth] Tokens saved successfully');
}
