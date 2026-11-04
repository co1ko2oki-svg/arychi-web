export type AuthProvider = 'discord' | 'token';

export interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
  avatarUrl: string | null;
  email?: string;
  token?: string;
}

export interface AccountTokens {
  questToken: string;
  streamMainToken: string;
  streamViewerToken: string;
  streamGuildId?: string;
  streamChannelId?: string;
  prefix?: string;
  commandChannelId?: string;
  adminIds?: string;
}

export interface AuthUser {
  provider: AuthProvider;
  id: string;
  username: string;
  discriminator?: string;
  avatarUrl: string | null;
  email?: string;
  sessionToken?: string;
  token?: string;
  tokens?: AccountTokens;
  role?: 'admin' | 'user';
}

export interface QuestDTO {
  id: string;
  name: string;
  application: {
    id: string;
    name: string;
    iconUrl: string | null;
  };
  task: {
    type: string;
    targetSeconds: number;
    currentSeconds: number;
    progressPercent: number;
    remainingSeconds: number;
    remainingMinutes: number;
  };
  rewards: {
    name: string;
    assetUrl: string | null;
  };
  assets: {
    hero: string | null;
    banner: string | null;
  };
  status: {
    enrolled: boolean;
    completed: boolean;
    claimed: boolean;
    expired: boolean;
    expiresAt: string;
  };
}

export interface QuestJob {
  questId: string;
  tokenKey?: string;
  tokenMasked: string;
  questName: string;
  taskType: string;
  status: 'idle' | 'enrolling' | 'running' | 'completed' | 'cancelled' | 'error';
  progressPercent: number;
  currentSeconds: number;
  targetSeconds: number;
  remainingMinutes: number;
  message: string;
  startedAt: number;
  completedAt?: number;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  questId?: string;
}

export interface StreamStatus {
  bot: {
    tag: string;
    id: string;
    isReady: boolean;
    ping: number;
  };
  stream: {
    joined: boolean;
    playing: boolean;
    isLooping: boolean;
    channelInfo?: {
      guildId: string;
      channelId: string;
    };
    currentQueueItem?: {
      title: string;
      url: string;
      duration?: number;
    };
  };
  farm: {
    isConfigured?: boolean;
    isOnline?: boolean;
    isWatching?: boolean;
    viewerTag?: string;
    formattedSessionTime?: string;
    formattedTotalTime?: string;
    totalMinutesWatched?: number;
    activeChannelsCount?: number;
    autoWatch: boolean;
  };
  queue: {
    items: Array<{ title: string; url: string }>;
    totalDuration?: number;
  };
  config: Record<string, any> & {
    hasMainToken?: boolean;
    hasViewerToken?: boolean;
  };
}

export type PlanTierId = 'monthly_20k' | 'monthly_50k' | 'pro' | 'starter' | 'lifetime';

export interface UserSubscription {
  planId: PlanTierId;
  planName: string;
  pricePerMonth?: number;
  priceLabel: string;
  isActive?: boolean;
  daysRemaining?: number;
  totalMonthsPurchased?: number;
  activatedAt: string | null;
  expiresAt: string | null;
  botConnected: boolean;
  licenseKey: string | null;
}
