import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, NavTabId } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { LandingPage } from './components/LandingPage';
import { AboutPage } from './components/AboutPage';
import { QuestDashboard } from './components/QuestDashboard';
import { StreamDashboard } from './components/StreamDashboard';
import { BadgeDashboard } from './components/BadgeDashboard';
import { TerminalLogs } from './components/TerminalLogs';
import { LoginModal } from './components/LoginModal';
import { SiteFooter } from './components/SiteFooter';
import { ToastProvider, useToast } from './components/Toast';
import {
  AccountTokens,
  AuthUser,
  QuestDTO,
  QuestJob,
  LogEntry,
  StreamStatus,
  UserSubscription,
} from './types';
import { questApi, streamApi, QUEST_WS_URL, STREAM_WS_URL } from './services/api';

const detectInitialDomainMode = (): 'landing' | 'dash' => {
  if (typeof window === 'undefined') return 'landing';
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith('dash.')) return 'dash';
  const params = new URLSearchParams(window.location.search);
  if (params.get('domain') === 'dash') return 'dash';
  if (window.location.pathname.startsWith('/dash')) return 'dash';
  return 'landing';
};

const getTabFromHash = (): NavTabId => {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  if (['home', 'about', 'quests', 'stream', 'badges', 'logs'].includes(hash)) {
    return hash as NavTabId;
  }
  return 'home';
};

const mergeLogs = (existing: LogEntry[], incoming: LogEntry[]): LogEntry[] => {
  const seen = new Set(existing.map((l) => `${l.timestamp}_${l.message}`));
  const newLogs = incoming.filter((l) => !seen.has(`${l.timestamp}_${l.message}`));
  const combined = [...existing, ...newLogs];
  return combined.length > 500 ? combined.slice(-500) : combined;
};

const AppContent: React.FC = () => {
  const { toast } = useToast();
  const [domainMode, setDomainMode] = useState<'landing' | 'dash'>(detectInitialDomainMode);
  const [activeTab, setActiveTab] = useState<NavTabId>(getTabFromHash);

  const [sessionToken, setSessionToken] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('session');
    if (fromQuery) {
      localStorage.setItem('arychi_session_token', fromQuery);
      return fromQuery;
    }
    return localStorage.getItem('arychi_session_token') || '';
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('arychi_oauth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string>(
    () => localStorage.getItem('arychi_discord_token') || ''
  );

  const [quests, setQuests] = useState<QuestDTO[]>([]);
  const [jobs, setJobs] = useState<Map<string, QuestJob>>(new Map());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);

  const [questConnected, setQuestConnected] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleSaveAuth = (
    newUser: AuthUser | null,
    newSessionToken: string,
    newSub: UserSubscription | null
  ) => {
    setUser(newUser);
    setSessionToken(newSessionToken);

    if (newUser && newSessionToken) {
      localStorage.setItem('arychi_oauth_user', JSON.stringify(newUser));
      localStorage.setItem('arychi_session_token', newSessionToken);
      if (newUser.tokens?.questToken) {
        setToken(newUser.tokens.questToken);
        localStorage.setItem('arychi_discord_token', newUser.tokens.questToken);
      }
    } else {
      localStorage.removeItem('arychi_oauth_user');
      localStorage.removeItem('arychi_session_token');
      localStorage.removeItem('arychi_subscription');
      localStorage.removeItem('arychi_discord_token');
      setToken('');
    }
  };

  const handleUpdateAccountTokens = (tokens: Partial<AccountTokens>) => {
    if (tokens.questToken !== undefined) {
      setToken(tokens.questToken);
      localStorage.setItem('arychi_discord_token', tokens.questToken);
    }
    setUser((prev) => {
      if (!prev) return null;
      const updated: AuthUser = {
        ...prev,
        tokens: {
          questToken: tokens.questToken ?? prev.tokens?.questToken ?? '',
          streamMainToken: tokens.streamMainToken ?? prev.tokens?.streamMainToken ?? '',
          streamViewerToken: tokens.streamViewerToken ?? prev.tokens?.streamViewerToken ?? '',
          streamGuildId: tokens.streamGuildId ?? prev.tokens?.streamGuildId,
          streamChannelId: tokens.streamChannelId ?? prev.tokens?.streamChannelId,
          prefix: tokens.prefix ?? prev.tokens?.prefix,
          commandChannelId: tokens.commandChannelId ?? prev.tokens?.commandChannelId,
          adminIds: tokens.adminIds ?? prev.tokens?.adminIds,
        },
      };
      localStorage.setItem('arychi_oauth_user', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSaveQuestToken = (newToken: string, updatedTokens?: Partial<AccountTokens>) => {
    setToken(newToken);
    localStorage.setItem('arychi_discord_token', newToken);
    if (updatedTokens) {
      handleUpdateAccountTokens(updatedTokens);
    }
  };

  // Verify session against Backend
  const verifySession = useCallback(async (tok: string) => {
    if (!tok) return;
    try {
      const res = await questApi.verifySubscription(tok);
      if (res.authenticated && res.account) {
        setUser(res.account);
        localStorage.setItem('arychi_oauth_user', JSON.stringify(res.account));
        if (res.account.tokens?.questToken) {
          setToken(res.account.tokens.questToken);
          localStorage.setItem('arychi_discord_token', res.account.tokens.questToken);
        }
      }
    } catch {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    if (sessionToken) {
      verifySession(sessionToken);
    }
  }, [sessionToken, domainMode, verifySession]);

  // Capture Discord OAuth2 redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      questApi
        .loginWithOAuthCode(code)
        .then((res) => {
          handleSaveAuth(res.account, res.sessionToken, res.subscription);
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('code');
          cleanUrl.searchParams.delete('state');
          cleanUrl.searchParams.delete('guild_id');
          cleanUrl.searchParams.delete('permissions');
          window.history.replaceState({}, '', cleanUrl.toString());
          toast.success(`Đã kết nối tài khoản Discord: @${res.account.username}`);
        })
        .catch((err) => {
          toast.error(`Xác thực Discord OAuth2 thất bại: ${err?.message || 'Mã code hết hạn'}`);
        });
    }
  }, []);

  // Redirect / Navigate to Dashboard
  const handleEnterDashboard = () => {
    const host = window.location.hostname.toLowerCase();
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    if (!isLocal && (host === 'arychi.xyz' || host === 'www.arychi.xyz' || host === 'arychy.xyz') && !host.startsWith('dash.')) {
      const rootDomain = host.replace(/^www\./, '');
      const sess = sessionToken ? `?session=${encodeURIComponent(sessionToken)}` : '';
      window.location.href = `https://dash.${rootDomain}${sess}#home`;
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('domain', 'dash');
    if (sessionToken) {
      nextUrl.searchParams.set('session', sessionToken);
    }
    nextUrl.hash = '#home';
    window.history.pushState({}, '', nextUrl.toString());
    setDomainMode('dash');
    setActiveTab('home');
    if (sessionToken) {
      verifySession(sessionToken);
    }
  };

  const handleBackToLanding = () => {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('domain');
    nextUrl.hash = '';
    window.history.pushState({}, '', nextUrl.toString());
    setDomainMode('landing');
    setActiveTab('home');
  };

  const handleSelectTab = (tab: NavTabId) => {
    setActiveTab(tab);
    window.location.hash = `#${tab}`;
  };

  const loadQuests = useCallback(async (silent = false) => {
    if (!token && !user?.tokens?.questToken) return;
    const activeToken = token || user?.tokens?.questToken || '';
    if (!silent) setLoadingQuests(true);
    try {
      const data = await questApi.getQuests(activeToken);
      setQuests(data.quests || []);
    } catch {
      // Ignore transient errors
    } finally {
      if (!silent) setLoadingQuests(false);
    }
  }, [token, user?.tokens?.questToken]);

  const loadStreamStatus = useCallback(async (silent = false) => {
    if (!silent) setLoadingStream(true);
    try {
      const st = await streamApi.getStatus();
      setStreamStatus(st);
    } catch {
      // Ignore transient errors
    } finally {
      if (!silent) setLoadingStream(false);
    }
  }, []);

  // WebSockets for Quests & Stream
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any;

    const connectQuestWS = () => {
      try {
        ws = new WebSocket(QUEST_WS_URL);
        ws.onopen = () => setQuestConnected(true);
        ws.onclose = () => {
          setQuestConnected(false);
          reconnectTimer = setTimeout(connectQuestWS, 3000);
        };
        ws.onerror = () => ws?.close();
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'job_progress' && data.payload) {
              const incoming = data.payload as QuestJob;
              setJobs((prev) => {
                const existing = prev.get(incoming.questId);
                if (
                  existing &&
                  existing.currentSeconds === incoming.currentSeconds &&
                  existing.status === incoming.status &&
                  existing.progressPercent === incoming.progressPercent &&
                  existing.message === incoming.message
                ) {
                  return prev; // No change, keep same Map reference to prevent re-render
                }
                const next = new Map(prev);
                next.set(incoming.questId, incoming);
                return next;
              });
            } else if (data.type === 'initial_state' && data.payload) {
              if (data.payload.quests) setQuests(data.payload.quests);
              if (data.payload.logs) {
                setLogs((prev) => mergeLogs(prev, data.payload.logs));
              }
            } else if (data.type === 'log' && data.payload) {
              setLogs((prev) => mergeLogs(prev, [data.payload]));
            }
          } catch {
            // Ignore malformed WS payloads
          }
        };
      } catch {
        setQuestConnected(false);
        reconnectTimer = setTimeout(connectQuestWS, 5000);
      }
    };

    connectQuestWS();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any;

    const connectStreamWS = () => {
      try {
        ws = new WebSocket(STREAM_WS_URL);
        ws.onopen = () => setStreamConnected(true);
        ws.onclose = () => {
          setStreamConnected(false);
          reconnectTimer = setTimeout(connectStreamWS, 3000);
        };
        ws.onerror = () => ws?.close();
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'status' && data.data) {
              setStreamStatus(data.data);
            }
          } catch {
            // Ignore malformed WS payloads
          }
        };
      } catch {
        setStreamConnected(false);
        reconnectTimer = setTimeout(connectStreamWS, 5000);
      }
    };

    connectStreamWS();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  useEffect(() => {
    loadStreamStatus(false);
    const interval = setInterval(() => loadStreamStatus(true), 10000);
    return () => clearInterval(interval);
  }, [loadStreamStatus]);

  useEffect(() => {
    if (token) {
      loadQuests();
    }
  }, [token, loadQuests]);

  const runningQuestsCount = Array.from(jobs.values()).filter(
    (j) => j.status === 'running' || j.status === 'enrolling'
  ).length;

  const streamPlaying = Boolean(streamStatus?.stream.playing);
  const hasQuestToken = Boolean(token || user?.tokens?.questToken);
  const hasStreamTokens = Boolean(
    (user?.tokens?.streamMainToken && user?.tokens?.streamViewerToken) ||
      (streamStatus?.config?.hasMainToken && streamStatus?.config?.hasViewerToken)
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#111714] text-[#f2f5f1]">
      {domainMode === 'landing' ? (
        <>
          <Navbar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            user={user}
            questConnected={questConnected}
            streamConnected={streamConnected}
            runningQuestsCount={runningQuestsCount}
            streamPlaying={streamPlaying}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            onEnterDashboard={handleEnterDashboard}
          />

          <main className="page flex-1 pt-8 pb-16">
            <LandingPage
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
              onEnterDashboard={handleEnterDashboard}
              user={user}
              questConnected={questConnected}
              streamConnected={streamConnected}
              onNavigateTab={(tab) => handleSelectTab(tab)}
            />
          </main>

          <SiteFooter onNavigateTab={handleSelectTab} onEnterDashboard={handleEnterDashboard} />
        </>
      ) : (
        <div className="min-h-screen flex flex-col lg:flex-row">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            user={user}
            hasQuestToken={hasQuestToken}
            hasStreamTokens={hasStreamTokens}
            questConnected={questConnected}
            streamConnected={streamConnected}
            runningQuestsCount={runningQuestsCount}
            streamPlaying={streamPlaying}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            onBackToLanding={handleBackToLanding}
          />

          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 w-full max-w-[1720px]">
            {activeTab === 'home' && (
              <DashboardOverview
                user={user}
                token={token}
                questConnected={questConnected}
                streamConnected={streamConnected}
                quests={quests}
                jobs={jobs}
                loadingQuests={loadingQuests}
                onRefreshQuests={loadQuests}
                streamStatus={streamStatus}
                loadingStream={loadingStream}
                onRefreshStream={loadStreamStatus}
                logs={logs}
                onNavigateTab={handleSelectTab}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
              />
            )}

            {activeTab === 'quests' && (
              <QuestDashboard
                user={user}
                sessionToken={sessionToken}
                token={token}
                onSaveQuestToken={handleSaveQuestToken}
                quests={quests}
                jobs={jobs}
                loading={loadingQuests}
                onRefresh={loadQuests}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
              />
            )}

            {activeTab === 'stream' && (
              <StreamDashboard
                user={user}
                sessionToken={sessionToken}
                onUpdateAccountTokens={handleUpdateAccountTokens}
                status={streamStatus}
                loading={loadingStream}
                onRefresh={loadStreamStatus}
                streamConnected={streamConnected}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
                logs={logs}
              />
            )}

            {activeTab === 'badges' && (
              <BadgeDashboard
                user={user}
                sessionToken={sessionToken}
                token={token}
                onSaveQuestToken={handleSaveQuestToken}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
              />
            )}

            {activeTab === 'logs' &&
              (user?.role === 'admin' ? (
                <TerminalLogs logs={logs} onClear={() => setLogs([])} />
              ) : (
                <div className="surface p-8 text-center space-y-3 rounded-xl border border-[#2d3b33]">
                  <div className="w-12 h-12 rounded-lg bg-[#161e1a] border border-[#2d3b33] text-[#8e96e8] mx-auto grid place-items-center text-xl">
                    🔒
                  </div>
                  <h3 className="text-base font-bold text-[#f2f5f1]">Khu vực dành cho Quản trị viên</h3>
                  <p className="text-xs text-[#9aa8a0] max-w-md mx-auto leading-relaxed">
                    Nhật ký kỹ thuật chỉ hiển thị cho tài khoản Quản trị viên. Người dùng có thể sử dụng các chức năng Quests, Treo Stream và Cày giờ chơi bình thường.
                  </p>
                </div>
              ))}

            {activeTab === 'about' && (
              <AboutPage
                questConnected={questConnected}
                streamConnected={streamConnected}
                onNavigateTab={handleSelectTab}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
                isLoggedIn={Boolean(user)}
              />
            )}
          </main>
        </div>
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        user={user}
        onSaveAuth={handleSaveAuth}
      />
    </div>
  );
};

export const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
