import React, { useState } from 'react';
import {
  Terminal,
  AlertTriangle,
  Copy,
  Check,
  Cpu,
  Info,
  ShieldCheck,
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
    const base = 'cd badge-farm && python spoofer.py';
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
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0C14] p-5 sm:p-6 shadow-panel">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.1] via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Cày Giờ Chơi Hồ Sơ
            </h1>
            <span className="text-slate-600 font-light select-none text-xl">/</span>
            <span className="text-xs sm:text-sm font-semibold text-emerald-400">
              Telemetry Science Spoofer Mở Khóa Mốc Game &amp; Huy Hiệu
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.08] ml-1">
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

      <div className="panel p-6 space-y-3 border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Cơ Chế Hoạt Động Của Telemetry Science Spoofer
          </h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Script <code className="text-emerald-300 bg-white/[0.04] px-1.5 py-0.5 rounded font-mono">badge-farm/spoofer.py</code> gửi các event{' '}
          <code className="text-indigo-400 font-mono">launch_game</code> và <code className="text-indigo-400 font-mono">running_game_heartbeat</code> kèm chữ ký Windows PE Fingerprint. Discord ghi nhận số giờ này vào lịch sử chơi game của tài khoản mà không cần cài hay mở game thật.
        </p>
      </div>

      <div className="panel p-6 space-y-4 border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Trình Tạo Lệnh Khởi Chạy Tùy Biến</h3>
            <p className="text-xs text-slate-400 mt-0.5">Chọn chế độ và cấu hình tham số để tạo lệnh chạy PowerShell chính xác</p>
          </div>

          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setMode('playtime')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'playtime'
                  ? 'bg-white/[0.08] text-white border border-white/[0.1] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cày Giờ Chơi
            </button>
            <button
              onClick={() => setMode('played')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'played'
                  ? 'bg-white/[0.08] text-white border border-white/[0.1] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Đánh Dấu Game
            </button>
            <button
              onClick={() => setMode('both')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'both'
                  ? 'bg-white/[0.08] text-white border border-white/[0.1] font-semibold'
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
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
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
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        )}

        <div className="relative group">
          <pre className="bg-[#070910] p-4 rounded-xl font-mono text-xs text-emerald-300 border border-white/[0.08] overflow-x-auto leading-relaxed shadow-panel">
            {getCommand()}
          </pre>
          <button
            onClick={() => copyCommand(getCommand())}
            className="absolute top-3 right-3 btn-secondary py-1.5 px-3 text-xs"
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

      <div className="panel p-6 space-y-4 border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-white">
            Hướng Dẫn Chạy Script Trên PowerShell / Terminal
          </h3>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="panel-subtle p-3.5 rounded-xl space-y-1 border-white/[0.06]">
            <span className="font-bold text-slate-200">Bước 1: Mở PowerShell và dán lệnh đã sao chép ở trên</span>
            <p className="text-[11px] text-slate-400">
              Script sẽ tự động khởi động và hiển thị menu tương tác trong terminal.
            </p>
          </div>

          <div className="panel-subtle p-3.5 rounded-xl space-y-1 border-white/[0.06]">
            <span className="font-bold text-slate-200">Bước 2: Cung cấp thông tin xác thực lần đầu</span>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 pl-1">
              <li><strong>User Token:</strong> Token Discord của bạn (được lưu an toàn vào file <code className="text-slate-300 font-mono">science_state.json</code>).</li>
              <li><strong>cf_clearance:</strong> Cookie xác thực nếu Discord Cloudflare yêu cầu.</li>
              <li><strong>Tùy chọn 5:</strong> Để tạo chữ ký Windows PE fingerprint hợp lệ.</li>
            </ul>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/[0.03] border border-amber-500/20 flex items-start gap-3 text-xs text-slate-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-slate-200">Chu kỳ cập nhật dữ liệu của Discord</p>
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
