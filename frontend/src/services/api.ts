import { DiscordUser, QuestDTO, QuestJob, LogEntry, StreamStatus } from '../types';

export const QUEST_API_URL = import.meta.env.VITE_QUEST_API_URL || 'http://localhost:3001';
export const QUEST_WS_URL = import.meta.env.VITE_QUEST_WS_URL || 'ws://localhost:3001/ws';

export const STREAM_API_URL = import.meta.env.VITE_STREAM_API_URL || 'http://localhost:3000';
export const STREAM_WS_URL = import.meta.env.VITE_STREAM_WS_URL || 'ws://localhost:3000/ws';

export const questApi = {
  async checkHealth(): Promise<{ status: string; uptime: number }> {
    const res = await fetch(`${QUEST_API_URL}/api/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
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

  async playVideo(urlOrTitle: string): Promise<{ success: boolean }> {
    const res = await fetch(`${STREAM_API_URL}/api/player/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: urlOrTitle }),
    });
    return res.json();
  },

  async stopStream(): Promise<{ success: boolean }> {
    const res = await fetch(`${STREAM_API_URL}/api/player/stop`, {
      method: 'POST',
    });
    return res.json();
  },

  async getVideos(): Promise<{ videos: Array<{ name: string; size: string; duration?: number }> }> {
    const res = await fetch(`${STREAM_API_URL}/api/videos`);
    return res.json();
  },

  async toggleFarm(enable: boolean): Promise<{ success: boolean }> {
    const res = await fetch(`${STREAM_API_URL}/api/farm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoWatch: enable }),
    });
    return res.json();
  },
};
