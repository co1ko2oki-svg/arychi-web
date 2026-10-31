import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Search, Trash2 } from 'lucide-react';
import { LogEntry } from '../types';
import { useToast } from './Toast';
import { EmptyState, PageHeader, SegmentedControl, Switch } from './ui';
import { levelClass, levelLabel, parseLog } from './format';

interface TerminalLogsProps {
  logs: LogEntry[];
  onClear: () => void;
}

type LevelFilter = 'all' | LogEntry['level'];

export const TerminalLogs: React.FC<TerminalLogsProps> = ({ logs, onClear }) => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<LevelFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const c = { info: 0, warn: 0, error: 0, success: 0 };
    logs.forEach((l) => {
      c[l.level] += 1;
    });
    return c;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return logs.filter((l) => {
      if (filter !== 'all' && l.level !== filter) return false;
      if (term && !l.message.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [logs, filter, searchTerm]);

  useEffect(() => {
    const el = scrollRef.current;
    if (autoScroll && el) el.scrollTop = el.scrollHeight;
  }, [filteredLogs, autoScroll]);

  const serialize = (iso: boolean) =>
    filteredLogs
      .map((l) => {
        const t = iso
          ? new Date(l.timestamp).toISOString()
          : new Date(l.timestamp).toLocaleTimeString();
        return `[${t}] [${l.level.toUpperCase()}] ${l.message}`;
      })
      .join('\n');

  const handleCopyAll = async () => {
    if (filteredLogs.length === 0) {
      toast.warning('Không có dòng log nào để sao chép');
      return;
    }
    try {
      await navigator.clipboard.writeText(serialize(false));
      toast.success(`Đã sao chép ${filteredLogs.length} dòng log`);
    } catch {
      toast.error('Trình duyệt không cho phép truy cập clipboard');
    }
  };

  const handleDownloadLog = () => {
    if (filteredLogs.length === 0) {
      toast.warning('Không có dòng log nào để xuất file');
      return;
    }
    const blob = new Blob([serialize(true)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arychi-system-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã tải xuống file nhật ký (${filteredLogs.length} dòng)`);
  };

  const handleClear = () => {
    onClear();
    toast.info('Đã xóa bộ đệm log trên màn hình');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhật ký hệ thống"
        description="Sự kiện trực tiếp từ Quest Engine (:3001) và StreamBot (:3000), nhận qua WebSocket."
        actions={
          <>
            <button type="button" onClick={handleCopyAll} className="btn-secondary">
              <Copy className="w-4 h-4" />
              Sao chép
            </button>
            <button type="button" onClick={handleDownloadLog} className="btn-secondary">
              <Download className="w-4 h-4" />
              Xuất .log
            </button>
            <button type="button" onClick={handleClear} className="btn-ghost hover:text-rose-300">
              <Trash2 className="w-4 h-4" />
              Xóa
            </button>
          </>
        }
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Lọc theo mức độ"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tất cả', count: logs.length },
            { value: 'error', label: 'Lỗi', count: counts.error },
            { value: 'warn', label: 'Cảnh báo', count: counts.warn },
            { value: 'success', label: 'Thành công', count: counts.success },
            { value: 'info', label: 'Thông tin', count: counts.info },
          ]}
        />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[13px] text-slate-300 shrink-0">
            <Switch
              checked={autoScroll}
              onChange={() => setAutoScroll((v) => !v)}
              label="Tự động cuộn"
            />
            Tự động cuộn
          </label>
          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm trong nội dung"
              aria-label="Tìm trong nhật ký"
              className="input pl-8"
            />
          </div>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="hidden sm:grid grid-cols-[76px_56px_84px_1fr] gap-3 px-4 h-9 items-center border-b border-line text-2xs font-medium uppercase tracking-[0.06em] text-slate-300">
          <span>Thời gian</span>
          <span>Mức</span>
          <span>Nguồn</span>
          <span>Nội dung</span>
        </div>
        <div
          ref={scrollRef}
          className="h-[calc(100vh-340px)] min-h-[360px] overflow-y-auto font-mono text-xs leading-5"
          role="log"
          aria-live="polite"
        >
          {filteredLogs.length === 0 ? (
            <EmptyState
              title={logs.length === 0 ? 'Chưa có sự kiện nào' : 'Không có dòng nào khớp bộ lọc'}
              description={
                logs.length === 0
                  ? 'Nhật ký sẽ xuất hiện ngay khi các dịch vụ gửi sự kiện.'
                  : 'Thử chọn mức độ khác hoặc xóa từ khóa tìm kiếm.'
              }
            />
          ) : (
            filteredLogs.map((log, index) => {
              const p = parseLog(log);
              return (
                <div
                  key={`${log.timestamp}-${index}`}
                  className={`grid grid-cols-[64px_48px_1fr] sm:grid-cols-[76px_56px_84px_1fr] gap-3 px-4 py-1 hover:bg-white/[0.03] ${
                    log.level === 'error' ? 'bg-rose-500/[0.05]' : ''
                  }`}
                >
                  <span className="text-slate-300 tabular-nums">{p.time}</span>
                  <span className={`font-medium ${levelClass[p.level]}`}>{levelLabel[p.level]}</span>
                  <span className="hidden sm:block text-slate-300 truncate">{p.source}</span>
                  <span className="text-white break-words min-w-0">{p.message}</span>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between px-4 h-9 border-t border-line text-xs text-slate-300">
          <span>
            Hiển thị <span className="tabular-nums text-white">{filteredLogs.length}</span> /{' '}
            {logs.length} dòng
          </span>
          {!autoScroll && filteredLogs.length > 0 && (
            <button
              type="button"
              onClick={() => setAutoScroll(true)}
              className="text-blue-300 hover:text-white transition-colors"
            >
              Cuộn tới mới nhất
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TerminalLogs;
