import React, { useState } from 'react';
import {
  Sparkles,
  Tv,
  Award,
  Terminal,
  Server,
  ShieldCheck,
  Cpu,
  Lock,
  Layers,
  HardDrive,
  Workflow,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Code2,
  Activity,
  Zap,
  Globe,
  Clock,
} from 'lucide-react';
import { NavTabId } from './Navbar';

interface AboutPageProps {
  questConnected: boolean;
  streamConnected: boolean;
  onNavigateTab: (tab: NavTabId) => void;
  onOpenLoginModal: () => void;
  isLoggedIn: boolean;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  questConnected,
  streamConnected,
  onNavigateTab,
  onOpenLoginModal,
  isLoggedIn,
}) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-16 py-6 max-w-5xl mx-auto">
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Arychi Suite v2.0.0</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-medium text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Localhost • Zero External Cloud</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono font-medium text-indigo-300">
            <Zap className="w-3.5 h-3.5" />
            <span>Full Automation Engine</span>
          </span>
        </div>

        <div className="space-y-3 max-w-3xl">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Giới Thiệu Arychi Suite
          </h1>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed font-normal">
            Nền tảng tự động hóa Discord hợp nhất chạy trực tiếp trên thiết bị cá nhân của bạn. Gom toàn bộ các công cụ mạnh mẽ vào một giao diện Web duy nhất, xử lý qua kết nối nội bộ Loopback 127.0.0.1.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {isLoggedIn ? (
            <button
              onClick={() => onNavigateTab('home')}
              className="btn-primary py-2.5 px-5 text-xs sm:text-sm"
            >
              <span>Mở Bảng Điều Khiển</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="btn-primary py-2.5 px-5 text-xs sm:text-sm"
            >
              <span>Kết Nối Tài Khoản Discord</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onNavigateTab('quests')}
            className="btn-secondary py-2.5 px-4 text-xs sm:text-sm"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Làm Nhiệm Vụ Ngay</span>
          </button>

          <button
            onClick={() => onNavigateTab('stream')}
            className="btn-secondary py-2.5 px-4 text-xs sm:text-sm"
          >
            <Tv className="w-4 h-4 text-amber-400" />
            <span>Stream Kênh Thoại</span>
          </button>
        </div>

        <div className="pt-4 border-t border-white/[0.06] flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          {[
            { id: 'sec-status', label: 'Trạng Thái' },
            { id: 'sec-modules', label: '3 Trụ Cột Kỹ Thuật' },
            { id: 'sec-arch', label: 'Kiến Trúc & Cổng Mạng' },
            { id: 'sec-security', label: 'Bảo Mật & Riêng Tư' },
            { id: 'sec-specs', label: 'Thông Số Môi Trường' },
            { id: 'sec-history', label: 'Lịch Sử Phiên Bản' },
            { id: 'sec-faq', label: 'FAQ Kỹ Thuật' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="px-3 py-1.5 rounded-lg whitespace-nowrap text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section id="sec-status" className="glass-panel rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Vận Hành Thiết Bị Nội Bộ (127.0.0.1)</h2>
            <p className="text-xs text-slate-400 font-mono">Đồng bộ hai chiều thời gian thực qua WebSocket</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            Quest :3001 {questConnected ? 'Online' : 'Offline'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
            Stream :3000 {streamConnected ? 'Live' : 'Standby'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5 text-indigo-400">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Science Ready
          </span>
        </div>
      </section>

      <section id="sec-modules" className="space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            Module Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            3 Trụ Cột Kỹ Thuật Độc Lập
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase">Module 01</span>
                <span className="text-xs font-mono text-slate-500">Port :3001</span>
              </div>
              <h3 className="text-base font-bold text-white">Quest Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Giải pháp cày nhiệm vụ Discord Quests tự động không cần cài đặt game dung lượng lớn. Hệ thống giả lập các gói tin Heartbeat định kỳ gửi đến máy chủ Discord theo đúng định dạng ứng dụng Desktop.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-300 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Mô phỏng Heartbeat 30s chuẩn RFC</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Dừng ngay với AbortController</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Tự động nhận thưởng (Claim Reward)</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-white/[0.06]">
              <span className="text-[11px] font-mono text-slate-500">Node.js + Fastify + WS</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">Module 02</span>
                <span className="text-xs font-mono text-slate-500">Port :3000</span>
              </div>
              <h3 className="text-base font-bold text-white">StreamBot Voice</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hệ thống truyền phát âm thanh chuẩn Opus và video vào kênh đàm thoại Voice Channel 24/7, tích hợp module Viewer Farm duy trì thời lượng xem stream cho tài khoản mà không bị gián đoạn.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-300 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Đa nguồn: YouTube, Twitch, MP4</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Bộ mã hóa FFmpeg + yt-dlp tối ưu CPU</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Viewer Farm tự động farm phút xem</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-white/[0.06]">
              <span className="text-[11px] font-mono text-slate-500">@discordjs/voice + FFmpeg</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">Module 03</span>
                <span className="text-xs font-mono text-slate-500">Python Engine</span>
              </div>
              <h3 className="text-base font-bold text-white">Science Telemetry</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bộ công cụ giả lập nhịp độ chơi game gửi trực tiếp lên cổng phân tích Discord Science API với chữ ký Windows PE nhị phân thực tế để cày huy hiệu và số giờ chơi hồ sơ.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-300 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Trích xuất Windows PE Fingerprint</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Gửi gói tin /api/v9/science</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Cộng dồn số giờ chơi trên Activity Profile</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-white/[0.06]">
              <span className="text-[11px] font-mono text-slate-500">Python 3 + PE Header Hash</span>
            </div>
          </div>
        </div>
      </section>

      <section id="sec-arch" className="space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            Data Flow &amp; Ports
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Kiến Trúc &amp; Danh Mục Cổng Mạng
          </h2>
        </div>

        <div className="glass-panel rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-indigo-400">TẦNG 01: FRONTEND</span>
              <h3 className="text-sm font-bold text-white">Web Dashboard (:5173)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                React 18 + Vite SPA, lưu trữ token trong localStorage trình duyệt của người dùng.
              </p>
            </div>

            <div className="pt-4 md:pt-0 md:pl-6 space-y-2">
              <span className="text-xs font-mono font-bold text-amber-400">TẦNG 02: CỤC BỘ</span>
              <h3 className="text-sm font-bold text-white">Local Services (127.0.0.1)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Quest Engine (:3001), StreamBot Voice (:3000) và Python Spoofer xử lý tác vụ không trung gian.
              </p>
            </div>

            <div className="pt-4 md:pt-0 md:pl-6 space-y-2">
              <span className="text-xs font-mono font-bold text-emerald-400">TẦNG 03: ĐÍCH ĐẾN</span>
              <h3 className="text-sm font-bold text-white">Discord API Endpoints</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                HTTPS TLS 1.3 kết nối trực tiếp đến các endpoint chính thức: /quests, /science, Voice RTC.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06] divide-y divide-white/[0.04] text-xs">
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-mono text-indigo-400 font-bold">5173 (TCP) &bull; Vite Frontend</span>
              <span className="text-slate-400">Giao diện điều khiển SPA (React 18, Tailwind CSS)</span>
              <span className="text-emerald-400 font-mono text-[11px]">Chỉ mở trên Localhost</span>
            </div>
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-mono text-indigo-400 font-bold">3001 (TCP/WS) &bull; Quest Daemon</span>
              <span className="text-slate-400">Fastify REST API &amp; WebSocket Server cho tiến trình Quest</span>
              <span className="text-emerald-400 font-mono text-[11px]">Đồng bộ realtime</span>
            </div>
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-mono text-indigo-400 font-bold">3000 (TCP/WS) &bull; StreamBot Service</span>
              <span className="text-slate-400">Node.js Web API, FFmpeg stream pipeline và Voice Gateway</span>
              <span className="text-emerald-400 font-mono text-[11px]">Quản lý Voice Stream</span>
            </div>
          </div>
        </div>
      </section>

      <section id="sec-security" className="space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            Security &amp; Privacy
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Cam Kết Bảo Mật &amp; Quyền Riêng Tư
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="card-interactive p-6 space-y-2.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>Không Lưu Trữ Cloud &bull; Client-Side Only</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Discord User Token chỉ lưu trong bộ nhớ trình duyệt và RAM tiến trình nội bộ máy bạn. Arychi không sở hữu bất kỳ cơ sở dữ liệu trên mây nào để thu thập dữ liệu người dùng.
            </p>
          </div>

          <div className="card-interactive p-6 space-y-2.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Mô Phỏng Nhịp Độ Chuẩn (Anti-Rate Limit)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Các gói tin telemetry gửi đến Discord được thiết kế với chu kỳ đệm tự nhiên tương tự ứng dụng chính thức, không bắn dồn dập bất thường nhằm triệt tiêu nguy cơ vi phạm giới hạn tốc độ.
            </p>
          </div>

          <div className="card-interactive p-6 space-y-2.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Không Cài Cắm Theo Dõi (Zero Analytics)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ứng dụng không nhúng bất kỳ đoạn mã theo dõi hành vi, Google Analytics, pixel quảng cáo hay dịch vụ báo cáo lỗi của bên thứ ba nào. Mã nguồn chạy sạch sẽ 100%.
            </p>
          </div>

          <div className="card-interactive p-6 space-y-2.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-400" />
              <span>Minh Bạch Mã Nguồn (Audit-Ready)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Toàn bộ source code TypeScript, Python và tệp thực thi đều nằm trực tiếp trên máy của bạn. Bạn hoàn toàn có thể mở bất kỳ tệp tin nào để kiểm tra, debug gói tin mạng.
            </p>
          </div>
        </div>
      </section>

      <section id="sec-specs" className="space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            System Requirements
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Thông Số Kỹ Thuật &amp; Yêu Cầu Môi Trường
          </h2>
        </div>

        <div className="glass-panel rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Yêu Cầu Phần Mềm Môi Trường</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-slate-400">Hệ Điều Hành</span>
                <span className="font-mono text-white">Windows 10/11 64-bit, Linux, macOS</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-slate-400">Node.js Runtime</span>
                <span className="font-mono text-white">&gt;= v18.16.0 LTS (Khuyến nghị v20+)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-slate-400">Python Runtime</span>
                <span className="font-mono text-white">&gt;= 3.10.x</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Công cụ bổ trợ</span>
                <span className="font-mono text-white">FFmpeg, yt-dlp (đã tích hợp sẵn)</span>
              </div>
            </div>
          </div>

          <div className="pt-4 md:pt-0 md:pl-6 space-y-3">
            <h3 className="text-sm font-bold text-white">Hiệu Suất Tiêu Thụ Tài Nguyên</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-slate-400">RAM chiếm dụng</span>
                <span className="font-mono text-emerald-400 font-bold">~120MB – 250MB (Rất nhẹ)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-slate-400">CPU khi chạy Quests/Badges</span>
                <span className="font-mono text-emerald-400 font-bold">&lt; 1%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-slate-400">CPU khi phát StreamBot</span>
                <span className="font-mono text-indigo-400 font-bold">2% – 5%</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Khởi chạy toàn bộ</span>
                <span className="font-mono text-white">1-click qua start.bat</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="sec-history" className="space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            Changelog &amp; Roadmap
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Lịch Sử Phát Triển
          </h2>
        </div>

        <div className="relative pl-6 border-l border-white/[0.1] space-y-8">
          <div className="relative space-y-2">
            <span className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-indigo-500 ring-4 ring-[#030407]" />
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                v2.0.0
              </span>
              <h3 className="text-sm font-bold text-white">Hợp Nhất Toàn Diện &bull; Astral UI Overhaul</h3>
              <span className="text-[11px] font-mono text-slate-500 ml-auto">Hiện tại</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside">
              <li>Xây dựng trung tâm điều khiển Web hợp nhất với React 18, Vite 5 và Tailwind CSS.</li>
              <li>Tái thiết kế toàn diện theo cảm hứng giao diện AstralBot (loại bỏ sidebar cố định, thiết lập top navigation thoáng đãng).</li>
              <li>Tích hợp cơ chế kênh đôi WebSocket đồng bộ tiến độ Quest và Stream thời gian thực.</li>
              <li>Tích hợp module Science Telemetry cày giờ chơi game hồ sơ qua chữ ký PE Fingerprint.</li>
            </ul>
          </div>

          <div className="relative space-y-2">
            <span className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-[#030407]" />
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                v1.5.0
              </span>
              <h3 className="text-sm font-bold text-white">Nâng Cấp StreamBot Voice &amp; Viewer Farm</h3>
            </div>
            <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside">
              <li>Tích hợp yt-dlp và FFmpeg tự động giải mã video phòng thoại không giật lag.</li>
              <li>Bổ sung module Viewer Farm tự động giữ kết nối phòng thoại để cày điều kiện stream.</li>
            </ul>
          </div>

          <div className="relative space-y-2">
            <span className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-slate-600 ring-4 ring-[#030407]" />
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-white/[0.05] text-slate-400 font-mono text-xs font-bold border border-white/[0.08]">
                v1.0.0
              </span>
              <h3 className="text-sm font-bold text-white">Bản Khởi Đầu &bull; Độc Lập Quest CLI</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Phiên bản thử nghiệm đầu tiên thực hiện các gói heartbeat cho nhiệm vụ Discord Quests thông qua dòng lệnh.
            </p>
          </div>
        </div>
      </section>

      <section id="sec-faq" className="space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            FAQ
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Giải Đáp Kỹ Thuật (FAQ)
          </h2>
        </div>

        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {[
            {
              q: 'Tôi có thể tắt tab trình duyệt khi hệ thống đang làm Quest hoặc Stream không?',
              a: 'Có thể. Các engine xử lý chính (Quest Engine :3001 và StreamBot :3000) chạy dưới dạng tiến trình độc lập trên máy tính của bạn sau khi bạn mở start.bat. Bạn hoàn toàn có thể thu nhỏ hoặc đóng tab trình duyệt; các tiến trình vẫn tiếp tục chạy ngầm cho đến khi hoàn thành.',
            },
            {
              q: 'Tại sao việc cày Discord Quest không cần phải tải game nặng?',
              a: 'Ứng dụng Discord Desktop chính thức xác nhận tiến độ làm nhiệm vụ bằng việc gửi các gói tin telemetry định kỳ (heartbeat) chứa ID nhiệm vụ và chữ ký phiên lên máy chủ Discord. Quest Engine mô phỏng chuẩn xác định dạng gói tin này với nhịp độ 30 giây một lần, giúp bạn không cần tốn hàng giờ tải và cài đặt 50GB-100GB game.',
            },
            {
              q: 'Lấy token Discord có an toàn không và lấy ở đâu?',
              a: 'Token Discord của bạn đóng vai trò như chìa khóa xác thực tài khoản. Trên giao diện web Discord, bạn mở F12 > chuyển sang thẻ Network > tìm kiếm từ khóa "science" hoặc "quest" > sao chép giá trị trong trường Authorization. Hãy lưu ý không bao giờ gửi token này cho bất kỳ người lạ hoặc trang web trực tuyến nào. Arychi chỉ lưu token này tại máy tính cục bộ của bạn.',
            },
            {
              q: 'Có thể chạy đồng thời vừa làm Quest vừa phát nhạc/stream voice không?',
              a: 'Hoàn toàn được. Mỗi module trong Arychi Suite hoạt động trên một tiến trình Node.js riêng biệt và lắng nghe trên các cổng khác nhau (3001 cho Quest và 3000 cho Stream), vì vậy chúng hoạt động song song mượt mà mà không gây xung đột tài nguyên.',
            },
          ].map((item, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div key={idx} className="py-4">
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full text-left flex items-center justify-between text-sm font-bold text-slate-200 hover:text-white transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-4" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-3 text-xs text-slate-400 leading-relaxed max-w-3xl">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-2 text-xs text-slate-400">
        <p className="font-bold text-slate-300">Tuyên Bố Về Quyền Sở Hữu &amp; Miễn Trừ Trách Nhiệm</p>
        <p className="leading-relaxed text-[11px]">
          Arychi Suite được phát triển với mục đích học tập, nghiên cứu giao thức mạng và phục vụ tiện ích tự động hóa cá nhân trên máy trạm cục bộ. Dự án không liên kết, không được tài trợ hoặc xác nhận bởi Discord Inc. Người dùng tự chịu trách nhiệm về cách thức vận hành tài khoản của mình.
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
