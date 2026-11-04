import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Loader2,
  Lock,
  Music,
  Play,
  Radio,
  RefreshCw,
  Repeat,
  Square,
  Tv,
} from 'lucide-react';
import { AccountTokens, AuthUser, StreamStatus } from '../types';
import { questApi, streamApi } from '../services/api';
import { useToast } from './Toast';
import { PageHeader, StatusDot } from './ui';
import { formatPing } from '../utils/format';

interface StreamDashboardProps {
  user?: AuthUser | null;
  sessionToken?: string;
  onUpdateAccountTokens?: (tokens: Partial<AccountTokens>) => void;
  status: StreamStatus | null;
  loading: boolean;
  onRefresh: () => void;
  streamConnected: boolean;
  onOpenLoginModal: () => void;
}

// 10 Official Discord Stream Badge Tiers (Matching official Discord stream hours)
const STREAM_TIERS = [
  { targetHours: 1, label: '1 giờ', title: 'Người mới', color: '#9aa8a0', isLocked: false },
  { targetHours: 5, label: '5 giờ', title: 'Chim non', color: '#8ec07c', isLocked: false },
  { targetHours: 20, label: '20 giờ', title: 'Đột phá', color: '#72b991', isLocked: false },
  { targetHours: 75, label: '75 giờ', title: 'Nổi bật', color: '#4ec9b0', isLocked: false },
  { targetHours: 150, label: '150 giờ', title: 'Người tạo xu hướng', color: '#56b6c2', isLocked: false },
  { targetHours: 300, label: '300 giờ', title: 'Tiêu điểm', color: '#61afef', isLocked: false },
  { targetHours: 500, label: '500 giờ', title: 'Ngôi sao', color: '#8e96e8', isLocked: false },
  { targetHours: 1000, label: '1.000 giờ', title: 'Cảm giác', color: '#d172e8', isLocked: false },
  { targetHours: 2000, label: '2.000 giờ', title: 'Nhà tiên tri', color: '#e06c75', isLocked: true },
  { targetHours: 5000, label: '5.000+ giờ', title: 'Xuất thần', color: '#d7ad69', isLocked: true },
];

const PREDEFINED_SOURCES = [
  {
    id: 'lofi',
    title: 'Lofi Beats Chill Stream',
    desc: 'Nhạc thư giãn 24/7 nhẹ nhàng cho phòng thoại',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    icon: Music,
  },
  {
    id: 'cozy-game',
    title: 'Cozy Gaming Ambient Loop',
    desc: 'Gameplay ấm áp, chill thư thái phong cách anime',
    url: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
    icon: Flame,
  },
];

export const StreamDashboard: React.FC<StreamDashboardProps> = ({
  user = null,
  sessionToken = '',
  onUpdateAccountTokens,
  status,
  loading,
  onRefresh,
  streamConnected,
  onOpenLoginModal,
}) => {
  const { toast } = useToast();
  const [mainToken, setMainToken] = useState(user?.tokens?.streamMainToken || '');
  const [viewerToken, setViewerToken] = useState(user?.tokens?.streamViewerToken || '');
  const [guildId, setGuildId] = useState(
    user?.tokens?.streamGuildId || status?.config?.guildId || ''
  );
  const [videoChannelId, setVideoChannelId] = useState(
    user?.tokens?.streamChannelId || status?.config?.videoChannelId || ''
  );
  const [prefix, setPrefix] = useState(user?.tokens?.prefix || status?.config?.prefix || '$');
  const [cmdChannelId, setCmdChannelId] = useState(
    user?.tokens?.commandChannelId || status?.config?.cmdChannelId || ''
  );
  const [adminIds, setAdminIds] = useState(
    user?.tokens?.adminIds || (status?.config?.adminIds ? status.config.adminIds.join(', ') : '')
  );
  const [showTokens, setShowTokens] = useState(false);
  const [savingTokens, setSavingTokens] = useState(false);

  const [query, setQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user?.tokens) {
      if (user.tokens.streamMainToken) setMainToken(user.tokens.streamMainToken);
      if (user.tokens.streamViewerToken) setViewerToken(user.tokens.streamViewerToken);
      if (user.tokens.streamGuildId) setGuildId(user.tokens.streamGuildId);
      if (user.tokens.streamChannelId) setVideoChannelId(user.tokens.streamChannelId);
      if (user.tokens.prefix) setPrefix(user.tokens.prefix);
      if (user.tokens.commandChannelId) setCmdChannelId(user.tokens.commandChannelId);
      if (user.tokens.adminIds) setAdminIds(user.tokens.adminIds);
    }
  }, [user?.tokens]);

  const playing = Boolean(status?.stream.playing);
  const hasBothStreamTokens =
    Boolean(mainToken.trim() && viewerToken.trim()) ||
    Boolean(status?.config?.hasMainToken && status?.config?.hasViewerToken);

  // Compute total stream hours for badge progression
  const totalMinutes = status?.farm?.totalMinutesWatched || 0;
  const currentHours = Math.floor(totalMinutes / 60);

  // Find next badge tier
  const nextTier = STREAM_TIERS.find((t) => t.targetHours > currentHours) || STREAM_TIERS[STREAM_TIERS.length - 1];
  const hoursRemaining = Math.max(0, nextTier.targetHours - currentHours);
  const progressPercent = Math.min(100, Math.round((currentHours / nextTier.targetHours) * 100));

  const handleSaveTwoStreamTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainToken.trim() || !viewerToken.trim()) {
      toast.warning('Treo Stream bắt buộc phải nhập đủ 2 Token: 1 Token Chính và 1 Token Phụ');
      return;
    }

    setSavingTokens(true);
    try {
      const activeSession = sessionToken || user?.sessionToken || '';
      if (activeSession) {
        await questApi.saveAccountTokens(activeSession, {
          streamMainToken: mainToken.trim(),
          streamViewerToken: viewerToken.trim(),
          streamGuildId: guildId.trim(),
          streamChannelId: videoChannelId.trim(),
          prefix: prefix.trim(),
          commandChannelId: cmdChannelId.trim(),
          adminIds: adminIds.trim(),
        });
      }

      if (streamConnected) {
        await streamApi.updateTokens({
          mainToken: mainToken.trim(),
          viewerToken: viewerToken.trim(),
          guildId: guildId.trim() || undefined,
          videoChannelId: videoChannelId.trim() || undefined,
          prefix: prefix.trim() || undefined,
          cmdChannelId: cmdChannelId.trim() || undefined,
          adminIds: adminIds.trim() || undefined,
        });
      }

      onUpdateAccountTokens?.({
        streamMainToken: mainToken.trim(),
        streamViewerToken: viewerToken.trim(),
        streamGuildId: guildId.trim(),
        streamChannelId: videoChannelId.trim(),
        prefix: prefix.trim(),
        commandChannelId: cmdChannelId.trim(),
        adminIds: adminIds.trim(),
      });

      toast.success('Đã lưu cài đặt Stream thành công ✨');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi lưu cài đặt cho Treo Stream');
    } finally {
      setSavingTokens(false);
    }
  };

  const handlePlaySource = async (urlToPlay: string) => {
    if (!hasBothStreamTokens) {
      toast.warning('Vui lòng lưu đủ 2 Token (1 Chính + 1 Phụ) trước khi phát');
      return;
    }
    setActionLoading(true);
    try {
      await streamApi.playVideo(urlToPlay);
      toast.success('Đã gửi yêu cầu phát video');
      setQuery('');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể phát video');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopStream = async () => {
    setActionLoading(true);
    try {
      await streamApi.stopVideo();
      toast.info('Đã dừng phát video');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể dừng stream');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleLoop = async () => {
    setActionLoading(true);
    try {
      const nextLoop = !status?.stream.isLooping;
      await streamApi.toggleLoop(nextLoop);
      toast.success(nextLoop ? 'Đã bật phát lặp lại' : 'Đã tắt phát lặp lại');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể đổi chế độ loop');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAutoWatch = async () => {
    setActionLoading(true);
    try {
      const nextWatch = !status?.farm?.autoWatch;
      await streamApi.toggleFarm(nextWatch);
      toast.success(nextWatch ? 'Đã bật tự động xem kênh' : 'Đã tắt tự động xem');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể đổi trạng thái cày giờ');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treo Stream Voice & Cày Huy Hiệu 5.000 Giờ 🎧"
        description="Phát video liên tục 24/7 vào phòng thoại Discord với tài khoản phụ tự động xem để chinh phục 10 cấp huy hiệu Stream."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#1a231f] border border-[#2d3b33] text-xs font-mono text-[#f2f5f1]">
              <StatusDot tone={streamConnected ? (playing ? 'ok' : 'ok') : 'error'} />
              Stream {streamConnected ? (playing ? 'Đang phát 🎵' : 'Sẵn sàng 🟢') : 'Ngoại tuyến 🔴'}
            </span>
            {status?.bot?.ping !== undefined && (
              <span className="text-xs font-mono text-[#9aa8a0]">
                Ping: {formatPing(streamConnected, status.bot.ping)}
              </span>
            )}
            <span className="text-xs font-mono text-[#72b991]">
              Thời gian đã tích lũy: {currentHours} giờ ({totalMinutes} phút)
            </span>
          </>
        }
        actions={
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="btn-secondary btn-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        }
      />

      {/* 5,000-Hour Discord Stream Badge Tracker Card (Matching Image 3) */}
      <div className="surface p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="eyebrow text-[#8e96e8]">Mục tiêu 5.000 giờ</span>
            <h2 className="text-lg font-bold text-[#f2f5f1] mt-0.5">Tiến trình của bạn</h2>
            <p className="text-xs text-[#9aa8a0] mt-1">
              Stream thêm nhiều giờ cho người dùng khác để tăng cấp độ huy hiệu này.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-bold text-[#f2f5f1]">
              {hoursRemaining > 0 ? `${hoursRemaining} giờ nữa` : 'Đã đạt cấp tối đa!'}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-[#9aa8a0]">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="#8e96e8" strokeWidth="2" className="w-4 h-4">
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
              <span>Hiện tại: {currentHours} giờ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Cấp kế tiếp: {nextTier.title} ({nextTier.targetHours}h)</span>
              <svg viewBox="0 0 24 24" fill="none" stroke={nextTier.color} strokeWidth="2" className="w-4 h-4">
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
            </div>
          </div>

          <div className="h-2 w-full bg-[#161e1a] rounded-full overflow-hidden border border-[#2d3b33]">
            <div
              className="h-full bg-[#8e96e8] transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 10 Badge Tier Icons Grid (Matching User Screenshot Image 3) */}
        <div className="pt-3 border-t border-[#2d3b33] grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STREAM_TIERS.map((tier) => {
            const isEarned = currentHours >= tier.targetHours;
            const isNext = nextTier.targetHours === tier.targetHours;
            return (
              <div
                key={tier.title}
                className={`p-3 rounded-lg border text-center transition-all ${
                  isEarned
                    ? 'bg-[#1a231f] border-[#72b991]/40'
                    : isNext
                    ? 'bg-[#212c27] border-[#8e96e8]'
                    : 'bg-[#161e1a] border-[#2d3b33] opacity-65'
                }`}
              >
                {/* Computer Monitor Icon with Exact Discord Colors */}
                <div className="w-8 h-8 mx-auto flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill={isEarned ? `${tier.color}20` : 'none'}
                    stroke={tier.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-6 h-6"
                  >
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-[#f2f5f1] mt-1.5 truncate">
                  {tier.title}
                </div>
                <div className="text-xs font-mono text-[#9aa8a0] tabular-nums flex items-center justify-center gap-1 mt-0.5">
                  {tier.isLocked && !isEarned && <span className="text-xs">🔒</span>}
                  <span>{tier.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stream Config Form */}
      <form onSubmit={handleSaveTwoStreamTokens} className="surface p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d3b33] pb-4">
          <div>
            <span className="eyebrow text-[#8e96e8]">Cấu hình kết nối</span>
            <h2 className="text-base font-bold text-[#f2f5f1] mt-0.5">
              Cài đặt 2 Token &amp; Kênh thoại Discord
            </h2>
            <p className="text-xs text-[#9aa8a0] mt-0.5 max-w-2xl leading-relaxed">
              Token Chính dùng để phát video, Token Phụ tự động vào xem kênh để tích lũy giờ stream.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8e96e8]">
              <StatusDot tone={hasBothStreamTokens ? 'ok' : 'warn'} />
              {hasBothStreamTokens ? 'ĐÃ CÓ ĐỦ 2 TOKEN' : 'CẦN NHẬP 2 TOKEN'}
            </span>
            <button
              type="button"
              onClick={() => setShowTokens((v) => !v)}
              className="btn-ghost btn-sm"
            >
              {showTokens ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showTokens ? 'Ẩn' : 'Hiện'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="stream-main-token" className="field-label">
              1. Token Chính (Tài khoản phát Stream)
            </label>
            <input
              id="stream-main-token"
              type={showTokens ? 'text' : 'password'}
              value={mainToken}
              onChange={(e) => setMainToken(e.target.value)}
              placeholder="Nhập Discord User Token của acc phát..."
              className="input font-mono"
              autoComplete="off"
            />
            <p className="field-hint">Tài khoản này sẽ vào kênh thoại và phát luồng video.</p>
          </div>

          <div>
            <label htmlFor="stream-viewer-token" className="field-label">
              2. Token Phụ (Tài khoản xem Stream / Viewer Farm)
            </label>
            <input
              id="stream-viewer-token"
              type={showTokens ? 'text' : 'password'}
              value={viewerToken}
              onChange={(e) => setViewerToken(e.target.value)}
              placeholder="Nhập Discord User Token của acc xem..."
              className="input font-mono"
              autoComplete="off"
            />
            <p className="field-hint">Tài khoản phụ tự động vào xem stream của tài khoản chính.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#2d3b33]">
          <div>
            <label htmlFor="stream-guild-id" className="field-label">
              Server ID (GUILD_ID)
            </label>
            <input
              id="stream-guild-id"
              type="text"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="ID máy chủ Discord"
              className="input font-mono"
            />
          </div>

          <div>
            <label htmlFor="stream-channel-id" className="field-label">
              Voice Channel ID (VIDEO_CHANNEL_ID)
            </label>
            <input
              id="stream-channel-id"
              type="text"
              value={videoChannelId}
              onChange={(e) => setVideoChannelId(e.target.value)}
              placeholder="ID kênh thoại phát Stream"
              className="input font-mono"
            />
          </div>

          <div>
            <label htmlFor="stream-cmd-channel-id" className="field-label">
              Command Channel ID (COMMAND_CHANNEL_ID)
            </label>
            <input
              id="stream-cmd-channel-id"
              type="text"
              value={cmdChannelId}
              onChange={(e) => setCmdChannelId(e.target.value)}
              placeholder="ID kênh nhận lệnh bot (Tùy chọn)"
              className="input font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-4 items-end pt-2">
          <div>
            <label htmlFor="stream-prefix" className="field-label">
              Prefix lệnh (PREFIX)
            </label>
            <input
              id="stream-prefix"
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="$"
              className="input font-mono"
            />
          </div>

          <div>
            <label htmlFor="stream-admin-ids" className="field-label">
              Admin IDs (ADMIN_IDS)
            </label>
            <input
              id="stream-admin-ids"
              type="text"
              value={adminIds}
              onChange={(e) => setAdminIds(e.target.value)}
              placeholder="Discord ID admin (cách nhau dấu phẩy)"
              className="input font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={savingTokens || !mainToken.trim() || !viewerToken.trim()}
            className="btn-primary h-[38px] px-5"
          >
            {savingTokens ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Lưu cài đặt Stream ✨</span>
          </button>
        </div>
      </form>

      {/* Video Source Selection & Playback Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        {/* Left Column: Predefined Sources & Custom URL */}
        <div className="surface p-6 space-y-5">
          <div className="border-b border-[#2d3b33] pb-3">
            <span className="eyebrow text-[#8e96e8]">Chọn nguồn video</span>
            <h3 className="text-base font-bold text-[#f2f5f1] mt-0.5">
              Nguồn phát video liên tục
            </h3>
            <p className="text-xs text-[#9aa8a0] mt-0.5">
              Chọn từ 2 nguồn video có sẵn tối ưu hoặc nhập URL bất kỳ của bạn.
            </p>
          </div>

          {/* 2 Predefined Video Sources */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PREDEFINED_SOURCES.map((source) => {
              const Icon = source.icon;
              return (
                <div
                  key={source.id}
                  className="p-4 rounded-lg bg-[#161e1a] border border-[#2d3b33] hover:border-[#3b4c42] transition-colors flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-[#1a231f] border border-[#2d3b33] flex items-center justify-center text-[#8e96e8]">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-[#f2f5f1]">{source.title}</h4>
                    </div>
                    <p className="text-[12px] text-[#9aa8a0]">{source.desc}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePlaySource(source.url)}
                    disabled={actionLoading || !hasBothStreamTokens}
                    className="btn-secondary btn-sm w-full"
                  >
                    <Play className="w-3.5 h-3.5 text-[#72b991]" />
                    <span>Phát nguồn này</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Custom URL Input */}
          <div className="pt-3 border-t border-[#2d3b33] space-y-2">
            <label htmlFor="custom-video-url" className="field-label">
              Hoặc nhập URL tùy chọn (YouTube, Twitch, liên kết trực tiếp)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="custom-video-url"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="input font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => query.trim() && handlePlaySource(query.trim())}
                disabled={actionLoading || !query.trim() || !hasBothStreamTokens}
                className="btn-primary btn-sm px-4 shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Phát</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Playback Status & Controls */}
        <div className="surface p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-[#2d3b33] pb-3 flex items-center justify-between">
              <div>
                <span className="eyebrow text-[#8e96e8]">Trạng thái luồng</span>
                <h3 className="text-base font-bold text-[#f2f5f1] mt-0.5">
                  {playing ? 'Đang phát trực tiếp 🎵' : 'Kênh thoại đang trống'}
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-mono bg-[#161e1a] border border-[#2d3b33]">
                <StatusDot tone={playing ? 'ok' : 'warn'} />
                {playing ? 'LIVE' : 'IDLE'}
              </span>
            </div>

            {status?.stream?.currentQueueItem && (
              <div className="p-3 bg-[#161e1a] rounded-lg border border-[#2d3b33] space-y-1">
                <span className="text-[11px] font-mono text-[#9aa8a0]">Đang phát:</span>
                <p className="text-xs font-semibold text-[#f2f5f1] truncate">
                  {status.stream.currentQueueItem.title}
                </p>
              </div>
            )}

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[#9aa8a0]">
                <span>Phát lặp lại (Loop):</span>
                <span className={status?.stream.isLooping ? 'text-[#72b991]' : 'text-[#67756d]'}>
                  {status?.stream.isLooping ? 'BẬT' : 'TẮT'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#9aa8a0]">
                <span>Tự động xem kênh (Viewer):</span>
                <span className={status?.farm?.autoWatch ? 'text-[#72b991]' : 'text-[#67756d]'}>
                  {status?.farm?.autoWatch ? 'ĐANG CHẠY' : 'DỪNG'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#9aa8a0]">
                <span>Phiên hiện tại:</span>
                <span className="text-[#f2f5f1]">
                  {status?.farm?.formattedSessionTime || '0 phút'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#2d3b33] space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleToggleLoop}
                disabled={actionLoading}
                className={`btn-secondary btn-sm ${status?.stream.isLooping ? 'border-[#72b991] text-[#72b991]' : ''}`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>{status?.stream.isLooping ? 'Tắt Loop' : 'Bật Loop'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleAutoWatch}
                disabled={actionLoading}
                className={`btn-secondary btn-sm ${status?.farm?.autoWatch ? 'border-[#72b991] text-[#72b991]' : ''}`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{status?.farm?.autoWatch ? 'Tắt Viewer' : 'Bật Viewer'}</span>
              </button>
            </div>

            {playing && (
              <button
                type="button"
                onClick={handleStopStream}
                disabled={actionLoading}
                className="btn-danger btn-sm w-full"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Dừng phát Stream</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamDashboard;
