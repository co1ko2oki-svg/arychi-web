import {
  AccountTokens,
  AuthUser,
  DiscordUser,
  LogEntry,
  PaymentOrderDTO,
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
    plan: { id: string; name: string; pricePerMonth: number; currency: string };
    oauth: {
      discordConfigured: boolean;
      discordClientId: string | null;
      discordAuthUrl: string | null;
      discordBotInviteUrl: string | null;
      googleAuthUrl: string | null;
    };
    bankInfo: { bankId: string; bankName: string; accountNo: string; accountName: string };
    payosConfigured: boolean;
  }> {
    const res = await fetch(`${QUEST_API_URL}/api/auth/oauth/config`);
    if (!res.ok) throw new Error('Không thể tải cấu hình OAuth2');
    return res.json();
  },

  async checkHealth(): Promise<{ status: string; uptime: number }> {
    const res = await fetch(`${QUEST_API_URL}/api/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  },

  async oauthLogin(payload: {
    provider: 'discord' | 'google';
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

  async createPaymentOrder(
    sessionToken: string,
    months: number,
    returnOrigin?: string
  ): Promise<{ success: boolean; order: PaymentOrderDTO }> {
    const res = await fetch(`${QUEST_API_URL}/api/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        sessionToken,
        months,
        returnOrigin: returnOrigin || window.location.origin,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Không thể khởi tạo đơn VietQR / PayOS');
    }
    return data;
  },

  async checkPaymentOrder(orderCode: number): Promise<{
    order: PaymentOrderDTO;
    account: AuthUser | null;
    subscription: UserSubscription | null;
  }> {
    const res = await fetch(`${QUEST_API_URL}/api/payments/order/${orderCode}`);
    if (!res.ok) {
      throw new Error('Không thể kiểm tra trạng thái đơn hàng');
    }
    return res.json();
  },

  async confirmPaymentOrder(orderCode: number): Promise<{
    success: boolean;
    order: PaymentOrderDTO;
    account: AuthUser;
    subscription: UserSubscription;
  }> {
    const res = await fetch(`${QUEST_API_URL}/api/payments/confirm/${orderCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Xác nhận thanh toán thất bại');
    }
    return data;
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
