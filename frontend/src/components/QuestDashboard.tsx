import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Gamepad2,
  KeyRound,
  List,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Split,
  Square,
  Video,
} from 'lucide-react';
import { AccountTokens, AuthUser, QuestDTO, QuestJob } from '../types';
import { questApi } from '../services/api';
import { useToast } from './Toast';
import { EmptyState, PageHeader, ProgressBar, SegmentedControl, StatusDot } from './ui';

interface QuestDashboardProps {
  user?: AuthUser | null;
  sessionToken?: string;
  token?: string;
  onSaveQuestToken?: (newToken: string, updatedTokens?: Partial<AccountTokens>) => void;
  quests: QuestDTO[];
  jobs: Map<string, QuestJob>;
  loading: boolean;
  onRefresh: () => void;
  onOpenLoginModal: () => void;
}

type QuestFilter = 'available' | 'all' | 'running' | 'completed' | 'video' | 'game' | 'expired';
type ViewMode = 'table' | 'live' | 'split';

const isJobActive = (job?: QuestJob) => job?.status === 'running' || job?.status === 'enrolling';

const formatExpiresAt = (dateStr?: string) => {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return null;
  const diffMs = target - Date.now();
  if (diffMs <= 0) return { label: 'Đã hết hạn', isExpired: true, tone: 'text-[#e08383] font-medium' };
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) {
    return {
      label: `Còn ${diffDays} ngày`,
      isExpired: false,
      tone: diffDays <= 2 ? 'text-[#d7ad69] font-medium' : 'text-[#9aa8a0]',
    };
  }
  return { label: `Còn ${Math.max(1, diffHours)} giờ`, isExpired: false, tone: 'text-[#d7ad69] font-medium' };
};

// Clean circular progress ring matching aqac.lol palette
const CircularProgress: React.FC<{ percent: number; isRunning?: boolean }> = ({ percent, isRunning }) => {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const safePercent = Math.min(100, Math.max(0, percent));
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  return (
    <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
      <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={radius}
          className="stroke-[#2d3b33]"
          strokeWidth="3.5"
          fill="transparent"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          className={`transition-all duration-500 ease-out ${
            safePercent >= 100
              ? 'stroke-[#72b991]'
              : isRunning
              ? 'stroke-[#8e96e8]'
              : 'stroke-[#3b4c42]'
          }`}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <span className="absolute text-[11px] font-bold font-mono text-[#f2f5f1] tabular-nums">
        {safePercent.toFixed(0)}%
      </span>
    </div>
  );
};

export const QuestDashboard: React.FC<QuestDashboardProps> = ({
  user = null,
  sessionToken = '',
  token = '',
  onSaveQuestToken,
  quests,
  jobs,
  loading,
  onRefresh,
  onOpenLoginModal,
}) => {
  const { toast } = useToast();
  const [questTokenInput, setQuestTokenInput] = useState(token || user?.tokens?.questToken || '');
  const [showToken, setShowToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<QuestFilter>('available');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (token) {
      setQuestTokenInput(token);
    } else if (user?.tokens?.questToken) {
      setQuestTokenInput(user.tokens.questToken);
    }
  }, [token, user?.tokens?.questToken]);

  const runningJobs = Array.from(jobs.values()).filter((j) => isJobActive(j));

  const isQuestExpired = (q: QuestDTO) => {
    if (q.status.expired) return true;
    if (q.status.expiresAt) {
      const exp = new Date(q.status.expiresAt).getTime();
      return !isNaN(exp) && exp <= Date.now();
    }
    return false;
  };

  const counts = useMemo(
    () => ({
      available: quests.filter((q) => !isQuestExpired(q) && !q.status.completed).length,
      all: quests.length,
      running: quests.filter((q) => isJobActive(jobs.get(q.id))).length,
      completed: quests.filter((q) => q.status.completed).length,
      video: quests.filter((q) => q.task.type.includes('VIDEO') && !isQuestExpired(q)).length,
      game: quests.filter((q) => !q.task.type.includes('VIDEO') && !isQuestExpired(q)).length,
      expired: quests.filter((q) => isQuestExpired(q)).length,
    }),
    [quests, jobs],
  );

  const handleSaveOneToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = questTokenInput.trim();
    if (!trimmed) {
      toast.warning('Vui lòng nhập 1 Token tài khoản Discord để đồng bộ Quests');
      return;
    }

    setSavingToken(true);
    try {
      const activeSession = sessionToken || user?.sessionToken || '';
      if (activeSession) {
        await questApi.saveAccountTokens(activeSession, { questToken: trimmed });
      } else {
        const check = await questApi.verifyToken(trimmed);
        if (!check.valid) {
          throw new Error(check.error || 'Token Discord không hợp lệ');
        }
      }
      onSaveQuestToken?.(trimmed, { questToken: trimmed });
      toast.success('Đã lưu Token Discord thành công! Đang đồng bộ danh sách nhiệm vụ ✨');
    } catch (err: any) {
      toast.error(err?.message || 'Token Discord không hợp lệ hoặc hết hạn');
    } finally {
      setSavingToken(false);
    }
  };

  const withLoading = async (key: string, fn: () => Promise<void>) => {
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await fn();
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const effectiveToken = token || questTokenInput.trim();

  const handleStartQuest = (questId: string) => {
    if (!effectiveToken) {
      toast.warning('Vui lòng nhập Token Discord ở khung phía trên trước khi bắt đầu');
      return;
    }
    withLoading(questId, async () => {
      try {
        await questApi.startQuest(effectiveToken, questId);
        toast.success('Đã kích hoạt làm nhiệm vụ ✨');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi bắt đầu quest: ${err?.message || err}`);
      }
    });
  };

  const handleStopQuest = (questId: string) => {
    if (!effectiveToken) return;
    withLoading(questId, async () => {
      try {
        await questApi.stopQuest(effectiveToken, questId);
        toast.info('Đã dừng nhiệm vụ');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi dừng quest: ${err?.message || err}`);
      }
    });
  };

  const handleEnrollQuest = (questId: string) => {
    if (!effectiveToken) {
      toast.warning('Vui lòng nhập Token Discord trước khi nhận quest');
      return;
    }
    withLoading(questId, async () => {
      try {
        await questApi.enrollQuest(effectiveToken, questId);
        toast.success('Đã nhận nhiệm vụ thành công ✨');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi nhận quest: ${err?.message || err}`);
      }
    });
  };

  const handleStartAll = () => {
    if (!effectiveToken) {
      toast.warning('Vui lòng nhập Token Discord trước khi chạy');
      return;
    }
    withLoading('all', async () => {
      try {
        await questApi.startAllQuests(effectiveToken);
        toast.success('Đã kích hoạt toàn bộ nhiệm vụ khả dụng ✨');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi bắt đầu tất cả: ${err?.message || err}`);
      }
    });
  };

  const handleStopAll = () => {
    if (!effectiveToken) return;
    withLoading('all', async () => {
      try {
        await questApi.stopAllQuests(effectiveToken);
        toast.info('Đã dừng toàn bộ nhiệm vụ đang chạy');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi dừng tất cả: ${err?.message || err}`);
      }
    });
  };

  const handleClaim = (questId: string) => {
    if (!effectiveToken) return;
    withLoading(questId, async () => {
      try {
        await questApi.claimQuest(effectiveToken, questId);
        toast.success('Đã nhận thưởng thành công! 🎁');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi nhận thưởng: ${err?.message || err}`);
      }
    });
  };

  const filteredQuests = useMemo(() => {
    return quests.filter((q) => {
      const activeJob = jobs.get(q.id);
      const isRunning = isJobActive(activeJob);
      const expired = isQuestExpired(q);

      if (filterType === 'available' && (expired || q.status.completed)) return false;
      if (filterType === 'running' && !isRunning) return false;
      if (filterType === 'completed' && !q.status.completed) return false;
      if (filterType === 'video' && (!q.task.type.includes('VIDEO') || expired)) return false;
      if (filterType === 'game' && (q.task.type.includes('VIDEO') || expired)) return false;
      if (filterType === 'expired' && !expired) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = q.name.toLowerCase().includes(query);
        const matchesApp = q.application.name.toLowerCase().includes(query);
        const matchesReward = (q.rewards.name || '').toLowerCase().includes(query);
        return matchesName || matchesApp || matchesReward;
      }
      return true;
    });
  }, [quests, jobs, filterType, search]);

  const renderAction = (quest: QuestDTO, isRunning: boolean, isCompleted: boolean, isExpired: boolean) => {
    const isLoading = actionLoading[quest.id];
    const spinner = <Loader2 className="w-3.5 h-3.5 animate-spin" />;

    if (isCompleted) {
      if (quest.status.claimed) {
        return (
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-[#72b991] bg-[#72b991]/15 border border-[#72b991]/30 font-medium">
            <Check className="w-3.5 h-3.5" />
            Đã nhận 🎁
          </span>
        );
      }
      return (
        <button
          type="button"
          onClick={() => handleClaim(quest.id)}
          disabled={isLoading}
          className="btn-primary h-8 px-3.5 rounded-lg text-xs font-semibold"
        >
          {isLoading && spinner}
          Nhận thưởng 🎁
        </button>
      );
    }

    if (isRunning) {
      return (
        <button
          type="button"
          onClick={() => handleStopQuest(quest.id)}
          disabled={isLoading}
          className="btn-danger h-8 px-3.5 rounded-lg text-xs font-semibold"
        >
          {isLoading ? spinner : <Square className="w-3 h-3 fill-current" />}
          Dừng
        </button>
      );
    }

    if (isExpired) {
      return (
        <span className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-mono text-[#67756d] bg-[#161e1a] border border-[#2d3b33]">
          Đã hết hạn
        </span>
      );
    }

    if (!quest.status.enrolled) {
      return (
        <button
          type="button"
          onClick={() => handleEnrollQuest(quest.id)}
          disabled={isLoading}
          className="btn-secondary h-8 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap text-[#f2f5f1]"
        >
          {isLoading && spinner}
          Nhận &amp; chạy ✨
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleStartQuest(quest.id)}
        disabled={isLoading}
        className="btn-primary h-8 px-3.5 rounded-lg text-xs font-semibold"
      >
        {isLoading ? spinner : <Play className="w-3 h-3 fill-current" />}
        Bắt đầu ✨
      </button>
    );
  };

  const maskedToken = useMemo(() => {
    if (!effectiveToken) return 'Chưa có Token';
    if (effectiveToken.length <= 16) return effectiveToken;
    return `${effectiveToken.slice(0, 10)}...${effectiveToken.slice(-4)}`;
  }, [effectiveToken]);

  // LIVE ACTIVITY CARDS DRAWER (Right Rail)
  const renderLiveActivitySpace = () => {
    return (
      <div className="surface p-5 rounded-xl space-y-4 border border-[#2d3b33] bg-[#1a231f]">
        <div className="flex items-center justify-between pb-3 border-b border-[#2d3b33]">
          <div className="space-y-0.5">
            <span className="eyebrow text-[#8e96e8]">NHIỆM VỤ</span>
            <h3 className="text-base font-bold text-[#f2f5f1]">Không gian hoạt động</h3>
            <p className="text-xs text-[#9aa8a0]">
              Tiến trình được cập nhật theo thời gian thực
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#72b991]/15 border border-[#72b991]/30 text-[#72b991]">
            <span className="w-2 h-2 rounded-full bg-[#72b991] animate-pulse" />
            <span>LIVE</span>
          </span>
        </div>

        {/* User Badge Bar */}
        <div className="p-3 rounded-lg bg-[#161e1a] border border-[#2d3b33] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1a231f] border border-[#2d3b33] shrink-0">
              <img
                src={user?.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#f2f5f1] truncate">
                {user?.username ? `@${user.username}` : 'Tài khoản Discord'}
              </p>
              <p className="text-[11px] font-mono text-[#9aa8a0] truncate">
                {maskedToken}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-mono font-semibold text-[#8e96e8]">
              {counts.all} quest • <strong className="text-[#72b991]">{counts.running} chạy</strong>
            </span>
          </div>
        </div>

        {/* Quest Cards List */}
        <div className="space-y-3 pt-1">
          {filteredQuests.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#9aa8a0]">
              Chưa có nhiệm vụ nào trong danh sách hiển thị
            </div>
          ) : (
            filteredQuests.map((quest) => {
              const activeJob = jobs.get(quest.id);
              const isRunning = isJobActive(activeJob);
              const progress = activeJob ? activeJob.progressPercent : quest.task.progressPercent;
              const isCompleted = quest.status.completed || activeJob?.status === 'completed';
              const isExpired = isQuestExpired(quest);
              const isVideo = quest.task.type.includes('VIDEO');
              const expiry = formatExpiresAt(quest.status.expiresAt);
              const bannerUrl = quest.assets.banner || quest.assets.hero || quest.rewards.assetUrl;

              return (
                <div
                  key={quest.id}
                  className={`relative overflow-hidden rounded-lg border transition-all p-3.5 flex items-center justify-between gap-4 min-h-[82px] group ${
                    isRunning
                      ? 'border-[#8e96e8] bg-[#212c27]'
                      : 'border-[#2d3b33] hover:border-[#3b4c42] bg-[#161e1a]'
                  }`}
                >
                  {bannerUrl && (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
                      style={{ backgroundImage: `url(${bannerUrl})` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#161e1a] via-[#161e1a]/95 to-transparent pointer-events-none" />

                  <div className="relative z-10 flex items-center gap-3 min-w-0 pr-2">
                    <div className="shrink-0">
                      {isCompleted ? (
                        <span className="w-5 h-5 rounded bg-[#72b991]/20 border border-[#72b991]/40 text-[#72b991] flex items-center justify-center text-xs">
                          ✓
                        </span>
                      ) : isRunning ? (
                        <span className="w-5 h-5 rounded bg-[#8e96e8]/20 border border-[#8e96e8]/40 text-[#8e96e8] flex items-center justify-center text-xs animate-pulse">
                          ▶
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded bg-[#1a231f] border border-[#2d3b33] text-[#67756d] flex items-center justify-center text-xs">
                          ☐
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#1a231f] text-[#9aa8a0] border border-[#2d3b33]">
                          {isVideo ? 'VIDEO' : 'GAME'}
                        </span>
                        <h4 className="text-xs font-bold text-[#f2f5f1] truncate max-w-[200px]" title={quest.name}>
                          {quest.name}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9aa8a0] font-mono">
                        {expiry && (
                          <span className={expiry.tone}>
                            HSD {expiry.label}
                          </span>
                        )}
                        <span>•</span>
                        <span className="text-[#8e96e8]">
                          {quest.rewards.name || '200 Orbs'}
                        </span>
                      </div>

                      <div className="pt-0.5">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[#8e96e8]/20 text-[#8e96e8] border border-[#8e96e8]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8e96e8] animate-ping" />
                            <span>{activeJob?.message || `Đang chạy (${activeJob?.currentSeconds || 0}s)`}</span>
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[#72b991]/20 text-[#72b991] border border-[#72b991]/30">
                            <span>✨ Đã hoàn thành</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono text-[#9aa8a0] bg-[#1a231f] border border-[#2d3b33]">
                            <span>⏳ Sẵn sàng</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center gap-2 shrink-0">
                    <CircularProgress percent={progress} isRunning={isRunning} />
                    <div className="hidden sm:block">
                      {renderAction(quest, isRunning, isCompleted, isExpired)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // FULL-WIDTH TABLE COMPONENT
  const renderQuestsTable = () => {
    return (
      <div className="surface rounded-xl overflow-hidden border border-[#2d3b33]">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Table Header */}
            <div className="grid grid-cols-[minmax(280px,3fr)_95px_minmax(120px,1.5fr)_110px_minmax(140px,1.8fr)_125px] gap-4 px-5 h-11 items-center border-b border-[#2d3b33] text-xs font-semibold uppercase tracking-wider text-[#9aa8a0] bg-[#161e1a]">
              <span>NHIỆM VỤ</span>
              <span>LOẠI</span>
              <span>PHẦN THƯỞNG</span>
              <span>THỜI HẠN</span>
              <span>TIẾN ĐỘ</span>
              <span className="text-right">THAO TÁC</span>
            </div>

            {/* Table Rows */}
            {!effectiveToken ? (
              <EmptyState
                title="Chưa nhập Token tài khoản Discord"
                description="Vui lòng dán 1 Token Discord vào ô cấu hình phía trên và bấm 'Lưu & Tải Quests'."
              />
            ) : loading && quests.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-3 text-xs text-[#9aa8a0]">
                <Loader2 className="w-5 h-5 animate-spin text-[#8e96e8]" />
                <span>Đang kết nối Discord API tải danh sách nhiệm vụ...</span>
              </div>
            ) : filteredQuests.length === 0 ? (
              <EmptyState
                title={quests.length === 0 ? 'Tài khoản chưa có nhiệm vụ nào' : 'Không có nhiệm vụ phù hợp'}
                description={
                  quests.length === 0
                    ? 'Discord chưa mở nhiệm vụ cho tài khoản này lúc này. Bạn thử tải lại sau nhé.'
                    : 'Thử chọn bộ lọc khác hoặc kiểm tra mục "Đang mở".'
                }
              />
            ) : (
              <div role="list" className="divide-y divide-[#2d3b33]">
                {filteredQuests.map((quest) => {
                  const activeJob = jobs.get(quest.id);
                  const isRunning = isJobActive(activeJob);
                  const progress = activeJob ? activeJob.progressPercent : quest.task.progressPercent;
                  const isCompleted = quest.status.completed || activeJob?.status === 'completed';
                  const isExpired = isQuestExpired(quest);
                  const isVideo = quest.task.type.includes('VIDEO');
                  const expiry = formatExpiresAt(quest.status.expiresAt);

                  return (
                    <div
                      role="listitem"
                      key={quest.id}
                      className={`px-5 py-3.5 grid grid-cols-[minmax(280px,3fr)_95px_minmax(120px,1.5fr)_110px_minmax(140px,1.8fr)_125px] gap-4 items-center hover:bg-[#212c27]/40 transition-colors ${
                        isRunning ? 'bg-[#212c27] border-l-2 border-[#8e96e8]' : ''
                      }`}
                    >
                      {/* Cột 1: NHIỆM VỤ */}
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            quest.application.iconUrl ||
                            quest.rewards.assetUrl ||
                            'https://cdn.discordapp.com/embed/avatars/0.png'
                          }
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover bg-[#161e1a] shrink-0 border border-[#2d3b33]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#f2f5f1] truncate" title={quest.name}>
                            {quest.name}
                          </p>
                          <p
                            className={`text-xs truncate ${
                              isRunning ? 'text-[#8e96e8] font-medium' : 'text-[#9aa8a0]'
                            }`}
                          >
                            {isRunning && activeJob?.message ? activeJob.message : quest.application.name}
                          </p>
                        </div>
                      </div>

                      {/* Cột 2: LOẠI */}
                      <div className="text-xs text-[#9aa8a0] flex items-center gap-1.5">
                        {isVideo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#8e96e8]/15 text-[#8e96e8] border border-[#8e96e8]/30 font-medium">
                            <Video className="w-3 h-3 text-[#8e96e8]" />
                            <span>Video</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#72b991]/15 text-[#72b991] border border-[#72b991]/30 font-medium">
                            <Gamepad2 className="w-3 h-3 text-[#72b991]" />
                            <span>Game</span>
                          </span>
                        )}
                      </div>

                      {/* Cột 3: PHẦN THƯỞNG */}
                      <div className="text-xs font-medium truncate text-[#f2f5f1]" title={quest.rewards.name}>
                        🎁 {quest.rewards.name || '200 Orbs'}
                      </div>

                      {/* Cột 4: THỜI HẠN */}
                      <div className={`text-xs ${expiry?.tone || 'text-[#9aa8a0]'}`}>
                        {expiry?.label || '—'}
                      </div>

                      {/* Cột 5: TIẾN ĐỘ */}
                      <div className="flex items-center gap-2.5">
                        <ProgressBar
                          value={progress}
                          tone={isCompleted ? 'ok' : isRunning ? 'brand' : 'idle'}
                          label={`Tiến độ ${quest.name}`}
                        />
                        <span
                          className={`w-9 text-right text-xs font-mono tabular-nums ${
                            isRunning ? 'text-[#8e96e8] font-bold' : 'text-[#9aa8a0]'
                          }`}
                        >
                          {progress.toFixed(0)}%
                        </span>
                      </div>

                      {/* Cột 6: THAO TÁC */}
                      <div className="flex justify-end">
                        {renderAction(quest, isRunning, isCompleted, isExpired)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Discord Quests ✨"
        description="Đồng bộ danh sách nhiệm vụ từ Discord, tự động cày video và game nhận quà tặng, avatar và khung viền độc quyền."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#1a231f] border border-[#2d3b33] text-xs font-semibold text-[#8e96e8]">
              <Sparkles className="w-3.5 h-3.5 text-[#8e96e8]" />
              <span>{counts.available} đang mở ({counts.all} tổng)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#1a231f] border border-[#2d3b33] text-xs font-semibold text-[#72b991]">
              <span className="w-2 h-2 rounded-full bg-[#72b991] animate-pulse" />
              <span>{runningJobs.length} đang chạy</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#1a231f] border border-[#2d3b33] text-xs font-semibold text-[#f2f5f1]">
              <Check className="w-3.5 h-3.5 text-[#72b991]" />
              <span>{counts.completed} hoàn thành</span>
            </span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || !effectiveToken}
              className="btn-secondary btn-sm"
              title="Tải lại danh sách từ Discord"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            {runningJobs.length > 0 && (
              <button
                type="button"
                onClick={handleStopAll}
                disabled={actionLoading.all}
                className="btn-danger btn-sm"
              >
                Dừng tất cả ({runningJobs.length})
              </button>
            )}

            <button
              type="button"
              onClick={handleStartAll}
              disabled={actionLoading.all || counts.available === 0 || !effectiveToken}
              className="btn-primary btn-sm px-4"
            >
              {actionLoading.all ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>Chạy toàn bộ Quests 🚀</span>
            </button>
          </>
        }
      />

      {/* Token Setup Card */}
      <form onSubmit={handleSaveOneToken} className="surface p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2d3b33] pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#8e96e8]" />
            <h2 className="text-sm font-bold text-[#f2f5f1]">
              Cấu hình 1 Token Discord cho Quests
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#9aa8a0]">
              <StatusDot tone={effectiveToken ? 'ok' : 'warn'} />
              {effectiveToken ? 'ĐÃ CÓ 1 TOKEN' : 'YÊU CẦU 1 TOKEN'}
            </span>
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="btn-ghost btn-sm"
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showToken ? 'Ẩn' : 'Hiện'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type={showToken ? 'text' : 'password'}
            value={questTokenInput}
            onChange={(e) => setQuestTokenInput(e.target.value)}
            placeholder="Dán Discord User Token của tài khoản cần cày Quests..."
            className="input font-mono flex-1 text-xs"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={savingToken || !questTokenInput.trim()}
            className="btn-primary shrink-0 px-5 text-xs font-semibold"
          >
            {savingToken ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Lưu &amp; Tải Quests ✨</span>
          </button>
        </div>
      </form>

      {/* VIEW CONTROLS & FILTERS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Lọc nhiệm vụ"
          value={filterType}
          onChange={setFilterType}
          options={[
            { value: 'available', label: 'Đang mở', count: counts.available },
            { value: 'running', label: 'Đang chạy', count: counts.running },
            { value: 'video', label: 'Video', count: counts.video },
            { value: 'game', label: 'Game', count: counts.game },
            { value: 'completed', label: 'Hoàn thành', count: counts.completed },
            { value: 'expired', label: 'Đã hết hạn', count: counts.expired },
            { value: 'all', label: 'Tất cả', count: counts.all },
          ]}
        />

        {/* View Mode Switcher + Search */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center p-1 rounded-lg bg-[#1a231f] border border-[#2d3b33] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#8e96e8] text-[#111714] font-semibold'
                  : 'text-[#9aa8a0] hover:text-[#f2f5f1]'
              }`}
              title="Xem dạng Bảng chi tiết"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bảng</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('live')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'live'
                  ? 'bg-[#8e96e8] text-[#111714] font-semibold'
                  : 'text-[#9aa8a0] hover:text-[#f2f5f1]'
              }`}
              title="Không gian hoạt động LIVE"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>LIVE</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'split'
                  ? 'bg-[#8e96e8] text-[#111714] font-semibold'
                  : 'text-[#9aa8a0] hover:text-[#f2f5f1]'
              }`}
              title="Xem song song cả hai"
            >
              <Split className="w-3.5 h-3.5" />
              <span>Song song</span>
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-[#9aa8a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm nhiệm vụ..."
              aria-label="Tìm nhiệm vụ"
              className="input pl-9 text-xs w-full py-1.5"
            />
          </div>
        </div>
      </div>

      {/* MAIN VIEW CONTENT */}
      {viewMode === 'table' && renderQuestsTable()}

      {viewMode === 'live' && renderLiveActivitySpace()}

      {viewMode === 'split' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
          <div className="min-w-0 overflow-x-auto">
            {renderQuestsTable()}
          </div>
          <div className="sticky top-20">
            {renderLiveActivitySpace()}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestDashboard;
