import React, { useState, useMemo } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Gift,
  Gamepad2,
  Video,
  CheckCircle2,
  Loader2,
  Search,
  Lock,
  Check,
  Clock,
  Sparkles,
} from 'lucide-react';
import { QuestDTO, QuestJob } from '../types';
import { questApi } from '../services/api';
import { useToast } from './Toast';

interface QuestDashboardProps {
  token?: string;
  quests: QuestDTO[];
  jobs: Map<string, QuestJob>;
  loading: boolean;
  onRefresh: () => void;
  onOpenLoginModal: () => void;
}

export const QuestDashboard: React.FC<QuestDashboardProps> = ({
  token,
  quests,
  jobs,
  loading,
  onRefresh,
  onOpenLoginModal,
}) => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'running' | 'enrolled' | 'completed' | 'video' | 'game'>('all');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const totalQuests = quests.length;
  const completedQuests = quests.filter((q) => q.status.completed).length;
  const claimableQuests = quests.filter((q) => q.status.completed && !q.status.claimed).length;
  const runningJobs = Array.from(jobs.values()).filter(
    (j) => j.status === 'running' || j.status === 'enrolling',
  );

  const formatExpiresAt = (dateStr?: string) => {
    if (!dateStr) return null;
    const target = new Date(dateStr).getTime();
    if (isNaN(target)) return null;
    const now = Date.now();
    const diffMs = target - now;
    if (diffMs <= 0) return { label: 'Đã hết hạn', isExpired: true, isUrgent: true };
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) {
      return {
        label: `Còn ${diffDays} ngày`,
        isExpired: false,
        isUrgent: diffDays <= 2,
      };
    }
    return {
      label: `Còn ${Math.max(1, diffHours)} giờ`,
      isExpired: false,
      isUrgent: true,
    };
  };

  const handleStartQuest = async (questId: string) => {
    if (!token) {
      toast.warning('Vui lòng kết nối Discord User Token trước khi bắt đầu');
      return onOpenLoginModal();
    }
    setActionLoading((prev) => ({ ...prev, [questId]: true }));
    try {
      await questApi.startQuest(token, questId);
      toast.success('Đã gửi yêu cầu khởi chạy nhiệm vụ');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi khi bắt đầu quest: ${err?.message || err}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [questId]: false }));
    }
  };

  const handleStopQuest = async (questId: string) => {
    if (!token) return;
    setActionLoading((prev) => ({ ...prev, [questId]: true }));
    try {
      await questApi.stopQuest(token, questId);
      toast.info('Đã gửi yêu cầu dừng nhiệm vụ');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi khi dừng quest: ${err?.message || err}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [questId]: false }));
    }
  };

  const handleEnrollQuest = async (questId: string) => {
    if (!token) {
      toast.warning('Vui lòng kết nối Discord User Token trước khi nhận quest');
      return onOpenLoginModal();
    }
    setActionLoading((prev) => ({ ...prev, [questId]: true }));
    try {
      await questApi.enrollQuest(token, questId);
      toast.success('Đã nhận nhiệm vụ thành công');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi khi nhận quest: ${err?.message || err}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [questId]: false }));
    }
  };

  const handleStartAll = async () => {
    if (!token) {
      toast.warning('Vui lòng kết nối Discord User Token trước khi chạy');
      return onOpenLoginModal();
    }
    setActionLoading((prev) => ({ ...prev, all: true }));
    try {
      await questApi.startAllQuests(token);
      toast.success('Đã kích hoạt toàn bộ nhiệm vụ đủ điều kiện');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi khi bắt đầu tất cả: ${err?.message || err}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, all: false }));
    }
  };

  const handleStopAll = async () => {
    if (!token) return;
    setActionLoading((prev) => ({ ...prev, all: true }));
    try {
      await questApi.stopAllQuests(token);
      toast.info('Đã dừng toàn bộ nhiệm vụ đang chạy');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi khi dừng tất cả: ${err?.message || err}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, all: false }));
    }
  };

  const handleClaim = async (questId: string) => {
    if (!token) return;
    setActionLoading((prev) => ({ ...prev, [questId]: true }));
    try {
      await questApi.claimReward(token, questId);
      toast.success('Đã gửi yêu cầu nhận phần thưởng thành công!');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi nhận thưởng: ${err?.message || err}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [questId]: false }));
    }
  };

  const filteredQuests = useMemo(() => {
    return quests.filter((q) => {
      const matchSearch =
        q.name.toLowerCase().includes(search.toLowerCase()) ||
        q.application.name.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      const activeJob = jobs.get(q.id);
      const isRunning = activeJob?.status === 'running' || activeJob?.status === 'enrolling';
      if (filterType === 'running') return isRunning;
      if (filterType === 'enrolled') return !q.status.enrolled && !q.status.completed;
      if (filterType === 'completed') return q.status.completed;
      if (filterType === 'video') return q.task.type.includes('VIDEO');
      if (filterType === 'game') return !q.task.type.includes('VIDEO');
      return true;
    });
  }, [quests, jobs, search, filterType]);

  if (!token) {
    return (
      <div className="panel p-10 sm:p-12 text-center max-w-lg mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-surface-2 border border-white/[0.08] flex items-center justify-center mx-auto text-indigo-400">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Yêu Cầu Kết Nối Token</h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Để truy cập và đồng bộ danh sách Discord Quests, vui lòng kết nối tài khoản bằng Discord User Token của bạn.
          </p>
        </div>
        <button
          onClick={onOpenLoginModal}
          className="btn-primary py-2.5 px-5 text-xs mx-auto"
        >
          <span>Nhập Token Discord</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-surface-1 p-5 sm:p-6 shadow-panel">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.08] via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                Nhiệm Vụ Discord
              </h1>
              <span className="text-slate-600 font-light select-none text-xl">/</span>
              <span className="text-sm sm:text-base font-normal text-indigo-400">
                Tự Động Nhận Thưởng &amp; Cày Quests Không Cần Game
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2 text-slate-400 border border-white/[0.06] ml-1">
                Port :3001
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Tự động enroll, mô phỏng heartbeat xem video hoặc chạy ngầm game và claim quà tặng về tài khoản.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="btn-secondary"
              title="Tải lại danh sách từ Discord"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm Mới</span>
            </button>

            {runningJobs.length > 0 && (
              <button
                onClick={handleStopAll}
                disabled={actionLoading.all}
                className="btn-danger"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Dừng Tất Cả ({runningJobs.length})</span>
              </button>
            )}

            <button
              onClick={handleStartAll}
              disabled={actionLoading.all || quests.length === 0}
              className="btn-primary"
            >
              {actionLoading.all ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Bắt Đầu Tất Cả</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="panel p-4">
          <p className="text-[11px] font-medium text-slate-400">Tổng Số Nhiệm Vụ</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{totalQuests}</p>
        </div>

        <div className="panel p-4">
          <p className="text-[11px] font-medium text-slate-400">Đang Thực Thi</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-indigo-400">{runningJobs.length}</span>
            {runningJobs.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            )}
          </div>
        </div>

        <div className="panel p-4">
          <p className="text-[11px] font-medium text-slate-400">Đã Hoàn Thành</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{completedQuests}</p>
        </div>

        <div className="panel p-4">
          <p className="text-[11px] font-medium text-slate-400">Chờ Nhận Thưởng</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{claimableQuests}</p>
        </div>
      </div>

      <div className="panel p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên quest hoặc ứng dụng..."
            className="w-full bg-surface-2 border border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(
            [
              ['all', 'Tất Cả'],
              ['running', 'Đang Chạy'],
              ['enrolled', 'Chưa Nhận'],
              ['completed', 'Đã Xong'],
              ['video', 'Video'],
              ['game', 'Game'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                filterType === key
                  ? 'bg-surface-3 text-slate-100 border border-white/[0.1] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {runningJobs.length > 0 && (
        <div className="panel p-4 space-y-3 border-indigo-500/30">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
              Tiến Độ Tác Vụ Đang Chạy Thời Gian Thực
            </span>
            <span className="text-slate-500 font-mono">{runningJobs.length} tiến trình</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {runningJobs.map((job) => (
              <div key={job.questId} className="panel-subtle p-3 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-100 truncate">{job.questName}</span>
                  <button
                    onClick={() => handleStopQuest(job.questId)}
                    disabled={actionLoading[job.questId]}
                    className="btn-danger py-0.5 px-2 text-[10px]"
                  >
                    Dừng
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>{job.message}</span>
                    <span className="text-indigo-400 font-semibold">{job.progressPercent.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-surface-0 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, job.progressPercent))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && quests.length === 0 ? (
        <div className="panel p-12 text-center space-y-3">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Đang tải danh sách nhiệm vụ từ Discord API...</p>
        </div>
      ) : filteredQuests.length === 0 ? (
        <div className="panel p-12 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">Không Tìm Thấy Quest Phù Hợp</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Không có nhiệm vụ nào khớp với bộ lọc &quot;{filterType}&quot;. Hãy chọn &quot;Tất Cả&quot; hoặc tải lại danh sách.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuests.map((quest) => {
            const activeJob = jobs.get(quest.id);
            const isRunning = activeJob?.status === 'running' || activeJob?.status === 'enrolling';
            const progress = activeJob ? activeJob.progressPercent : quest.task.progressPercent;
            const isCompleted = quest.status.completed || activeJob?.status === 'completed';
            const isLoading = actionLoading[quest.id];
            const isVideo = quest.task.type.includes('VIDEO');
            const expiry = formatExpiresAt(quest.status.expiresAt);

            return (
              <div
                key={quest.id}
                className={`panel p-4 flex flex-col justify-between space-y-4 transition-colors ${
                  isRunning
                    ? 'border-indigo-500/50 bg-[#101422]'
                    : isCompleted
                    ? 'border-emerald-500/30'
                    : 'hover:border-white/[0.12]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={
                        quest.application.iconUrl ||
                        quest.rewards.assetUrl ||
                        'https://cdn.discordapp.com/embed/avatars/0.png'
                      }
                      alt={quest.name}
                      className="w-10 h-10 rounded-lg object-cover bg-surface-2 border border-white/[0.08] shrink-0"
                    />
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-100 truncate">{quest.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{quest.application.name}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-slate-300 border border-white/[0.06] flex items-center gap-1">
                        {isVideo ? <Video className="w-3 h-3 text-sky-400" /> : <Gamepad2 className="w-3 h-3 text-purple-400" />}
                        <span>{isVideo ? 'Video' : 'Game'}</span>
                      </span>

                      {expiry && (
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                            expiry.isExpired
                              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                              : expiry.isUrgent
                              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                              : 'text-slate-400 bg-surface-2 border-white/[0.06]'
                          }`}
                          title={`Hạn chót: ${quest.status.expiresAt}`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{expiry.label}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Tiến độ</span>
                      <span className={isRunning ? 'text-indigo-400 font-semibold' : 'text-slate-200 font-medium'}>
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-400'
                            : isRunning
                            ? 'bg-indigo-500'
                            : 'bg-slate-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                    <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{quest.rewards.name}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  {isCompleted ? (
                    quest.status.claimed ? (
                      <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đã nhận phần thưởng
                      </span>
                    ) : (
                      <button
                        onClick={() => handleClaim(quest.id)}
                        disabled={isLoading}
                        className="w-full btn-primary bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs py-1.5"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                        <span>Nhận Thưởng Ngay</span>
                      </button>
                    )
                  ) : isRunning ? (
                    <button
                      onClick={() => handleStopQuest(quest.id)}
                      disabled={isLoading}
                      className="w-full btn-danger py-1.5 text-xs"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
                      <span>Dừng Nhiệm Vụ</span>
                    </button>
                  ) : !quest.status.enrolled ? (
                    <button
                      onClick={() => handleEnrollQuest(quest.id)}
                      disabled={isLoading}
                      className="w-full btn-secondary py-1.5 text-xs"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>Nhận &amp; Bắt Đầu</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartQuest(quest.id)}
                      disabled={isLoading}
                      className="w-full btn-primary py-1.5 text-xs"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>Bắt Đầu Làm</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuestDashboard;
