import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Gamepad2,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Square,
  Video,
} from 'lucide-react';
import { AccountTokens, AuthUser, PlanTierId, QuestDTO, QuestJob, UserSubscription } from '../types';
import { questApi } from '../services/api';
import { useToast } from './Toast';
import { EmptyState, PageHeader, ProgressBar, SegmentedControl, StatusDot } from './ui';

interface QuestDashboardProps {
  user?: AuthUser | null;
  subscription?: UserSubscription | null;
  sessionToken?: string;
  token?: string;
  onSaveQuestToken?: (newToken: string, updatedTokens?: Partial<AccountTokens>) => void;
  quests: QuestDTO[];
  jobs: Map<string, QuestJob>;
  loading: boolean;
  onRefresh: () => void;
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal: (planId?: PlanTierId) => void;
}

type QuestFilter = 'all' | 'running' | 'enrolled' | 'completed' | 'video' | 'game';

const isJobActive = (job?: QuestJob) => job?.status === 'running' || job?.status === 'enrolling';

const formatExpiresAt = (dateStr?: string) => {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return null;
  const diffMs = target - Date.now();
  if (diffMs <= 0) return { label: 'Đã hết hạn', tone: 'text-rose-300' };
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) {
    return { label: `Còn ${diffDays} ngày`, tone: diffDays <= 2 ? 'text-blue-300' : 'text-slate-300' };
  }
  return { label: `Còn ${Math.max(1, diffHours)} giờ`, tone: 'text-blue-300' };
};

export const QuestDashboard: React.FC<QuestDashboardProps> = ({
  user = null,
  subscription = null,
  sessionToken = '',
  token = '',
  onSaveQuestToken,
  quests,
  jobs,
  loading,
  onRefresh,
  onOpenLoginModal,
  onOpenSubscriptionModal,
}) => {
  const { toast } = useToast();
  const [questTokenInput, setQuestTokenInput] = useState(token || user?.tokens?.questToken || '');
  const [showToken, setShowToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<QuestFilter>('all');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (token) {
      setQuestTokenInput(token);
    } else if (user?.tokens?.questToken) {
      setQuestTokenInput(user.tokens.questToken);
    }
  }, [token, user?.tokens?.questToken]);

  const runningJobs = Array.from(jobs.values()).filter((j) => isJobActive(j));

  const counts = useMemo(
    () => ({
      all: quests.length,
      running: quests.filter((q) => isJobActive(jobs.get(q.id))).length,
      enrolled: quests.filter((q) => !q.status.enrolled && !q.status.completed).length,
      completed: quests.filter((q) => q.status.completed).length,
      claimable: quests.filter((q) => q.status.completed && !q.status.claimed).length,
      video: quests.filter((q) => q.task.type.includes('VIDEO')).length,
      game: quests.filter((q) => !q.task.type.includes('VIDEO')).length,
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
      toast.success('Đã xác thực & lưu 1 Token Discord cho Quests vào Database');
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

  const requireToken = (message: string) => {
    if (!user) {
      toast.warning('Vui lòng đăng nhập OAuth2 trước');
      onOpenLoginModal();
      return false;
    }
    if (!subscription || subscription.isActive === false) {
      toast.warning('Vui lòng kích hoạt gói 50.000đ/tháng để sử dụng Discord Quests');
      onOpenSubscriptionModal('monthly_50k');
      return false;
    }
    if (!token) {
      toast.warning(message);
      return false;
    }
    return true;
  };

  const handleStartQuest = (questId: string) => {
    if (!requireToken('Vui lòng nhập 1 Token Acc Discord ở khung phía trên trước khi bắt đầu')) return;
    withLoading(questId, async () => {
      try {
        await questApi.startQuest(token!, questId);
        toast.success('Đã gửi yêu cầu khởi chạy nhiệm vụ');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi bắt đầu quest: ${err?.message || err}`);
      }
    });
  };

  const handleStopQuest = (questId: string) => {
    if (!token) return;
    withLoading(questId, async () => {
      try {
        await questApi.stopQuest(token, questId);
        toast.info('Đã gửi yêu cầu dừng nhiệm vụ');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi dừng quest: ${err?.message || err}`);
      }
    });
  };

  const handleEnrollQuest = (questId: string) => {
    if (!requireToken('Vui lòng nhập 1 Token Acc Discord trước khi nhận quest')) return;
    withLoading(questId, async () => {
      try {
        await questApi.enrollQuest(token!, questId);
        toast.success('Đã nhận nhiệm vụ thành công');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi nhận quest: ${err?.message || err}`);
      }
    });
  };

  const handleStartAll = () => {
    if (!requireToken('Vui lòng nhập 1 Token Acc Discord trước khi chạy')) return;
    withLoading('all', async () => {
      try {
        await questApi.startAllQuests(token!);
        toast.success('Đã kích hoạt toàn bộ nhiệm vụ đủ điều kiện');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi bắt đầu tất cả: ${err?.message || err}`);
      }
    });
  };

  const handleStopAll = () => {
    if (!token) return;
    withLoading('all', async () => {
      try {
        await questApi.stopAllQuests(token);
        toast.info('Đã dừng toàn bộ nhiệm vụ đang chạy');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi khi dừng tất cả: ${err?.message || err}`);
      }
    });
  };

  const handleClaim = (questId: string) => {
    if (!token) return;
    withLoading(questId, async () => {
      try {
        await questApi.claimReward(token, questId);
        toast.success('Đã gửi yêu cầu nhận phần thưởng');
        onRefresh();
      } catch (err: any) {
        toast.error(`Lỗi nhận thưởng: ${err?.message || err}`);
      }
    });
  };

  const filteredQuests = useMemo(() => {
    const term = search.toLowerCase();
    return quests.filter((q) => {
      const matchSearch =
        q.name.toLowerCase().includes(term) || q.application.name.toLowerCase().includes(term);
      if (!matchSearch) return false;
      if (filterType === 'running') return isJobActive(jobs.get(q.id));
      if (filterType === 'enrolled') return !q.status.enrolled && !q.status.completed;
      if (filterType === 'completed') return q.status.completed;
      if (filterType === 'video') return q.task.type.includes('VIDEO');
      if (filterType === 'game') return !q.task.type.includes('VIDEO');
      return true;
    });
  }, [quests, jobs, search, filterType]);

  const renderAction = (quest: QuestDTO, isRunning: boolean, isCompleted: boolean) => {
    const isLoading = actionLoading[quest.id];
    const spinner = <Loader2 className="w-3.5 h-3.5 animate-spin" />;

    if (isCompleted) {
      if (quest.status.claimed) {
        return (
          <span className="inline-flex items-center gap-1.5 h-8 text-[13px] text-blue-300">
            <Check className="w-4 h-4" />
            Đã nhận
          </span>
        );
      }
      return (
        <button
          type="button"
          onClick={() => handleClaim(quest.id)}
          disabled={isLoading}
          className="btn-primary h-8 px-3"
        >
          {isLoading && spinner}
          Nhận thưởng
        </button>
      );
    }
    if (isRunning) {
      return (
        <button
          type="button"
          onClick={() => handleStopQuest(quest.id)}
          disabled={isLoading}
          className="btn-danger h-8 px-3"
        >
          {isLoading ? spinner : <Square className="w-3 h-3 fill-current" />}
          Dừng
        </button>
      );
    }
    if (!quest.status.enrolled) {
      return (
        <button
          type="button"
          onClick={() => handleEnrollQuest(quest.id)}
          disabled={isLoading}
          className="btn-secondary h-8 px-3"
        >
          {isLoading && spinner}
          Nhận và chạy
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => handleStartQuest(quest.id)}
        disabled={isLoading}
        className="btn-primary h-8 px-3"
      >
        {isLoading ? spinner : <Play className="w-3 h-3 fill-current" />}
        Bắt đầu
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discord Quests (Yêu cầu 1 Token)"
        description="Nhập 1 Token tài khoản Discord để đồng bộ, mô phỏng heartbeat 30s và tự động nhận thưởng Discord Quests."
        meta={
          <>
            <span>
              <span className="text-white tabular-nums">{counts.all}</span> nhiệm vụ
            </span>
            <span>
              <span className="text-blue-300 tabular-nums">{runningJobs.length}</span> đang chạy
            </span>
            <span>
              <span className="text-slate-200 tabular-nums">{counts.completed}</span> hoàn thành
            </span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || !token}
              className="btn-ghost"
              title="Tải lại danh sách từ Discord"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            {runningJobs.length > 0 && (
              <button
                type="button"
                onClick={handleStopAll}
                disabled={actionLoading.all}
                className="btn-danger"
              >
                Dừng tất cả ({runningJobs.length})
              </button>
            )}
            <button
              type="button"
              onClick={handleStartAll}
              disabled={actionLoading.all || quests.length === 0 || !token}
              className="btn-primary"
            >
              {actionLoading.all ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              Chạy tất cả
            </button>
          </>
        }
      />

      <form onSubmit={handleSaveOneToken} className="surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white">
              Cấu hình 1 Token Acc Discord (Dùng cho Discord Quests &amp; Giờ chơi)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-300">
              <StatusDot tone={token ? 'ok' : 'warn'} />
              {token ? 'ĐÃ KẾT NỐI 1 TOKEN' : 'CHƯA NHẬP TOKEN'}
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
            placeholder="Dán Discord User Token (Authorization header) của tài khoản cần làm Quest..."
            className="input font-mono flex-1"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={savingToken || !questTokenInput.trim()}
            className="btn-primary shrink-0"
          >
            {savingToken ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Lưu &amp; Tải Quests</span>
          </button>
        </div>
      </form>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Lọc nhiệm vụ"
          value={filterType}
          onChange={setFilterType}
          options={[
            { value: 'all', label: 'Tất cả', count: counts.all },
            { value: 'running', label: 'Đang chạy', count: counts.running },
            { value: 'enrolled', label: 'Chưa nhận', count: counts.enrolled },
            { value: 'completed', label: 'Hoàn thành', count: counts.completed },
            { value: 'video', label: 'Video', count: counts.video },
            { value: 'game', label: 'Game', count: counts.game },
          ]}
        />
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên nhiệm vụ hoặc game"
            aria-label="Tìm nhiệm vụ"
            className="input pl-8"
          />
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="hidden lg:grid grid-cols-[minmax(0,2.4fr)_80px_minmax(0,1.5fr)_104px_150px_132px] gap-4 px-4 h-9 items-center border-b border-line text-2xs font-medium uppercase tracking-[0.06em] text-slate-300">
          <span>Nhiệm vụ</span>
          <span>Loại</span>
          <span>Phần thưởng</span>
          <span>Thời hạn</span>
          <span>Tiến độ</span>
          <span className="text-right">Thao tác</span>
        </div>

        {!token ? (
          <EmptyState
            title="Chưa nhập Token tài khoản Discord"
            description="Vui lòng dán 1 Token Acc Discord vào ô cấu hình phía trên và bấm 'Lưu & Tải Quests'."
          />
        ) : loading && quests.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-[13px] text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin" />
            Đang tải danh sách nhiệm vụ từ Discord…
          </div>
        ) : filteredQuests.length === 0 ? (
          <EmptyState
            title={quests.length === 0 ? 'Tài khoản chưa có nhiệm vụ nào' : 'Không có nhiệm vụ phù hợp'}
            description={
              quests.length === 0
                ? 'Discord chưa cung cấp nhiệm vụ cho tài khoản này. Thử làm mới sau.'
                : 'Thử bộ lọc khác hoặc xóa từ khóa tìm kiếm.'
            }
          />
        ) : (
          <div role="list" className="divide-y divide-line">
            {filteredQuests.map((quest) => {
              const activeJob = jobs.get(quest.id);
              const isRunning = isJobActive(activeJob);
              const progress = activeJob ? activeJob.progressPercent : quest.task.progressPercent;
              const isCompleted = quest.status.completed || activeJob?.status === 'completed';
              const isVideo = quest.task.type.includes('VIDEO');
              const expiry = formatExpiresAt(quest.status.expiresAt);

              return (
                <div
                  role="listitem"
                  key={quest.id}
                  className={`px-4 py-3.5 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,2.4fr)_80px_minmax(0,1.5fr)_104px_150px_132px] lg:gap-4 lg:items-center ${
                    isRunning ? 'bg-blue-600/[0.06]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        quest.application.iconUrl ||
                        quest.rewards.assetUrl ||
                        'https://cdn.discordapp.com/embed/avatars/0.png'
                      }
                      alt=""
                      className="w-9 h-9 rounded-md object-cover bg-white/[0.04] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{quest.name}</p>
                      <p
                        className={`text-xs truncate ${
                          isRunning ? 'text-blue-300' : 'text-slate-300'
                        }`}
                      >
                        {isRunning && activeJob?.message
                          ? activeJob.message
                          : quest.application.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs lg:contents">
                    <span className="inline-flex items-center gap-1.5 text-slate-300">
                      {isVideo ? (
                        <Video className="w-3.5 h-3.5" />
                      ) : (
                        <Gamepad2 className="w-3.5 h-3.5" />
                      )}
                      {isVideo ? 'Video' : 'Game'}
                    </span>
                    <span
                      className="text-slate-200 truncate lg:text-[13px]"
                      title={quest.rewards.name}
                    >
                      {quest.rewards.name}
                    </span>
                    <span className={expiry?.tone || 'text-slate-300'}>
                      {expiry?.label || '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <ProgressBar
                      value={progress}
                      tone={isCompleted ? 'ok' : isRunning ? 'brand' : 'idle'}
                      label={`Tiến độ ${quest.name}`}
                    />
                    <span
                      className={`w-9 text-right text-xs tabular-nums ${
                        isRunning ? 'text-blue-300' : 'text-slate-300'
                      }`}
                    >
                      {progress.toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex lg:justify-end">
                    {renderAction(quest, isRunning, isCompleted)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestDashboard;
