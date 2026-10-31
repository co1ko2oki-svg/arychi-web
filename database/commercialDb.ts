/**
 * ==============================================================================
 *                   ARYCHI SUITE - COMMERCIAL DATABASE SCHEMA
 * ==============================================================================
 * Dedicated Commercial Database for Arychi SaaS / Discord Automation Suite.
 * Storage: database/commercial_db.json with automatic atomic write & .bak backup.
 * Managed by SubscriptionManager in quest/src/subscriptionDb.ts.
 * ==============================================================================
 */

export interface CommercialUser {
  id: string; // Discord Snowflake ID (e.g. "1216209352852115576") or Google ID
  provider: 'discord' | 'google';
  username: string; // Discord username or display name
  email: string;
  avatarUrl: string | null;
  botConnected: boolean; // True if authenticated via Discord Bot Application OAuth2
  sessionToken: string; // Cryptographic session token (hex)
  subscriptionExpiresAt: string | null; // ISO datetime
  activatedAt: string | null; // ISO datetime
  totalMonthsPurchased: number;
  licenseKey: string | null; // e.g. "ARYCHI-50K-XXXX-YYYY"
  tokens: {
    questToken: string; // 1 Discord token for Quests & Badges
    streamMainToken: string; // 1 Main token for streaming voice video
    streamViewerToken: string; // 1 Viewer token for farm watch-time
    streamGuildId?: string;
    streamChannelId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CommercialSubscription {
  planId: 'monthly_50k'; // Single pricing tier: 50.000đ / 1 month
  planName: string;
  pricePerMonth: 50000;
  currency: 'VND';
  status: 'active' | 'expired';
  daysRemaining: number;
  totalMonthsPurchased: number;
  activatedAt: string | null;
  expiresAt: string | null;
  licenseKey: string | null;
}

export interface CommercialOrder {
  orderCode: number; // Unique numerical code (e.g. 1730384729)
  userId: string;
  username: string;
  provider: 'discord' | 'google';
  months: number; // 1, 3, 6, 12...
  amount: number; // months * 50,000 VND
  description: string; // "ARYCHI <orderCode>"
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  gateway: 'VIETQR' | 'PAYOS';
  vietqrUrl: string;
  payosCheckoutUrl: string | null;
  payosPaymentLinkId: string | null;
  createdAt: string;
  paidAt?: string;
}

export interface CommercialTransaction {
  id: string;
  orderCode: number;
  userId: string;
  amount: number;
  gateway: 'VIETQR' | 'PAYOS';
  reference?: string;
  timestamp: string;
}

export interface CommercialDatabaseSchema {
  accounts: CommercialUser[];
  orders: CommercialOrder[];
  transactions: CommercialTransaction[];
}
