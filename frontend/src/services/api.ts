import {
  AccountTokens,
  AuthUser,
  DiscordUser,
  LogEntry,
  QuestDTO,
  QuestJob,
  StreamStatus,
  UserSubscription,
} from '../types';

const resolveHost = (): string => {
  if (typeof window === 'undefined') return 'localhost';
  const h = window.location.hostname;
  if (!h || h.endsWith('arychi.xyz') || h.endsWith('arychy.xyz')) {
    return 'localhost';
  }
  return h;
};

const host = resolveHost();

export const QUEST_API_URL = import.meta.env.VITE_QUEST_API_URL || `http://${host}:3001`;
export const QUEST_WS_URL = import.meta.env.VITE_QUEST_WS_URL || `ws://${host}:3001/ws`;

export const STREAM_API_URL = import.meta.env.VITE_STREAM_API_URL || `http://${host}:3000`;
export const STREAM_WS_URL = import.meta.env.VITE_STREAM_WS_URL || `ws://${host}:3000/ws`;

export const questApi = {
  async getOAuthConfig(): Promise<{
    plan: { id: string; name: string };
    oauth: {
      discordConfigured: boolean;
      discordClientId: string | null;
      discordAuthUrl: string | null;
      discordBotInviteUrl: string | null;
    };
  }> {
    const res = await fetch(
      `${QUEST_API_URL}/api/auth/oauth/config?redirectUri=${encodeURIComponent(window.location.origin)}`
    );
    if (!res.ok) throw new Error('Không thể tải cấu hình OAuth2');
    return res.json();
  },

  async checkHealth(): Promise<{ status: string; uptime: number }> {
    const res = await fetch(`${QUEST_API_URL}/api/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  },

  async oauthLogin(payload: {
    provider?: 'discord';
    id?: string;
    username?: string;
    email?: string;
    avatarUrl?: string | null;
    code?: string;
    accessToken?: string;
    redirectUri?: string;
  }): Promise<{
    success: boolean;
    sessionToken: string;
    account: AuthUser;
    subscription: UserSubscription | null;
    error?: string;
  }> {
    const res = await fetch(`${QUEST_API_URL}/api/auth/oauth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Đăng nhập OAuth2 thất bại');
    }
    return data;
  },

  async loginWithOAuthCode(code: string) {
    return this.oauthLogin({ code });
  },

  async startBadgeFarm(payload: {
    token?: string;
    cookie?: string;
    mode: 'playtime' | 'played' | 'both';
    hours?: number;
    games?: string[];
  }) {
    return this.startBadgeBoost(payload);
  },

  async stopBadgeFarm(token: string) {
    return this.stopBadgeBoost(token);
  },

  async claimQuest(token: string, questId: string) {
    return this.claimReward(token, questId);
  },

  async verifySubscription(sessionToken: string): Promise<{
    verified: boolean;
    authenticated: boolean;
    hasActivePlan: boolean;
    daysRemaining: number;
    domainTarget: string;
    account: AuthUser | null;
    subscription: UserSubscription | null;
  }> {
    const res = await fetch(
      `${QUEST_API_URL}/api/subscription/verify?session=${encodeURIComponent(sessionToken)}`,
      {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      }
    );
    if (!res.ok) {
      throw new Error('Không thể xác minh trạng thái gói từ Database');
    }
    return res.json();
  },

  async saveAccountTokens(
    sessionToken: string,
    tokens: Partial<AccountTokens>
  ): Promise<{
    success: boolean;
    account: AuthUser;
    verifiedDiscordUser?: DiscordUser | null;
    subscription: UserSubscription | null;
  }> {
    const res = await fetch(`${QUEST_API_URL}/api/account/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        sessionToken,
        ...tokens,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Không thể lưu cấu hình Token vào Database');
    }
    return data;
  },

  async verifyToken(token: string): Promise<{ valid: boolean; user?: DiscordUser; error?: string }> {
    const res = await fetch(`${QUEST_API_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.json();
  },

  async getQuests(token: string): Promise<{ quests: QuestDTO[]; questEnrollmentBlockedUntil: string | null }> {
    const res = await fetch(`${QUEST_API_URL}/api/quests/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch quests');
    }
    return res.json();
  },

  async enrollQuest(token: string, questId: string): Promise<{ success: boolean; quest: QuestDTO }> {
    const res = await fetch(`${QUEST_API_URL}/api/quests/${questId}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to enroll quest');
    }
    return res.json();
  },

  async startQuest(token: string, questId: string): Promise<{ success: boolean; job: QuestJob }> {
    const res = await fetch(`${QUEST_API_URL}/api/quests/${questId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start quest');
    }
    return res.json();
  },

  async stopQuest(token: string, questId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${QUEST_API_URL}/api/quests/${questId}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.json();
  },

  async startAllQuests(token: string): Promise<{ success: boolean; startedCount: number; jobs: QuestJob[] }> {
    const res = await fetch(`${QUEST_API_URL}/api/quests/start-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start all quests');
    }
    return res.json();
  },

  async stopAllQuests(token: string): Promise<{ success: boolean; stoppedCount: number }> {
    const res = await fetch(`${QUEST_API_URL}/api/quests/stop-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.json();
  },

  async claimReward(token: string, questId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${QUEST_API_URL}/api/quests/${questId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.json();
  },

  async getJobs(token?: string): Promise<{ jobs: QuestJob[] }> {
    const url = token ? `${QUEST_API_URL}/api/quests/jobs?token=${encodeURIComponent(token)}` : `${QUEST_API_URL}/api/quests/jobs`;
    const res = await fetch(url);
    return res.json();
  },

  async getLogs(): Promise<{ logs: LogEntry[] }> {
    const res = await fetch(`${QUEST_API_URL}/api/logs`);
    return res.json();
  },

  async getBadgeCredentials(): Promise<{
    hasToken: boolean;
    hasCookie: boolean;
    tokenMasked: string;
    cookieMasked: string;
  }> {
    const res = await fetch(`${QUEST_API_URL}/api/badges/credentials`);
    if (!res.ok) return { hasToken: false, hasCookie: false, tokenMasked: '', cookieMasked: '' };
    return res.json();
  },

  async saveBadgeCredentials(payload: {
    token?: string;
    cookie?: string;
  }): Promise<{
    success: boolean;
    hasToken: boolean;
    hasCookie: boolean;
    tokenMasked: string;
    cookieMasked: string;
  }> {
    const res = await fetch(`${QUEST_API_URL}/api/badges/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async startBadgeBoost(payload: {
    token?: string;
    cookie?: string;
    mode: 'playtime' | 'played' | 'both';
    hours?: number;
    games?: string[];
  }): Promise<{ success: boolean; message: string; job: any }> {
    const res = await fetch(`${QUEST_API_URL}/api/badges/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể bắt đầu cày giờ chơi');
    }
    return res.json();
  },

  async getBadgeStatus(token: string): Promise<{ running: boolean; job: any }> {
    const res = await fetch(
      `${QUEST_API_URL}/api/badges/status?token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return { running: false, job: null };
    return res.json();
  },

  async stopBadgeBoost(token: string): Promise<{ success: boolean; job: any }> {
    const res = await fetch(`${QUEST_API_URL}/api/badges/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.json();
  },
};

export const streamApi = {
  async getStatus(): Promise<StreamStatus> {
    const res = await fetch(`${STREAM_API_URL}/api/status`);
    if (!res.ok) throw new Error(`Stream status failed: ${res.status}`);
    return res.json();
  },

  async updateTokens(payload: {
    mainToken: string;
    viewerToken: string;
    guildId?: string;
    videoChannelId?: string;
    prefix?: string;
    cmdChannelId?: string;
    adminIds?: string;
  }): Promise<{ success: boolean; message: string; status: StreamStatus }> {
    const res = await fetch(`${STREAM_API_URL}/api/config/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Không thể lưu 2 Token cho StreamBot');
    }
    return data;
  },

  async playVideo(urlOrTitle: string): Promise<{ success: boolean }> {
    const res = await fetch(`${STREAM_API_URL}/api/player/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: urlOrTitle, query: urlOrTitle }),
    });
    return res.json();
  },

  async stopStream(): Promise<{ success: boolean }> {
    const res = await fetch(`${STREAM_API_URL}/api/player/stop`, {
      method: 'POST',
    });
    return res.json();
  },

  async stopVideo(): Promise<{ success: boolean }> {
    return this.stopStream();
  },

  async toggleLoop(loop: boolean): Promise<{ success: boolean }> {
    const res = await fetch(`${STREAM_API_URL}/api/player/loop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loop }),
    });
    return res.json();
  },

  async getVideos(): Promise<{ videos: Array<{ name: string; size: string | number; formattedSize?: string; duration?: number }> }> {
    const res = await fetch(`${STREAM_API_URL}/api/videos`);
    return res.json();
  },

  async toggleFarm(enable: boolean): Promise<{ success: boolean }> {
    const res = await fetch(`${STREAM_API_URL}/api/farm/toggle-auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoWatch: enable }),
    });
    return res.json();
  },
};
