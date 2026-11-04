import React, { useState } from 'react';
import {
  ArrowRight,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Terminal,
} from 'lucide-react';
import { AuthUser, PlanTierId, QuestDTO, QuestJob, LogEntry, StreamStatus, UserSubscription } from '../types';
import { questApi, streamApi } from '../services/api';
import { useToast } from './Toast';
import { NavTabId } from './Navbar';
import { PageHeader, ProgressBar, Section, StatusDot, Switch } from './ui';
import { formatPing, levelClass, levelLabel, parseLog } from '../utils/format';

interface DashboardOverviewProps {
  user?: AuthUser | null;
  subscription?: UserSubscription | null;
  token: string;
  questConnected: boolean;
  streamConnected: boolean;
  quests: QuestDTO[];
  jobs: Map<string, QuestJob>;
  loadingQuests: boolean;
  onRefreshQuests: () => void;
  streamStatus: StreamStatus | null;
  loadingStream: boolean;
  onRefreshStream: () => void;
  logs: LogEntry[];
  onNavigateTab: (tab: NavTabId) => void;
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal?: (planId?: PlanTierId) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  user,
  subscription = null,
  token,
  questConnected,
  streamConnected,
  quests,
  jobs,
  loadingQuests,
  onRefreshQuests,
  streamStatus,
  onRefreshStream,
  logs,
  onNavigateTab,
  onOpenSubscriptionModal = () => {},
}) => {
  const { toast } = useToast();
  const [streamInput, setStreamInput] = useState('');
  const [streamActionLoading, setStreamActionLoading] = useState(false);
  const [questActionLoading, setQuestActionLoading] = useState<Record<string, boolean>>({});

  const totalQuests = quests.length;
  const runningJobs = Array.from(jobs.values()).filter(
    (j) => j.status === 'running' || j.status === 'enrolling',
  );
  const completedQuests = quests.filter((q) => q.status.completed).length;
  const claimableQuests = quests.filter((q) => q.status.completed && !q.status.claimed).length;
  const streamPlaying = Boolean(streamStatus?.stream.playing);

  const hasQuestToken = Boolean(token || user?.tokens?.questToken);
  const hasStreamTokens = Boolean(
    (user?.tokens?.streamMainToken && user?.tokens?.streamViewerToken) ||
      (streamStatus?.config?.hasMainToken && streamStatus?.config?.hasViewerToken)
  );

  const handlePlayStream = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!hasStreamTokens) {
      toast.warning('Vui lòng vào mục Treo Stream Voice để nhập đủ 2 Token (1 Chính + 1 Phụ)');
      onNavigateTab('stream');
      return;
    }
    const query = streamInput.trim();
    if (!query) {
      toast.warning('Vui lòng nhập URL YouTube, Twitch hoặc tên file video');
      return;
    }
    setStreamActionLoading(true);
    try {
      await streamApi.playVideo(query);
      setStreamInput('');
      toast.success('Đã gửi yêu cầu phát video đến Voice Channel');
      onRefreshStream();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể phát video');
    } finally {
      setStreamActionLoading(false);
    }
  };

  const handleToggleFarm = async () => {
    if (!hasStreamTokens) {
      toast.warning('Vui lòng nhập 2 Token (1 Chính + 1 Phụ) trong mục Treo Stream trước');
      onNavigateTab('stream');
      return;
    }
    if (!streamStatus) return;
    const targetState = !streamStatus.farm.autoWatch;
    setStreamActionLoading(true);
    try {
      await streamApi.toggleFarm(targetState);
      toast.success(targetState ? 'Đã bật chế độ tự động xem kênh' : 'Đã tắt chế độ xem kênh');
      onRefreshStream();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể đổi trạng thái cày stream');
    } finally {
      setStreamActionLoading(false);
    }
  };

  const handleStartAll = async () => {
    if (!token) {
      toast.warning('Vui lòng nhập 1 Token Acc Discord trong mục Discord Quests');
      onNavigateTab('quests');
      return;
    }
    setQuestActionLoading((prev) => ({ ...prev, all: true }));
    try {
      const res = await questApi.startAllQuests(token);
      toast.success(`Đã kích hoạt ${res.startedCount || 0} nhiệm vụ`);
      onRefreshQuests();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể khởi động nhiệm vụ');
    } finally {
      setQuestActionLoading((prev) => ({ ...prev, all: false }));
    }
  };

  const handleStopAll = async () => {
    setQuestActionLoading((prev) => ({ ...prev, all: true }));
    try {
      await questApi.stopAllQuests(token);
      toast.info('Đã dừng toàn bộ nhiệm vụ đang chạy');
      onRefreshQuests();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi dừng tác vụ');
    } finally {
      setQuestActionLoading((prev) => ({ ...prev, all: false }));
    }
  };

  const handleStopJob = async (questId: string) => {
    setQuestActionLoading((prev) => ({ ...prev, [questId]: true }));
    try {
      await questApi.stopQuest(token, questId);
      toast.info('Đã dừng tác vụ');
      onRefreshQuests();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể dừng tác vụ');
    } finally {
      setQuestActionLoading((prev) => ({ ...prev, [questId]: false }));
    }
  };

  const recentLogs = logs.slice(-6).reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảng điều khiển cá nhân ✨"
        description={`Xin chào @${user?.username || 'bạn'}! Chúc bạn có những phút giây săn quà và giải trí thật vui vẻ nha 🌸`}
        meta={
          <>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#1a231f] border border-[#2d3b33] text-[#8e96e8] font-semibold text-xs">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <span>🌟</span>
              )}
              <span>@{user?.username || 'khách'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#72b991]/15 text-[#72b991] border border-[#72b991]/30 font-mono text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#72b991]" />
              Thành viên chính thức
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#9aa8a0]">
              <StatusDot tone={questConnected ? 'ok' : 'error'} />
              Quests {questConnected ? 'Sẵn sàng 🟢' : 'Ngoại tuyến 🔴'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#9aa8a0]">
              <StatusDot tone={streamConnected ? (streamPlaying ? 'ok' : 'ok') : 'warn'} />
              Stream {streamConnected ? (streamPlaying ? 'Đang phát 🎵' : 'Chờ lệnh 🟢') : 'Ngoại tuyến 🔴'}
            </span>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => {
              onRefreshQuests();
              onRefreshStream();
              toast.info('Đã làm mới dữ liệu thành công ✨');
            }}
            disabled={loadingQuests}
            className="btn-secondary btn-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingQuests ? 'animate-spin' : ''}`} />
            <span>Đồng bộ</span>
          </button>
        }
      />

      {/* 2 Khối tính năng cốt lõi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Khối Quests */}
        <div className="surface p-6 rounded-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <span>✨</span>
                <span>DISCORD QUESTS (1 TOKEN)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono text-white bg-white/[0.05]">
                <StatusDot tone={hasQuestToken ? 'ok' : 'warn'} />
                {hasQuestToken ? 'Đã sẵn sàng' : 'Chưa có Token'}
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Săn Quà Quests Tự Động 🎯
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Hệ thống tự động nhận và cày 100% nhiệm vụ game Discord để nhận avatar, khung và vật phẩm miễn phí.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-3 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 font-mono">
                🎉 {totalQuests} nhiệm vụ
              </span>
              {claimableQuests > 0 && (
                <span className="px-3 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-400 font-semibold">
                  🎁 {claimableQuests} quà chờ nhận!
                </span>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
            <div className="flex items-center gap-2">
              {!hasQuestToken ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab('quests')}
                  className="btn-primary flex-1"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Nhập 1 Token ngay ✨</span>
                </button>
              ) : runningJobs.length > 0 ? (
                <button
                  type="button"
                  onClick={handleStopAll}
                  disabled={questActionLoading.all}
                  className="btn-danger flex-1"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Dừng tất cả ({runningJobs.length})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartAll}
                  disabled={questActionLoading.all}
                  className="btn-primary flex-1"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Chạy toàn bộ Quests 🚀</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigateTab('quests')}
                className="btn-secondary text-xs px-3.5"
                title="Mở bảng chi tiết danh sách nhiệm vụ"
              >
                <span>Chi tiết</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Khối Stream Voice */}
        <div className="surface p-6 rounded-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <span>🎧</span>
                <span>TREO STREAM VOICE (2 TOKEN)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono text-white bg-white/[0.05]">
                <StatusDot tone={hasStreamTokens ? 'ok' : 'warn'} />
                {hasStreamTokens ? 'Đã sẵn sàng' : 'Cần 2 Token'}
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Phát Nhạc Voice &amp; Cày Giờ Xem 🎵
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Phát video YouTube/Twitch trực tiếp vào phòng thoại Discord cho bạn bè và cày giờ xem tài khoản phụ.
              </p>
            </div>

            <form onSubmit={handlePlayStream} className="flex gap-2 pt-1">
              <input
                type="text"
                value={streamInput}
                onChange={(e) => setStreamInput(e.target.value)}
                placeholder="Dán link YouTube, Twitch hoặc tên bài hát..."
                className="input flex-1 text-xs px-4"
              />
              <button
                type="submit"
                disabled={streamActionLoading || !streamInput.trim()}
                className="btn-primary shrink-0 px-4"
              >
                {streamActionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Phát</span>
              </button>
            </form>
          </div>

          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Switch
                checked={Boolean(streamStatus?.farm.autoWatch)}
                onChange={handleToggleFarm}
                disabled={streamActionLoading || !streamConnected}
                label="Bật cày giờ xem (Viewer Farm)"
              />
              <span className="text-xs text-slate-300">
                Tự động cày giờ xem
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('stream')}
              className="btn-ghost btn-sm text-xs text-pink-300 hover:text-pink-200 rounded-full"
            >
              <span>Cấu hình 2 Token</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="surface-interactive p-4 rounded-2xl border border-line/60">
          <p className="text-xs font-medium text-purple-300 flex items-center gap-1.5">
            <span>🎯</span> Nhiệm vụ có sẵn
          </p>
          <p className="mt-2 text-2xl font-bold text-white tabular-nums">{totalQuests}</p>
          <p className="mt-1 text-xs font-mono text-slate-400">Từ Discord Quests</p>
        </div>

        <div className="surface-interactive p-4 rounded-2xl border border-line/60">
          <p className="text-xs font-medium text-indigo-300 flex items-center gap-1.5">
            <span>⚡</span> Đang cày tự động
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-300 tabular-nums">{runningJobs.length}</span>
            {runningJobs.length > 0 && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
          </div>
          <p className="mt-1 text-xs font-mono text-slate-400">Tiến trình chạy ngầm</p>
        </div>

        <div className="surface-interactive p-4 rounded-2xl border border-line/60">
          <p className="text-xs font-medium text-pink-300 flex items-center gap-1.5">
            <span>🎁</span> Đã hoàn thành
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tabular-nums">{completedQuests}</span>
            {claimableQuests > 0 && (
              <span className="text-xs text-pink-300 tabular-nums font-semibold">({claimableQuests} quà chờ nhận ✨)</span>
            )}
          </div>
          <p className="mt-1 text-xs font-mono text-slate-400">Sẵn sàng nhận thưởng</p>
        </div>

        <div className="surface-interactive p-4 rounded-2xl border border-line/60">
          <p className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
            <span>🎧</span> Phòng Voice Bot
          </p>
          <p className="mt-2 text-sm font-bold text-white truncate">
            {streamPlaying ? 'Đang phát video 🎵' : streamConnected ? 'Đang chờ phát 🟢' : 'Ngoại tuyến 🔴'}
          </p>
          <p className="mt-1 text-xs text-slate-400 font-mono">
            {formatPing(streamConnected, streamStatus?.bot.ping)}
          </p>
        </div>
      </div>

      {runningJobs.length > 0 && (
        <Section
          title="Tiến trình đang chạy"
          description={`${runningJobs.length} nhiệm vụ đang gửi heartbeat đồng thời.`}
        >
          <div className="surface overflow-hidden divide-y divide-line">
            {runningJobs.map((job) => (
              <div
                key={job.questId}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusDot tone="brand" />
                    <p className="text-sm font-medium text-white truncate">{job.questName}</p>
                  </div>
                  <p className="text-xs text-slate-300 truncate">{job.message}</p>
                  <div className="w-full max-w-md pt-1.5 flex items-center gap-3">
                    <ProgressBar
                      value={job.progressPercent}
                      tone="brand"
                      label={`Tiến độ ${job.questName}`}
                    />
                    <span className="text-xs font-mono text-blue-300 tabular-nums shrink-0">
                      {job.progressPercent.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStopJob(job.questId)}
                  disabled={questActionLoading[job.questId]}
                  className="btn-danger btn-sm shrink-0"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Hủy tác vụ
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Khung mẹo sử dụng dành cho User */}
      <div className="surface p-5 space-y-3">
        <div className="flex items-center gap-2 text-[#8e96e8] font-semibold text-sm">
          <span>✨</span>
          <span>Mẹo nhỏ săn quà &amp; giải trí siêu tốc</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs divide-y md:divide-y-0 md:divide-x divide-[#2d3b33]">
          <div className="space-y-1.5 md:pr-3 pt-2 md:pt-0">
            <p className="font-semibold text-[#f2f5f1] flex items-center gap-1.5">
              <span>🎯</span> 1. Cày Quests 1-Click
            </p>
            <p className="text-[#9aa8a0] leading-relaxed">
              Nhập Token tài khoản Discord rồi bấm "Chạy toàn bộ Quests", hệ thống tự cày 100% nhiệm vụ lấy quà avatar, khung và vật phẩm game.
            </p>
          </div>
          <div className="space-y-1.5 md:px-3 pt-3 md:pt-0">
            <p className="font-semibold text-[#f2f5f1] flex items-center gap-1.5">
              <span>🎧</span> 2. Treo Voice Xem Stream
            </p>
            <p className="text-[#9aa8a0] leading-relaxed">
              Dán link video YouTube hoặc Twitch yêu thích để nghe nhạc cùng bạn bè trong phòng thoại và tự động tích lũy giờ xem.
            </p>
          </div>
          <div className="space-y-1.5 md:pl-3 pt-3 md:pt-0">
            <p className="font-semibold text-[#f2f5f1] flex items-center gap-1.5">
              <span>💖</span> 3. Bảo mật an toàn
            </p>
            <p className="text-[#9aa8a0] leading-relaxed">
              Toàn bộ dữ liệu của bạn được mã hóa an toàn trên hệ thống. Bạn có thể đổi token hoặc gia hạn bất cứ lúc nào một cách dễ dàng.
            </p>
          </div>
        </div>
      </div>

      {/* Chỉ hiển thị Nhật ký Kỹ thuật cho Quản trị viên (Admin) */}
      {user?.role === 'admin' && (
        <div className="surface overflow-hidden rounded-2xl border border-amber-500/30">
          <div className="flex items-center justify-between px-4 h-10 border-b border-line bg-amber-500/5">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <h2 className="text-[13px] font-medium text-amber-300 flex items-center gap-1.5">
                <span>👑</span>
                <span>Nhật ký sự kiện trực tiếp (Chỉ Quản trị viên)</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('logs')}
              className="link text-xs text-amber-300 hover:text-amber-200"
            >
              Toàn bộ nhật ký ({logs.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 font-mono text-[13px] space-y-2 max-h-56 overflow-y-auto leading-relaxed">
            {recentLogs.length === 0 ? (
              <p className="text-slate-400 italic py-2">Chưa có sự kiện nào được ghi nhận...</p>
            ) : (
              recentLogs.map((log, index) => {
                const p = parseLog(log);
                return (
                  <div key={index} className="flex items-baseline gap-2.5 text-xs sm:text-[13px]">
                    <span className="text-slate-400 select-none shrink-0 tabular-nums">{p.time}</span>
                    <span className={`font-semibold shrink-0 ${levelClass[p.level]}`}>
                      [{levelLabel[p.level]}]
                    </span>
                    <span className="text-slate-400 shrink-0 truncate max-w-[90px]">{p.source}</span>
                    <span className="text-slate-100 break-words min-w-0">{p.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
