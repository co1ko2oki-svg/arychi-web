import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  ArrowDown,
  Search,
  Copy,
  Download,
  Terminal,
} from 'lucide-react';
import { LogEntry } from '../types';
import { useToast } from './Toast';

interface TerminalLogsProps {
  logs: LogEntry[];
  onClear: () => void;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({ logs, onClear }) => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'success'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((l) => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (searchTerm.trim() && !l.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleCopyAll = () => {
    if (filteredLogs.length === 0) {
      toast.warning('Không có dòng log nào để sao chép');
      return;
    }
    const formatted = filteredLogs
      .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    toast.success(`Đã sao chép ${filteredLogs.length} dòng log vào clipboard!`);
  };

  const handleDownloadLog = () => {
    if (filteredLogs.length === 0) {
      toast.warning('Không có dòng log nào để xuất file');
      return;
    }
    const formatted = filteredLogs
      .map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
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
    toast.info('Đã xóa bộ nhớ log hiển thị trên màn hình');
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0C14] p-5 sm:p-6 shadow-panel">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.1] via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Nhật Ký Hệ Thống
              </h1>
              <span className="text-slate-600 font-light select-none text-xl">/</span>
              <span className="text-xs sm:text-sm font-semibold text-cyan-400">
                Truy Vết Luồng Sự Kiện WebSocket Thời Gian Thực
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.08] ml-1">
                WebSocket Stream
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Truy vết trực tiếp các sự kiện phát sinh từ Quest Automation (:3001) và StreamBot Voice (:3000) với bộ lọc cấp độ và tìm kiếm nội dung.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`btn-secondary text-xs ${autoScroll ? 'border-cyan-500/40 text-cyan-300' : ''}`}
              title="Tự động cuộn xuống dòng mới nhất"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{autoScroll ? 'Auto-Scroll: Bật' : 'Auto-Scroll: Tắt'}</span>
            </button>

            <button
              onClick={handleCopyAll}
              className="btn-secondary text-xs"
              title="Sao chép toàn bộ dòng log đang lọc vào clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao Chép Tất Cả</span>
            </button>

            <button
              onClick={handleDownloadLog}
              className="btn-secondary text-xs"
              title="Tải về file nhật ký .log"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất File</span>
            </button>

            <button
              onClick={handleClear}
              className="btn-danger text-xs"
              title="Xóa bộ đệm log hiện tại"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Bộ Đệm</span>
            </button>
          </div>
        </div>
      </div>

      <div className="panel p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-white/[0.08]">
        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Lọc sự kiện theo từ khóa..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              ['all', 'Tất Cả'],
              ['info', 'Info'],
              ['warn', 'Warning'],
              ['error', 'Error'],
              ['success', 'Success'],
            ] as const
          ).map(([lvl, label]) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap ${
                filter === lvl
                  ? 'bg-white/[0.08] text-white border border-white/[0.12] font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden border-white/[0.08] shadow-panel bg-[#05060A]">
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="font-mono text-[11px] text-slate-400 ml-2">console.log — arychi-daemon-stdout</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">{filteredLogs.length} sự kiện</span>
        </div>

        <div className="p-4 font-mono text-xs space-y-1.5 max-h-[560px] overflow-y-auto leading-relaxed">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-slate-500">
              <Terminal className="w-7 h-7 mx-auto opacity-40" />
              <p className="italic">Chưa có thông điệp nhật ký nào được ghi lại...</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const color =
                log.level === 'error'
                  ? 'text-rose-400 font-bold'
                  : log.level === 'warn'
                  ? 'text-amber-400'
                  : log.level === 'success'
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-300';

              return (
                <div key={index} className="flex items-start gap-2.5 text-[11px] hover:bg-white/[0.02] py-0.5 px-1.5 rounded">
                  <span className="text-slate-500 select-none shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`uppercase shrink-0 ${color}`}>
                    [{log.level}]
                  </span>
                  <span className="text-slate-300 break-all">{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default TerminalLogs;
