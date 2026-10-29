import React, { useState } from 'react';
import {
  Terminal,
  AlertTriangle,
  Copy,
  Check,
  Cpu,
  Info,
} from 'lucide-react';
import { useToast } from './Toast';

export const BadgeDashboard: React.FC = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [hours, setHours] = useState('50');
  const [threads, setThreads] = useState('2');
  const [mode, setMode] = useState<'playtime' | 'played' | 'both'>('playtime');

  const parsedHours = Math.max(1, Math.min(5000, parseInt(hours, 10) || 1));
  const parsedThreads = Math.max(1, Math.min(10, parseInt(threads, 10) || 1));

  const getCommand = () => {
    const base = 'cd "bage fam" && python spoofer.py';
    if (mode === 'playtime') {
      return `${base} --hours ${parsedHours} --threads ${parsedThreads}`;
    }
    if (mode === 'played') {
      return `${base} --mark-played 1000`;
    }
    return `${base} --hours ${parsedHours} --threads ${parsedThreads} --mark-played 500`;
  };

  const copyCommand = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Đã sao chép lệnh khởi chạy vào clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-surface-1 p-5 sm:p-6 shadow-panel">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.08] via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Cày Giờ Chơi Hồ Sơ
            </h1>
            <span className="text-slate-600 font-light select-none text-xl">/</span>
            <span className="text-sm sm:text-base font-normal text-emerald-400">
              Telemetry Science Spoofer Mở Khóa Mốc Game &amp; Huy Hiệu
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2 text-slate-400 border border-white/[0.06] ml-1">
              Python 3 Module
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Gửi các gói tin telemetry giả lập trực tiếp đến endpoint{' '}
            <code className="text-emerald-400 font-mono">/api/v9/science</code> kèm chữ ký Windows PE Fingerprint
            để tăng giờ chơi và mở khóa mốc game trên trang cá nhân Discord.
          </p>
        </div>
      </div>

      {/* Mechanism explanation */}
      <div className="panel p-5 space-y-3">
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span>Cơ Chế Hoạt Động Của Telemetry Science Spoofer</span>
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Script <code className="text-slate-200 bg-surface-2 px-1.5 py-0.5 rounded font-mono">bage fam/spoofer.py</code> gửi các event{' '}
          <code className="text-indigo-400">launch_game</code> và <code className="text-indigo-400">running_game_heartbeat</code> kèm chữ ký Windows PE Fingerprint. Discord ghi nhận số giờ này vào lịch sử chơi game của tài khoản mà không cần cài hay mở game thật.
        </p>
      </div>

      {/* Command Generator */}
      <div className="panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Trình Tạo Lệnh Khởi Chạy Tùy Biến</h3>
            <p className="text-xs text-slate-400 mt-0.5">Chọn chế độ và cấu hình tham số để tạo lệnh chạy PowerShell chính xác</p>
          </div>

          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-lg border border-white/[0.06]">
            <button
              onClick={() => setMode('playtime')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                mode === 'playtime'
                  ? 'bg-surface-0 text-slate-100 border border-white/[0.1] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cày Giờ Chơi
            </button>
            <button
              onClick={() => setMode('played')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                mode === 'played'
                  ? 'bg-surface-0 text-slate-100 border border-white/[0.1] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Đánh Dấu Game
            </button>
            <button
              onClick={() => setMode('both')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                mode === 'both'
                  ? 'bg-surface-0 text-slate-100 border border-white/[0.1] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Combo Cả Hai
            </button>
          </div>
        </div>

        {mode !== 'played' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Số Giờ Muốn Cày (--hours)
                </label>
                <span className="text-[10px] text-slate-500 font-mono">1 – 5,000h</span>
              </div>
              <input
                type="number"
                min="1"
                max="5000"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full bg-surface-2 border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Số Luồng Song Song (--threads)
                </label>
                <span className="text-[10px] text-slate-500 font-mono">1 – 10 luồng</span>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
                className="w-full bg-surface-2 border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        )}

        <div className="relative group">
          <pre className="bg-[#06070a] p-3.5 rounded-lg font-mono text-xs text-indigo-300 border border-white/[0.08] overflow-x-auto leading-relaxed">
            {getCommand()}
          </pre>
          <button
            onClick={() => copyCommand(getCommand())}
            className="absolute top-2.5 right-2.5 btn-secondary py-1 px-2.5 text-xs"
            title="Sao chép lệnh vào clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Guide */}
      <div className="panel p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span>Hướng Dẫn Chạy Script Trên PowerShell / Terminal</span>
        </h3>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="panel-subtle p-3 rounded-lg space-y-1">
            <span className="font-semibold text-slate-200">Bước 1: Mở PowerShell và dán lệnh đã sao chép ở trên</span>
            <p className="text-[11px] text-slate-400">
              Script sẽ tự động khởi động và hiển thị menu tương tác trong terminal.
            </p>
          </div>

          <div className="panel-subtle p-3 rounded-lg space-y-1">
            <span className="font-semibold text-slate-200">Bước 2: Cung cấp thông tin xác thực lần đầu</span>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 pl-1">
              <li><strong>User Token:</strong> Token Discord của bạn (được lưu an toàn vào file <code className="text-slate-300">science_state.json</code>).</li>
              <li><strong>cf_clearance:</strong> Cookie xác thực nếu Discord Cloudflare yêu cầu.</li>
              <li><strong>Tùy chọn 5:</strong> Để tạo chữ ký Windows PE fingerprint hợp lệ.</li>
            </ul>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-surface-2 border border-white/[0.06] flex items-start gap-2.5 text-xs text-slate-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-200">Chu kỳ cập nhật dữ liệu của Discord</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Dữ liệu telemetry được Discord xử lý theo lô. Huy hiệu giờ chơi và danh sách game trên hồ sơ cá nhân thường xuất hiện sau 24 đến 48 giờ kể từ khi hoàn tất gửi heartbeat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeDashboard;
