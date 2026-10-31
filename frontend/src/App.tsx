import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, NavTabId } from './components/Navbar';
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
import { AuthUser, PlanTierId, QuestDTO, QuestJob, LogEntry, StreamStatus, UserSubscription } from './types';
import { questApi, streamApi, QUEST_WS_URL, STREAM_WS_URL } from './services/api';

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
  const [activeTab, setActiveTab] = useState<NavTabId>(getTabFromHash);

  const [token, setToken] = useState<string>(() => localStorage.getItem('arychi_discord_token') || '');
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('arychi_discord_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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
  const [selectedSubPlan, setSelectedSubPlan] = useState<PlanTierId>('pro');

  const [subscription, setSubscription] = useState<UserSubscription | null>(() => {
    try {
      const saved = localStorage.getItem('arychi_subscription');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleOpenSubModal = (planId: PlanTierId = 'pro') => {
    setSelectedSubPlan(planId);
    setIsSubModalOpen(true);
  };

  const handleActivateSubscription = (sub: UserSubscription) => {
    setSubscription(sub);
    localStorage.setItem('arychi_subscription', JSON.stringify(sub));
    toast.success(`Đã kích hoạt ${sub.planName} cho tài khoản @${user?.username || 'Discord'}`);
  };

  const handleDeactivateSubscription = () => {
    setSubscription(null);
    localStorage.removeItem('arychi_subscription');
    toast.info('Đã hủy gói dịch vụ hiện tại');
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
    const titles: Record<NavTabId, string> = {
      home: 'Tổng quan · Arychi Suite',
      about: 'Giới thiệu · Arychi Suite',
      quests: 'Nhiệm vụ Discord · Arychi Suite',
      stream: 'StreamBot Voice · Arychi Suite',
      badges: 'Giờ chơi · Arychi Suite',
      logs: 'Nhật ký hệ thống · Arychi Suite',
    };
    document.title = titles[activeTab] || 'Arychi Suite';
  }, [activeTab]);

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

  const handleSaveUser = (newUser: AuthUser | null) => {
    setUser(newUser);
    const newToken = newUser?.token || '';
    setToken(newToken);
    if (newToken) {
      localStorage.setItem('arychi_discord_token', newToken);
      toast.success(`Đã kết nối tài khoản @${newUser?.username || 'Discord'}`);
    } else {
      localStorage.removeItem('arychi_discord_token');
      toast.info('Đã đăng xuất tài khoản Discord');
    }
    if (newUser) {
      localStorage.setItem('arychi_discord_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('arychi_discord_user');
    }
  };

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
    (j) => j.status === 'running' || j.status === 'enrolling',
  ).length;
  const streamPlaying = Boolean(streamStatus?.stream.playing);

  return (
    <div className="min-h-screen flex flex-col">
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
      />

      <main className="page flex-1 pt-8 pb-16">
        {activeTab === 'home' && (
          user && token && subscription ? (
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
              onNavigateTab={(tab) => handleSelectTab(tab)}
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
              onOpenSubscriptionModal={handleOpenSubModal}
            />
          ) : (
            <LandingPage
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
              onOpenSubscriptionModal={handleOpenSubModal}
              user={user}
              subscription={subscription}
              questConnected={questConnected}
              streamConnected={streamConnected}
              onNavigateTab={(tab) => handleSelectTab(tab)}
            />
          )
        )}

        {activeTab === 'about' && (
          <AboutPage
            questConnected={questConnected}
            streamConnected={streamConnected}
            onNavigateTab={handleSelectTab}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            isLoggedIn={Boolean(user && token)}
          />
        )}

        {activeTab === 'quests' && (
          <QuestDashboard
            user={user}
            subscription={subscription}
            token={token}
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
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            onOpenSubscriptionModal={handleOpenSubModal}
          />
        )}

        {activeTab === 'logs' && (
          <TerminalLogs logs={logs} onClear={() => setLogs([])} />
        )}
      </main>

      <SiteFooter onNavigateTab={handleSelectTab} />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        user={user}
        onSaveUser={handleSaveUser}
      />

      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        user={user}
        subscription={subscription}
        initialPlanId={selectedSubPlan}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onActivateSubscription={handleActivateSubscription}
        onDeactivateSubscription={handleDeactivateSubscription}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
