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
  ArrowRight,
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
      <div className="py-20 text-center max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400 shadow-xl shadow-indigo-500/15">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Yêu Cầu Kết Nối Token</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Để đồng bộ và thực hiện các nhiệm vụ Discord Quests, vui lòng kết nối tài khoản bằng User Token của bạn.
          </p>
        </div>
        <button
          onClick={onOpenLoginModal}
          className="btn-primary py-3 px-6 text-xs mx-auto shadow-lg"
        >
          <span>Nhập Token Discord</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Nhiệm Vụ Discord
            </h1>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.08]">
              Port :3001
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Tự động kích hoạt, mô phỏng heartbeat và nhận phần thưởng Discord Quests mà không cần tải game.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="btn-secondary text-xs py-2 px-3.5"
            title="Tải lại danh sách từ Discord"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm Mới</span>
          </button>

          {runningJobs.length > 0 && (
            <button
              onClick={handleStopAll}
              disabled={actionLoading.all}
              className="btn-danger text-xs py-2 px-4"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Dừng Tất Cả ({runningJobs.length})</span>
            </button>
          )}

          <button
            onClick={handleStartAll}
            disabled={actionLoading.all || quests.length === 0}
            className="btn-primary text-xs py-2 px-4 shadow-md"
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

      <div className="glass-panel rounded-2xl p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
        <div className="px-2 pt-2 md:pt-0">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Tổng Số Nhiệm Vụ</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-white">{totalQuests}</span>
            <span className="text-xs font-mono text-slate-500">nhiệm vụ</span>
          </div>
        </div>

        <div className="px-2 pt-4 md:pt-0 md:pl-6">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Đang Thực Thi</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-indigo-400">{runningJobs.length}</span>
            {runningJobs.length > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
              </span>
            )}
          </div>
        </div>

        <div className="px-2 pt-4 md:pt-0 md:pl-6">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Đã Hoàn Thành</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-emerald-400">{completedQuests}</span>
            <span className="text-xs font-mono text-slate-500">xong</span>
          </div>
        </div>

        <div className="px-2 pt-4 md:pt-0 md:pl-6">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Chờ Nhận Thưởng</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-amber-400">{claimableQuests}</span>
            <span className="text-xs font-mono text-slate-500">chờ claim</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative min-w-[260px] sm:max-w-xs flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên quest hoặc ứng dụng..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filterType === key
                  ? 'bg-white/[0.1] text-white border border-white/[0.15] font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {runningJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-white flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
              </span>
              Tiến Độ Tác Vụ Đang Chạy
            </span>
            <span className="text-slate-500">{runningJobs.length} tiến trình</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runningJobs.map((job) => (
              <div key={job.questId} className="glass-panel rounded-2xl p-4 space-y-3 border-indigo-500/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{job.questName}</span>
                  <button
                    onClick={() => handleStopQuest(job.questId)}
                    disabled={actionLoading[job.questId]}
                    className="btn-danger py-1 px-2.5 text-[10px]"
                  >
                    Dừng
                  </button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>{job.message}</span>
                    <span className="text-indigo-400 font-bold">{job.progressPercent.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
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
        <div className="py-24 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Đang tải danh sách nhiệm vụ từ Discord API...</p>
        </div>
      ) : filteredQuests.length === 0 ? (
        <div className="py-20 text-center space-y-3 glass-panel rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">Không Tìm Thấy Quest Phù Hợp</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Không có nhiệm vụ nào khớp với bộ lọc &quot;{filterType}&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                className={`glass-panel rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all duration-200 ${
                  isRunning
                    ? 'border-indigo-500/40 bg-[#0E1222]/80 shadow-lg shadow-indigo-500/10'
                    : isCompleted
                    ? 'border-emerald-500/25'
                    : 'hover:border-white/[0.12]'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-3.5">
                    <img
                      src={
                        quest.application.iconUrl ||
                        quest.rewards.assetUrl ||
                        'https://cdn.discordapp.com/embed/avatars/0.png'
                      }
                      alt={quest.name}
                      className="w-12 h-12 rounded-xl object-cover bg-white/[0.04] border border-white/[0.08] shrink-0"
                    />
                    <div className="truncate flex-1">
                      <h3 className="text-sm font-bold text-white truncate">{quest.name}</h3>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{quest.application.name}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.06] flex items-center gap-1">
                        {isVideo ? <Video className="w-3 h-3 text-cyan-400" /> : <Gamepad2 className="w-3 h-3 text-violet-400" />}
                        <span>{isVideo ? 'Video' : 'Game'}</span>
                      </span>

                      {expiry && (
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                            expiry.isExpired
                              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                              : expiry.isUrgent
                              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                              : 'text-slate-400 bg-white/[0.04] border-white/[0.06]'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{expiry.label}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Tiến độ</span>
                      <span className={isRunning ? 'text-indigo-400 font-bold' : 'text-slate-200 font-semibold'}>
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-400'
                            : isRunning
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                            : 'bg-slate-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-slate-300 truncate">
                    <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">{quest.rewards.name}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06]">
                  {isCompleted ? (
                    quest.status.claimed ? (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5 py-2">
                        <Check className="w-4 h-4" /> Đã nhận phần thưởng
                      </span>
                    ) : (
                      <button
                        onClick={() => handleClaim(quest.id)}
                        disabled={isLoading}
                        className="w-full btn-primary bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs py-2.5 shadow-sm"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                        <span>Nhận Thưởng Ngay</span>
                      </button>
                    )
                  ) : isRunning ? (
                    <button
                      onClick={() => handleStopQuest(quest.id)}
                      disabled={isLoading}
                      className="w-full btn-danger py-2.5 text-xs"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
                      <span>Dừng Nhiệm Vụ</span>
                    </button>
                  ) : !quest.status.enrolled ? (
                    <button
                      onClick={() => handleEnrollQuest(quest.id)}
                      disabled={isLoading}
                      className="w-full btn-secondary py-2.5 text-xs"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>Nhận &amp; Bắt Đầu</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartQuest(quest.id)}
                      disabled={isLoading}
                      className="w-full btn-primary py-2.5 text-xs"
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
