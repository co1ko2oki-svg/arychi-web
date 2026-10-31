import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, KeyRound, Loader2, Lock, QrCode, ShieldCheck, UserCheck } from 'lucide-react';
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
import { SubscriptionModal } from './components/SubscriptionModal';
import { SiteFooter } from './components/SiteFooter';
import { ToastProvider, useToast } from './components/Toast';
import {
  AccountTokens,
  AuthUser,
  PlanTierId,
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

  const [subscription, setSubscription] = useState<UserSubscription | null>(() => {
    try {
      const saved = localStorage.getItem('arychi_subscription');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string>(
    () => localStorage.getItem('arychi_discord_token') || ''
  );

  const [verifyingDash, setVerifyingDash] = useState<boolean>(false);
  const [dashVerified, setDashVerified] = useState<boolean>(false);

  const [quests, setQuests] = useState<QuestDTO[]>([]);
  const [jobs, setJobs] = useState<Map<string, QuestJob>>(new Map());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);

  const [questConnected, setQuestConnected] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedSubPlan, setSelectedSubPlan] = useState<PlanTierId>('monthly_50k');

  const handleOpenSubModal = (planId: PlanTierId = 'monthly_50k') => {
    setSelectedSubPlan(planId);
    setIsSubModalOpen(true);
  };

  const handleSaveAuth = (
    newUser: AuthUser | null,
    newSessionToken: string,
    newSub: UserSubscription | null
  ) => {
    setUser(newUser);
    setSessionToken(newSessionToken);
    setSubscription(newSub);

    if (newUser && newSessionToken) {
      localStorage.setItem('arychi_oauth_user', JSON.stringify(newUser));
      localStorage.setItem('arychi_session_token', newSessionToken);
      const qTok = newUser.tokens?.questToken || '';
      if (qTok) {
        setToken(qTok);
        localStorage.setItem('arychi_discord_token', qTok);
      }
      toast.success(
        `Đã đăng nhập OAuth2: @${newUser.username} (${newUser.provider.toUpperCase()})`
      );
    } else {
      localStorage.removeItem('arychi_oauth_user');
      localStorage.removeItem('arychi_session_token');
      localStorage.removeItem('arychi_subscription');
      setDashVerified(false);
      toast.info('Đã đăng xuất tài khoản OAuth2');
    }

    if (newSub) {
      localStorage.setItem('arychi_subscription', JSON.stringify(newSub));
    } else {
      localStorage.removeItem('arychi_subscription');
    }
  };

  const handleActivateSubscription = (sub: UserSubscription, updatedUser?: AuthUser) => {
    setSubscription(sub);
    localStorage.setItem('arychi_subscription', JSON.stringify(sub));
    if (updatedUser) {
      setUser(updatedUser);
      localStorage.setItem('arychi_oauth_user', JSON.stringify(updatedUser));
    }
    setDashVerified(Boolean(sub.isActive !== false));
    toast.success(
      `Đã xác nhận thanh toán & kích hoạt gói 50.000đ/tháng (Còn ${sub.daysRemaining ?? 30} ngày)`
    );
  };

  const handleUpdateAccountTokens = (partialTokens: Partial<AccountTokens>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const mergedTokens: AccountTokens = {
        questToken: prev.tokens?.questToken || '',
        streamMainToken: prev.tokens?.streamMainToken || '',
        streamViewerToken: prev.tokens?.streamViewerToken || '',
        streamGuildId: prev.tokens?.streamGuildId || '',
        streamChannelId: prev.tokens?.streamChannelId || '',
        ...partialTokens,
      };
      const next: AuthUser = { ...prev, tokens: mergedTokens };
      localStorage.setItem('arychi_oauth_user', JSON.stringify(next));
      return next;
    });
  };

  const handleSaveQuestToken = (newToken: string, updatedTokens?: Partial<AccountTokens>) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem('arychi_discord_token', newToken);
    } else {
      localStorage.removeItem('arychi_discord_token');
    }
    if (updatedTokens) {
      handleUpdateAccountTokens(updatedTokens);
    }
  };

  // Verify session & subscription against Backend Database (2nd verification for dash.arychi.xyz)
  const verifySubscriptionFromDb = useCallback(
    async (tok: string) => {
      if (!tok) {
        setDashVerified(false);
        return;
      }
      setVerifyingDash(true);
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
        if (res.subscription) {
          setSubscription(res.subscription);
          localStorage.setItem('arychi_subscription', JSON.stringify(res.subscription));
        }
        setDashVerified(Boolean(res.verified && res.hasActivePlan));
      } catch {
        // Fallback to local state if backend is temporarily unreachable
        setDashVerified(Boolean(user && subscription && subscription.isActive !== false));
      } finally {
        setVerifyingDash(false);
      }
    },
    [user, subscription]
  );

  useEffect(() => {
    if (sessionToken) {
      verifySubscriptionFromDb(sessionToken);
    }
  }, [sessionToken, domainMode, verifySubscriptionFromDb]);

  // Redirect / Navigate to dash.arychi.xyz
  const handleEnterDashboard = () => {
    if (!user || !sessionToken) {
      toast.warning('Vui lòng đăng nhập bằng Bot Discord OAuth2 hoặc Google trước');
      setIsLoginModalOpen(true);
      return;
    }
    if (!subscription || subscription.isActive === false) {
      toast.warning('Vui lòng mua gói 50.000đ/tháng qua VietQR / PayOS trước khi vào Dashboard');
      setIsSubModalOpen(true);
      return;
    }

    const host = window.location.hostname.toLowerCase();
    if ((host === 'arychi.xyz' || host === 'www.arychi.xyz' || host === 'arychy.xyz') && !host.startsWith('dash.')) {
      const rootDomain = host.replace(/^www\./, '');
      window.location.href = `https://dash.${rootDomain}?session=${encodeURIComponent(sessionToken)}#home`;
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('domain', 'dash');
    nextUrl.searchParams.set('session', sessionToken);
    nextUrl.hash = '#home';
    window.history.pushState({}, '', nextUrl.toString());
    setDomainMode('dash');
    setActiveTab('home');
    verifySubscriptionFromDb(sessionToken);
  };

  const handleBackToLanding = () => {
    const host = window.location.hostname.toLowerCase();
    if (host.startsWith('dash.')) {
      const rootDomain = host.replace(/^dash\./, '');
      window.location.href = `https://${rootDomain}`;
      return;
    }
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('domain');
    nextUrl.hash = '#intro';
    window.history.pushState({}, '', nextUrl.toString());
    setDomainMode('landing');
  };

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(getTabFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectTab = (tab: NavTabId) => {
    setActiveTab(tab);
    if (window.location.hash !== `#${tab}`) {
      window.location.hash = `#${tab}`;
    }
  };

  useEffect(() => {
    if (domainMode === 'landing') {
      document.title = 'Arychi Suite — arychi.xyz (Giới thiệu & Gói 50k/tháng)';
      return;
    }
    const titles: Record<NavTabId, string> = {
      home: 'Tổng quan · dash.arychi.xyz',
      about: 'Tài liệu kỹ thuật · dash.arychi.xyz',
      quests: 'Discord Quests (1 Token) · dash.arychi.xyz',
      stream: 'Treo Stream (2 Token) · dash.arychi.xyz',
      badges: 'Giờ chơi (1 Token) · dash.arychi.xyz',
      logs: 'Nhật ký hệ thống · dash.arychi.xyz',
    };
    document.title = titles[activeTab] || 'dash.arychi.xyz';
  }, [activeTab, domainMode]);

  const loadQuests = useCallback(async () => {
    if (!token) return;
    setLoadingQuests(true);
    try {
      const data = await questApi.getQuests(token);
      setQuests(data.quests);
      setQuestConnected(true);
    } catch (err: any) {
      console.warn('Could not load quests:', err?.message);
    } finally {
      setLoadingQuests(false);
    }
  }, [token]);

  const loadStreamStatus = useCallback(async () => {
    setLoadingStream(true);
    try {
      const status = await streamApi.getStatus();
      setStreamStatus(status);
      setStreamConnected(true);
    } catch {
      setStreamConnected(false);
    } finally {
      setLoadingStream(false);
    }
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: any = null;

    const connectQuestWs = () => {
      try {
        ws = new WebSocket(QUEST_WS_URL);

        ws.onopen = () => {
          setQuestConnected(true);
          ws?.send(JSON.stringify({ type: 'get_init' }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'init') {
              if (msg.data?.logs) setLogs((prev) => mergeLogs(prev, msg.data.logs));
              if (msg.data?.jobs) {
                const map = new Map<string, QuestJob>();
                msg.data.jobs.forEach((j: QuestJob) => map.set(j.questId, j));
                setJobs(map);
              }
            } else if (msg.type === 'log') {
              setLogs((prev) => {
                const next = [...prev, msg.data];
                return next.length > 500 ? next.slice(-500) : next;
              });
            } else if (msg.type === 'job:progress' || msg.type === 'job:update') {
              const updatedJob = msg.data as QuestJob;
              setJobs((prev) => {
                const next = new Map(prev);
                next.set(updatedJob.questId, updatedJob);
                return next;
              });

              if (updatedJob.status === 'completed') {
                loadQuests();
              }
            }
          } catch {}
        };

        ws.onclose = () => {
          setQuestConnected(false);
          timer = setTimeout(connectQuestWs, 3000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        timer = setTimeout(connectQuestWs, 3000);
      }
    };

    connectQuestWs();

    return () => {
      clearTimeout(timer);
      ws?.close();
    };
  }, [loadQuests]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: any = null;

    const connectStreamWs = () => {
      try {
        ws = new WebSocket(STREAM_WS_URL);

        ws.onopen = () => {
          setStreamConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'status') {
              setStreamStatus(msg.data);
            } else if (msg.type === 'init') {
              if (msg.status) setStreamStatus(msg.status);
              if (msg.logs) {
                const formatted = msg.logs.map((l: any) => ({
                  timestamp: l.timestamp || new Date().toISOString(),
                  level: l.level || 'info',
                  message: `[StreamBot] ${l.message || ''}`,
                }));
                setLogs((prev) => mergeLogs(prev, formatted));
              }
            } else if (msg.type === 'log') {
              setLogs((prev) => [
                ...prev,
                {
                  timestamp: msg.data?.timestamp || new Date().toISOString(),
                  level: msg.data?.level || 'info',
                  message: `[StreamBot] ${msg.data?.message || ''}`,
                },
              ]);
            }
          } catch {}
        };

        ws.onclose = () => {
          setStreamConnected(false);
          timer = setTimeout(connectStreamWs, 4000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        timer = setTimeout(connectStreamWs, 4000);
      }
    };

    connectStreamWs();

    return () => {
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  useEffect(() => {
    if (token) {
      loadQuests();
    }
    loadStreamStatus();
  }, [token, loadQuests, loadStreamStatus]);

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
    <div className="min-h-screen flex flex-col">
      {domainMode === 'landing' ? (
        <>
          <Navbar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            user={user}
            subscription={subscription}
            questConnected={questConnected}
            streamConnected={streamConnected}
            runningQuestsCount={runningQuestsCount}
            streamPlaying={streamPlaying}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            onOpenSubscriptionModal={handleOpenSubModal}
            onEnterDashboard={handleEnterDashboard}
          />

          <main className="page flex-1 pt-8 pb-16">
            <LandingPage
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
              onOpenSubscriptionModal={handleOpenSubModal}
              onEnterDashboard={handleEnterDashboard}
              user={user}
              subscription={subscription}
              questConnected={questConnected}
              streamConnected={streamConnected}
              onNavigateTab={(tab) => handleSelectTab(tab)}
            />
          </main>

          <SiteFooter onNavigateTab={handleSelectTab} onEnterDashboard={handleEnterDashboard} />
        </>
      ) : verifyingDash ? (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="surface p-8 max-w-md w-full text-center space-y-4">
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin mx-auto" />
            <h1 className="text-lg font-bold text-white">
              Đang xác minh lần 2 tại dash.arychi.xyz…
            </h1>
            <p className="text-xs text-slate-300 mx-auto">
              Hệ thống đang đối chiếu phiên đăng nhập OAuth2 và thời hạn gói 50.000đ/tháng trực tiếp từ Database.
            </p>
          </div>
        </div>
      ) : !user || !subscription || !dashVerified ? (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="surface p-8 max-w-xl w-full space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-blue-400" />
                <h1 className="text-lg font-bold text-white">
                  Xác minh truy cập — dash.arychi.xyz
                </h1>
              </div>
              <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-xs font-mono text-rose-300">
                CHƯA ĐỦ ĐIỀU KIỆN
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Miền phụ <code className="inline-code">dash.arychi.xyz</code> yêu cầu xác minh lần thứ 2 với Database: Tài khoản phải đăng nhập qua Bot Discord OAuth2 / Google và đã kích hoạt gói <strong>50.000đ / 1 tháng</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-[#141722] border border-line space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono text-blue-300">
                  <UserCheck className="w-4 h-4" />
                  <span>1. TÀI KHOẢN OAUTH2</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {user ? `Đã đăng nhập: @${user.username}` : 'Chưa đăng nhập OAuth2'}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#141722] border border-line space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono text-blue-300">
                  <KeyRound className="w-4 h-4" />
                  <span>2. GÓI 50.000Đ / THÁNG</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {subscription && subscription.isActive !== false
                    ? `Còn ${subscription.daysRemaining ?? 30} ngày`
                    : 'Chưa mua gói 50k/tháng'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
              <button
                type="button"
                onClick={handleBackToLanding}
                className="btn-ghost"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Về trang giới thiệu arychi.xyz</span>
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                {!user ? (
                  <button
                    type="button"
                    onClick={() => setIsLoginModalOpen(true)}
                    className="btn-primary"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Đăng nhập OAuth2 ngay</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenSubModal('monthly_50k')}
                    className="btn-primary"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Mua gói 50.000đ/tháng (VietQR)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col lg:flex-row">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            user={user}
            subscription={subscription}
            hasQuestToken={hasQuestToken}
            hasStreamTokens={hasStreamTokens}
            questConnected={questConnected}
            streamConnected={streamConnected}
            runningQuestsCount={runningQuestsCount}
            streamPlaying={streamPlaying}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            onOpenSubscriptionModal={handleOpenSubModal}
            onBackToLanding={handleBackToLanding}
          />

          <main className="flex-1 min-w-0 px-4 sm:px-8 py-8 max-w-5xl">
            {activeTab === 'home' && (
              <DashboardOverview
                user={user}
                subscription={subscription}
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
                onOpenSubscriptionModal={handleOpenSubModal}
              />
            )}

            {activeTab === 'quests' && (
              <QuestDashboard
                user={user}
                subscription={subscription}
                sessionToken={sessionToken}
                token={token}
                onSaveQuestToken={handleSaveQuestToken}
                quests={quests}
                jobs={jobs}
                loading={loadingQuests}
                onRefresh={loadQuests}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
                onOpenSubscriptionModal={handleOpenSubModal}
              />
            )}

            {activeTab === 'stream' && (
              <StreamDashboard
                user={user}
                subscription={subscription}
                sessionToken={sessionToken}
                onUpdateAccountTokens={handleUpdateAccountTokens}
                status={streamStatus}
                loading={loadingStream}
                onRefresh={loadStreamStatus}
                streamConnected={streamConnected}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
                onOpenSubscriptionModal={handleOpenSubModal}
              />
            )}

            {activeTab === 'badges' && (
              <BadgeDashboard
                user={user}
                subscription={subscription}
                sessionToken={sessionToken}
                token={token}
                onSaveQuestToken={handleSaveQuestToken}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
                onOpenSubscriptionModal={handleOpenSubModal}
              />
            )}

            {activeTab === 'logs' && <TerminalLogs logs={logs} onClear={() => setLogs([])} />}

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

      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        user={user}
        subscription={subscription}
        sessionToken={sessionToken}
        initialPlanId={selectedSubPlan}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onActivateSubscription={handleActivateSubscription}
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
