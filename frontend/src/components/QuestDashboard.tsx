import React, { useMemo, useState } from 'react';
import { Check, Gamepad2, Loader2, Play, RefreshCw, Search, Square, Video } from 'lucide-react';
import { AuthUser, PlanTierId, QuestDTO, QuestJob, UserSubscription } from '../types';
import { questApi } from '../services/api';
import { AccessGateBanner } from './SubscriptionModal';
import { useToast } from './Toast';
import { EmptyState, PageHeader, ProgressBar, SegmentedControl } from './ui';

interface QuestDashboardProps {
  user?: AuthUser | null;
  subscription?: UserSubscription | null;
  token?: string;
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
  if (diffMs <= 0) return { label: 'Đã hết hạn', tone: 'text-rose-400' };
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) {
    return { label: `Còn ${diffDays} ngày`, tone: diffDays <= 2 ? 'text-amber-400' : 'text-zinc-400' };
  }
  return { label: `Còn ${Math.max(1, diffHours)} giờ`, tone: 'text-amber-400' };
};

export const QuestDashboard: React.FC<QuestDashboardProps> = ({
  user = null,
  subscription = null,
  token,
  quests,
  jobs,
  loading,
  onRefresh,
  onOpenLoginModal,
  onOpenSubscriptionModal,
}) => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<QuestFilter>('all');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

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

  const withLoading = async (key: string, fn: () => Promise<void>) => {
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await fn();
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const requireToken = (message: string) => {
    if (!token || !user) {
      toast.warning(message);
      onOpenLoginModal();
      return false;
    }
    if (!subscription || !subscription.botConnected) {
      toast.warning('Vui lòng mua và kích hoạt gói dịch vụ để sử dụng Bot chạy nhiệm vụ');
      onOpenSubscriptionModal('pro');
      return false;
    }
    return true;
  };

  const handleStartQuest = (questId: string) => {
    if (!requireToken('Vui lòng kết nối Discord User Token trước khi bắt đầu')) return;
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
    if (!requireToken('Vui lòng kết nối Discord User Token trước khi nhận quest')) return;
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
    if (!requireToken('Vui lòng kết nối Discord User Token trước khi chạy')) return;
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
      const matchSearch = q.name.toLowerCase().includes(term) || q.application.name.toLowerCase().includes(term);
      if (!matchSearch) return false;
      if (filterType === 'running') return isJobActive(jobs.get(q.id));
      if (filterType === 'enrolled') return !q.status.enrolled && !q.status.completed;
      if (filterType === 'completed') return q.status.completed;
      if (filterType === 'video') return q.task.type.includes('VIDEO');
      if (filterType === 'game') return !q.task.type.includes('VIDEO');
      return true;
    });
  }, [quests, jobs, search, filterType]);

  if (!token) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Nhiệm vụ Discord"
          description="Tự động nhận, mô phỏng heartbeat và nhận thưởng Discord Quests mà không cần cài game."
        />
        <AccessGateBanner
          user={user}
          subscription={subscription}
          onOpenLoginModal={onOpenLoginModal}
          onOpenSubscriptionModal={onOpenSubscriptionModal}
          featureName="Discord Quests"
        />
      </div>
    );
  }

  const renderAction = (quest: QuestDTO, isRunning: boolean, isCompleted: boolean) => {
    const isLoading = actionLoading[quest.id];
    const spinner = <Loader2 className="w-3.5 h-3.5 animate-spin" />;

    if (isCompleted) {
      if (quest.status.claimed) {
        return (
          <span className="inline-flex items-center gap-1.5 h-8 text-[13px] text-emerald-400">
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
          className="btn h-8 px-3 bg-amber-400 text-black hover:bg-amber-300"
        >
          {isLoading && spinner}
          Nhận thưởng
        </button>
      );
    }
    if (isRunning) {
      return (
        <button type="button" onClick={() => handleStopQuest(quest.id)} disabled={isLoading} className="btn-danger h-8 px-3">
          {isLoading ? spinner : <Square className="w-3 h-3 fill-current" />}
          Dừng
        </button>
      );
    }
    if (!quest.status.enrolled) {
      return (
        <button type="button" onClick={() => handleEnrollQuest(quest.id)} disabled={isLoading} className="btn-secondary h-8 px-3">
          {isLoading && spinner}
          Nhận và chạy
        </button>
      );
    }
    return (
      <button type="button" onClick={() => handleStartQuest(quest.id)} disabled={isLoading} className="btn-primary h-8 px-3">
        {isLoading ? spinner : <Play className="w-3 h-3 fill-current" />}
        Bắt đầu
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhiệm vụ Discord"
        description="Tự động nhận, mô phỏng heartbeat và nhận thưởng Discord Quests mà không cần cài game."
        meta={
          <>
            <span>
              <span className="text-zinc-200 tabular-nums">{counts.all}</span> nhiệm vụ
            </span>
            <span>
              <span className="text-brand-text tabular-nums">{runningJobs.length}</span> đang chạy
            </span>
            <span>
              <span className="text-emerald-400 tabular-nums">{counts.completed}</span> hoàn thành
            </span>
            {counts.claimable > 0 && (
              <span>
                <span className="text-amber-400 tabular-nums">{counts.claimable}</span> chờ nhận thưởng
              </span>
            )}
          </>
        }
        actions={
          <>
            <button type="button" onClick={onRefresh} disabled={loading} className="btn-ghost" title="Tải lại danh sách từ Discord">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            {runningJobs.length > 0 && (
              <button type="button" onClick={handleStopAll} disabled={actionLoading.all} className="btn-danger">
                Dừng tất cả ({runningJobs.length})
              </button>
            )}
            <button type="button" onClick={handleStartAll} disabled={actionLoading.all || quests.length === 0} className="btn-primary">
              {actionLoading.all ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              Chạy tất cả
            </button>
          </>
        }
      />

      <AccessGateBanner
        user={user}
        subscription={subscription}
        onOpenLoginModal={onOpenLoginModal}
        onOpenSubscriptionModal={onOpenSubscriptionModal}
        featureName="Discord Quests"
      />

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
          <Search className="w-4 h-4 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
        <div className="hidden lg:grid grid-cols-[minmax(0,2.4fr)_80px_minmax(0,1.5fr)_104px_150px_132px] gap-4 px-4 h-9 items-center border-b border-line text-2xs font-medium uppercase tracking-[0.06em] text-zinc-500">
          <span>Nhiệm vụ</span>
          <span>Loại</span>
          <span>Phần thưởng</span>
          <span>Thời hạn</span>
          <span>Tiến độ</span>
          <span className="text-right">Thao tác</span>
        </div>

        {loading && quests.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-[13px] text-zinc-500">
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
          <ul className="divide-y divide-line">
            {filteredQuests.map((quest) => {
              const activeJob = jobs.get(quest.id);
              const isRunning = isJobActive(activeJob);
              const progress = activeJob ? activeJob.progressPercent : quest.task.progressPercent;
              const isCompleted = quest.status.completed || activeJob?.status === 'completed';
              const isVideo = quest.task.type.includes('VIDEO');
              const expiry = formatExpiresAt(quest.status.expiresAt);

              return (
                <li
                  key={quest.id}
                  className={`px-4 py-3.5 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,2.4fr)_80px_minmax(0,1.5fr)_104px_150px_132px] lg:gap-4 lg:items-center ${
                    isRunning ? 'bg-brand/[0.05]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={quest.application.iconUrl || quest.rewards.assetUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                      alt=""
                      className="w-9 h-9 rounded-md object-cover bg-white/[0.04] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{quest.name}</p>
                      <p className={`text-xs truncate ${isRunning ? 'text-brand-text' : 'text-zinc-500'}`}>
                        {isRunning && activeJob?.message ? activeJob.message : quest.application.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs lg:contents">
                    <span className="inline-flex items-center gap-1.5 text-zinc-400">
                      {isVideo ? <Video className="w-3.5 h-3.5" /> : <Gamepad2 className="w-3.5 h-3.5" />}
                      {isVideo ? 'Video' : 'Game'}
                    </span>
                    <span className="text-zinc-300 truncate lg:text-[13px]" title={quest.rewards.name}>
                      {quest.rewards.name}
                    </span>
                    <span className={expiry?.tone || 'text-zinc-600'}>{expiry?.label || '—'}</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <ProgressBar
                      value={progress}
                      tone={isCompleted ? 'ok' : isRunning ? 'brand' : 'idle'}
                      label={`Tiến độ ${quest.name}`}
                    />
                    <span className={`w-9 text-right text-xs tabular-nums ${isRunning ? 'text-brand-text' : 'text-zinc-400'}`}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex lg:justify-end">{renderAction(quest, isRunning, isCompleted)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default QuestDashboard;
