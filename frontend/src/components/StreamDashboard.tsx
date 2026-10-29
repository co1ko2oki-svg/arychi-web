import React, { useState } from 'react';
import { FolderOpen, Loader2, Play, RefreshCw, Square } from 'lucide-react';
import { StreamStatus } from '../types';
import { streamApi } from '../services/api';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState, PageHeader, Section, StatusDot, Switch } from './ui';
import { formatPing } from './format';

interface StreamDashboardProps {
  status: StreamStatus | null;
  loading: boolean;
  onRefresh: () => void;
  streamConnected: boolean;
}

export const StreamDashboard: React.FC<StreamDashboardProps> = ({ status, loading, onRefresh, streamConnected }) => {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [videos, setVideos] = useState<Array<{ name: string; size: string }>>([]);
  const [scanned, setScanned] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [pendingPlayTarget, setPendingPlayTarget] = useState<string | null>(null);

  const playing = Boolean(status?.stream.playing);
  const stateLabel = !streamConnected ? 'Ngoại tuyến' : playing ? 'Đang phát' : 'Đang chờ';

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
    if (!streamConnected) {
      toast.warning('Dịch vụ StreamBot (:3000) đang ngoại tuyến');
      return;
    }
    if (!status) return;
    const nextState = !status.farm.autoWatch;
    setActionLoading(true);
    try {
      await streamApi.toggleFarm(nextState);
      toast.success(nextState ? 'Đã bật tự động xem stream' : 'Đã tắt tự động xem stream');
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
    ['Tài khoản bot', streamConnected ? status?.bot.tag || '—' : '—'],
    [
      'Gateway',
      streamConnected ? (status?.bot.isReady ? <span className="text-emerald-400">Sẵn sàng</span> : 'Chưa sẵn sàng') : '—',
    ],
    ['Độ trễ', formatPing(streamConnected, status?.bot.ping)],
    ['Codec', `${status?.config.videoCodec || 'VP8'} / Opus`],
    ['Kênh thoại', status?.stream.channelInfo?.channelId || '—'],
    ['Lặp lại', status?.stream.isLooping ? 'Bật' : 'Tắt'],
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="StreamBot Voice"
        description="Phát YouTube, Twitch hoặc file MP4 vào kênh thoại Discord bằng yt-dlp và FFmpeg."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={!streamConnected ? 'warn' : playing ? 'error' : 'ok'} />
              <span className="text-zinc-300">{stateLabel}</span>
            </span>
            <span>Cổng :3000</span>
            <span>Độ trễ {formatPing(streamConnected, status?.bot.ping)}</span>
          </>
        }
        actions={
          <button type="button" onClick={onRefresh} disabled={loading} className="btn-ghost" title="Tải lại trạng thái StreamBot">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        }
      />

      {!streamConnected && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05]">
          <p className="text-[13px] text-zinc-300">
            <span className="font-medium text-amber-300">Không kết nối được StreamBot (:3000).</span> Khởi động toàn bộ dịch vụ bằng{' '}
            <code className="inline-code">start.bat</code> rồi thử lại.
          </p>
          <button type="button" onClick={onRefresh} className="btn-secondary btn-sm shrink-0">
            Thử lại
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-x-12 gap-y-10">
        <div className="space-y-10 min-w-0">
          <div className="surface p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <p className="eyebrow flex items-center gap-2">
                  {playing && <StatusDot tone="error" />}
                  {playing ? 'Đang phát' : 'Không có nội dung đang phát'}
                </p>
                <p className={`text-lg font-semibold tracking-tight break-words ${playing ? 'text-white' : 'text-zinc-500'}`}>
                  {playing ? status?.stream.currentQueueItem?.title || 'Đang truyền phát media' : 'Kênh thoại đang trống'}
                </p>
                {playing && status?.stream.currentQueueItem?.url && (
                  <p className="text-xs text-zinc-500 font-mono truncate">{status.stream.currentQueueItem.url}</p>
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
                Phát nội dung mới
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
                <button type="submit" disabled={actionLoading || !streamConnected || !query.trim()} className="btn-primary shrink-0">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  Phát
                </button>
              </div>
              <p className="field-hint">Hỗ trợ YouTube, Twitch, liên kết trực tiếp hoặc tên file trong thư mục stream/videos/.</p>
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
              <button type="button" onClick={loadVideoLibrary} disabled={loadingVideos || !streamConnected} className="btn-secondary btn-sm">
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
                      <p className="text-[13px] text-zinc-200 truncate">{vid.name}</p>
                      <p className="text-xs text-zinc-500 tabular-nums">{vid.size}</p>
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
                <h2 className="text-[15px] font-semibold text-white">Viewer Farm</h2>
                <p className="mt-1 text-[13px] text-zinc-500 leading-relaxed">
                  Tự động giữ tài khoản trong kênh xem stream để tích lũy thời gian xem.
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
            <h2 className="eyebrow mb-2">Thông tin dịch vụ</h2>
            <dl className="divide-y divide-line border-y border-line text-[13px]">
              {details.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-zinc-200 font-mono text-xs truncate text-right">{v}</dd>
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
