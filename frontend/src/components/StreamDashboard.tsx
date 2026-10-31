import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FolderOpen,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  Square,
} from 'lucide-react';
import { AccountTokens, AuthUser, PlanTierId, StreamStatus, UserSubscription } from '../types';
import { questApi, streamApi } from '../services/api';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState, PageHeader, Section, StatusDot, Switch } from './ui';
import { formatPing } from './format';

interface StreamDashboardProps {
  user?: AuthUser | null;
  subscription?: UserSubscription | null;
  sessionToken?: string;
  onUpdateAccountTokens?: (tokens: Partial<AccountTokens>) => void;
  status: StreamStatus | null;
  loading: boolean;
  onRefresh: () => void;
  streamConnected: boolean;
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal: (planId?: PlanTierId) => void;
}

export const StreamDashboard: React.FC<StreamDashboardProps> = ({
  user = null,
  subscription = null,
  sessionToken = '',
  onUpdateAccountTokens,
  status,
  loading,
  onRefresh,
  streamConnected,
  onOpenLoginModal,
  onOpenSubscriptionModal,
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
  const [showTokens, setShowTokens] = useState(false);
  const [savingTokens, setSavingTokens] = useState(false);

  const [query, setQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [videos, setVideos] = useState<Array<{ name: string; size: string | number; formattedSize?: string }>>([]);
  const [scanned, setScanned] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [pendingPlayTarget, setPendingPlayTarget] = useState<string | null>(null);

  useEffect(() => {
    if (user?.tokens) {
      if (user.tokens.streamMainToken) setMainToken(user.tokens.streamMainToken);
      if (user.tokens.streamViewerToken) setViewerToken(user.tokens.streamViewerToken);
      if (user.tokens.streamGuildId) setGuildId(user.tokens.streamGuildId);
      if (user.tokens.streamChannelId) setVideoChannelId(user.tokens.streamChannelId);
    }
  }, [user?.tokens]);

  const playing = Boolean(status?.stream.playing);
  const stateLabel = !streamConnected ? 'Ngoại tuyến' : playing ? 'Đang phát' : 'Đang chờ';

  const hasBothStreamTokens =
    Boolean(mainToken.trim() && viewerToken.trim()) ||
    Boolean(status?.config?.hasMainToken && status?.config?.hasViewerToken);

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
        });
      }

      if (streamConnected) {
        await streamApi.updateTokens({
          mainToken: mainToken.trim(),
          viewerToken: viewerToken.trim(),
          guildId: guildId.trim() || undefined,
          videoChannelId: videoChannelId.trim() || undefined,
        });
      }

      onUpdateAccountTokens?.({
        streamMainToken: mainToken.trim(),
        streamViewerToken: viewerToken.trim(),
        streamGuildId: guildId.trim(),
        streamChannelId: videoChannelId.trim(),
      });

      toast.success('Đã lưu 2 Token Stream (1 Chính + 1 Phụ) vào Database & kích hoạt StreamBot');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi lưu 2 Token cho Treo Stream');
    } finally {
      setSavingTokens(false);
    }
  };

  const requireAccess = () => {
    if (!user) {
      toast.warning('Vui lòng đăng nhập OAuth2 trước');
      onOpenLoginModal();
      return false;
    }
    if (!subscription || subscription.isActive === false) {
      toast.warning('Vui lòng kích hoạt gói 20.000đ/tháng để sử dụng Treo Stream');
      onOpenSubscriptionModal('monthly_20k');
      return false;
    }
    if (!hasBothStreamTokens) {
      toast.warning('Vui lòng nhập đủ 2 Token (1 Token Chính + 1 Token Phụ) ở khung cấu hình bên dưới');
      return false;
    }
    return true;
  };

  const executePlay = async (target: string) => {
    setActionLoading(true);
    setPendingPlayTarget(null);
    try {
      await streamApi.playVideo(target);
      toast.success(`Đang truyền phát: ${target}`);
      setQuery('');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi phát video: ${err?.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const requestPlay = (videoUrl?: string) => {
    if (!requireAccess()) return;
    if (!streamConnected) {
      toast.warning('Dịch vụ StreamBot (:3000) đang ngoại tuyến');
      return;
    }
    const target = (videoUrl || query).trim();
    if (!target) {
      toast.warning('Vui lòng nhập URL YouTube/Twitch hoặc chọn file video');
      return;
    }
    if (playing) {
      setPendingPlayTarget(target);
    } else {
      executePlay(target);
    }
  };

  const handleStop = async () => {
    if (!requireAccess()) return;
    if (!streamConnected) return;
    setActionLoading(true);
    try {
      await streamApi.stopStream();
      toast.info('Đã dừng phát video trong phòng thoại');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi dừng stream: ${err?.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFarm = async () => {
    if (!requireAccess()) return;
    if (!streamConnected) {
      toast.warning('Dịch vụ StreamBot (:3000) đang ngoại tuyến');
      return;
    }
    if (!status) return;
    const nextState = !status.farm.autoWatch;
    setActionLoading(true);
    try {
      await streamApi.toggleFarm(nextState);
      toast.success(nextState ? 'Đã bật tự động xem stream (Token Phụ)' : 'Đã tắt tự động xem stream');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi chuyển đổi Viewer Farm: ${err?.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const loadVideoLibrary = async () => {
    setLoadingVideos(true);
    try {
      const data = await streamApi.getVideos();
      const list = data.videos || [];
      setVideos(list);
      setScanned(true);
      toast.success(`Tìm thấy ${list.length} file trong thư mục video`);
    } catch (err: any) {
      toast.error(`Lỗi quét thư mục video: ${err?.message || err}`);
    } finally {
      setLoadingVideos(false);
    }
  };

  const details: Array<[string, React.ReactNode]> = [
    ['Acc Chính (Streamer)', streamConnected ? status?.bot.tag || 'Chưa kết nối' : '—'],
    ['Acc Phụ (Viewer Farm)', streamConnected ? status?.farm.viewerTag || 'Chưa kết nối' : '—'],
    [
      'Gateway',
      streamConnected ? (
        status?.bot.isReady ? (
          <span className="text-blue-300">Sẵn sàng</span>
        ) : (
          'Chờ đăng nhập 2 Token'
        )
      ) : (
        '—'
      ),
    ],
    ['Độ trễ', formatPing(streamConnected, status?.bot.ping)],
    ['Codec', `${status?.config.videoCodec || 'H264'} / Opus`],
    ['Kênh thoại', status?.stream.channelInfo?.channelId || videoChannelId || '—'],
    ['Lặp lại', status?.stream.isLooping ? 'Bật' : 'Tắt'],
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Treo Stream Voice (Yêu cầu 2 Token)"
        description="Cấu hình 1 Token Chính (phát luồng video) và 1 Token Phụ (tự động vào xem stream để cày giờ)."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={!streamConnected ? 'warn' : playing ? 'error' : 'ok'} />
              <span className="text-slate-200">{stateLabel}</span>
            </span>
            <span>Cổng :3000</span>
            <span>Độ trễ {formatPing(streamConnected, status?.bot.ping)}</span>
          </>
        }
        actions={
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="btn-ghost"
            title="Tải lại trạng thái StreamBot"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        }
      />

      <form onSubmit={handleSaveTwoStreamTokens} className="surface p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-line">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-bold text-white">
                Cấu hình 2 Token Acc Discord cho Treo Stream (1 Chính + 1 Phụ)
              </h2>
            </div>
            <p className="text-xs text-slate-300">
              Nhập 1 Token Chính để phát video vào kênh thoại và 1 Token Phụ để tự động vào xem stream tích lũy giờ.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-300">
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
              placeholder="Nhập Discord Token của acc chính phát stream..."
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
              placeholder="Nhập Discord Token của acc phụ cày giờ xem..."
              className="input font-mono"
              autoComplete="off"
            />
            <p className="field-hint">Tài khoản phụ tự động vào xem stream của tài khoản chính.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end pt-2 border-t border-line">
          <div>
            <label htmlFor="stream-guild-id" className="field-label">
              Server ID (Guild ID)
            </label>
            <input
              id="stream-guild-id"
              type="text"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="ID máy chủ Discord (Tùy chọn)"
              className="input font-mono"
            />
          </div>

          <div>
            <label htmlFor="stream-channel-id" className="field-label">
              Voice Channel ID (Kênh thoại phát Stream)
            </label>
            <input
              id="stream-channel-id"
              type="text"
              value={videoChannelId}
              onChange={(e) => setVideoChannelId(e.target.value)}
              placeholder="ID kênh thoại Discord"
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
            <span>Lưu &amp; Kết nối 2 Token</span>
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-x-12 gap-y-10">
        <div className="space-y-10 min-w-0">
          <div className="surface p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-medium text-slate-300 flex items-center gap-2">
                  {playing && <StatusDot tone="error" />}
                  {playing ? 'Đang phát' : 'Không có nội dung đang phát'}
                </p>
                <p
                  className={`text-lg font-semibold tracking-tight break-words ${
                    playing ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {playing
                    ? status?.stream.currentQueueItem?.title || 'Đang truyền phát media'
                    : 'Kênh thoại đang trống'}
                </p>
                {playing && status?.stream.currentQueueItem?.url && (
                  <p className="text-xs text-slate-300 font-mono truncate">
                    {status.stream.currentQueueItem.url}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleStop}
                disabled={actionLoading || !streamConnected || !playing}
                className="btn-danger shrink-0"
              >
                <Square className="w-3 h-3 fill-current" />
                Dừng phát
              </button>
            </div>

            <form
              className="mt-6 pt-5 border-t border-line"
              onSubmit={(e) => {
                e.preventDefault();
                requestPlay();
              }}
            >
              <label htmlFor="stream-query" className="field-label">
                Phát nội dung mới (sau khi đã nhập đủ 2 Token Chính &amp; Phụ)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="stream-query"
                  type="text"
                  value={query}
                  disabled={!streamConnected}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="https://youtube.com/watch?v=… hoặc tên file"
                  className="input"
                />
                <button
                  type="submit"
                  disabled={actionLoading || !streamConnected || !query.trim()}
                  className="btn-primary shrink-0"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  Phát
                </button>
              </div>
              <p className="field-hint">
                Hỗ trợ YouTube, Twitch, liên kết trực tiếp hoặc tên file trong thư mục stream/videos/.
              </p>
            </form>
          </div>

          <Section
            title="Thư viện cục bộ"
            description={
              <>
                File media trong <code className="inline-code">stream/videos/</code>
              </>
            }
            action={
              <button
                type="button"
                onClick={loadVideoLibrary}
                disabled={loadingVideos || !streamConnected}
                className="btn-secondary btn-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingVideos ? 'animate-spin' : ''}`} />
                Quét thư mục
              </button>
            }
          >
            {videos.length === 0 ? (
              <div className="border border-dashed border-line rounded-lg">
                <EmptyState
                  icon={<FolderOpen className="w-5 h-5" />}
                  title={scanned ? 'Thư mục không có file media' : 'Chưa quét thư mục'}
                  description={
                    scanned
                      ? 'Chép file video vào stream/videos/ rồi quét lại.'
                      : 'Nhấn “Quét thư mục” để liệt kê các file có thể phát.'
                  }
                />
              </div>
            ) : (
              <ul className="border-y border-line divide-y divide-line">
                {videos.map((vid) => (
                  <li key={vid.name} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] text-white truncate">{vid.name}</p>
                      <p className="text-xs text-slate-300 tabular-nums">
                        {vid.formattedSize || String(vid.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => requestPlay(vid.name)}
                      disabled={!streamConnected || actionLoading}
                      className="btn-ghost btn-sm shrink-0"
                      aria-label={`Phát ${vid.name}`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Phát
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="space-y-8">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[15px] font-semibold text-white">Viewer Farm (Token Phụ)</h2>
                <p className="mt-1 text-[13px] text-slate-300 leading-relaxed">
                  Tự động dùng Token Phụ giữ kết nối xem stream của Token Chính để tích lũy thời gian xem.
                </p>
              </div>
              <Switch
                checked={Boolean(status?.farm.autoWatch)}
                onChange={handleToggleFarm}
                disabled={actionLoading || !streamConnected || !status}
                label="Bật Viewer Farm"
              />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Thông tin dịch vụ &amp; 2 Token
            </h2>
            <dl className="divide-y divide-line border-y border-line text-[13px]">
              {details.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-slate-300">{k}</dt>
                  <dd className="text-white font-mono text-xs truncate text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={pendingPlayTarget !== null}
        title="Thay thế nội dung đang phát?"
        message={`Kênh thoại đang phát một luồng khác. Phát "${pendingPlayTarget}" sẽ ngắt luồng hiện tại.`}
        confirmText="Phát thay thế"
        cancelText="Hủy"
        variant="warning"
        onConfirm={() => pendingPlayTarget && executePlay(pendingPlayTarget)}
        onCancel={() => setPendingPlayTarget(null)}
      />
    </div>
  );
};

export default StreamDashboard;
