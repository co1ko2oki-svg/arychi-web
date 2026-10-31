export type AuthProvider = 'discord' | 'google' | 'token';

export interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
  avatarUrl: string | null;
  email?: string;
  token?: string;
}

export interface AuthUser {
  provider: AuthProvider;
  id: string;
  username: string;
  discriminator?: string;
  avatarUrl: string | null;
  email?: string;
  token?: string; // Discord user token
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
    totalMinutesWatched?: number;
    activeChannelsCount?: number;
    autoWatch: boolean;
  };
  queue: {
    items: Array<{ title: string; url: string }>;
    totalDuration?: number;
  };
  config: Record<string, any>;
}

export type PlanTierId = 'starter' | 'pro' | 'lifetime';

export interface UserSubscription {
  planId: PlanTierId;
  planName: string;
  priceLabel: string;
  activatedAt: string;
  expiresAt: string | null;
  botConnected: boolean;
  licenseKey: string;
}
