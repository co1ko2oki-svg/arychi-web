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
  ExternalLink,
  Code2,
  Activity,
  Zap,
  Globe,
  Radio,
  Clock,
} from 'lucide-react';
import { NavTabId } from './Sidebar';

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
  const [activeTabSection, setActiveTabSection] = useState<'overview' | 'modules' | 'architecture' | 'security' | 'specs' | 'changelog' | 'faq'>('overview');

  const scrollToSection = (id: string, tab: 'overview' | 'modules' | 'architecture' | 'security' | 'specs' | 'changelog' | 'faq') => {
    setActiveTabSection(tab);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-10 py-4 max-w-5xl mx-auto">
      <section id="section-overview" className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-1 p-6 sm:p-10 space-y-6 shadow-panel">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_0%,rgba(99,102,241,0.12),transparent_70%)] pointer-events-none" />
        
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-white/[0.08] text-xs font-medium text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>Arychi Suite v2.0.0</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono font-medium text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Localhost &bull; Zero External Cloud</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-mono font-medium text-indigo-300">
              <Zap className="w-3.5 h-3.5" />
              <span>Full Automation Engine</span>
            </span>
          </div>

          <div className="space-y-2 max-w-3xl">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight leading-tight flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Giới Thiệu Arychi Suite</span>
              <span className="text-slate-600 font-light select-none text-2xl sm:text-3xl">/</span>
              <span className="text-indigo-400 text-xl sm:text-3xl font-bold">
                Nền Tảng Tự Động Hóa Discord Hợp Nhất
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed pt-1">
              Arychi Suite là giải pháp mã nguồn tự lưu trữ (self-hosted), gom toàn bộ các công cụ tự động hóa Discord mạnh mẽ nhất vào một giao diện Web duy nhất chạy trực tiếp trên máy tính nội bộ của bạn. Mọi tác vụ được xử lý thông qua kết nối cục bộ Loopback, loại bỏ hoàn toàn các rủi ro bảo mật từ các dịch vụ trung gian.
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
        </div>

        <nav aria-label="Điều hướng các mục giới thiệu" className="pt-4 border-t border-white/[0.06] flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          {[
            { id: 'section-overview', tab: 'overview' as const, label: 'Tổng Quan' },
            { id: 'section-modules', tab: 'modules' as const, label: '3 Trụ Cột Kỹ Thuật' },
            { id: 'section-architecture', tab: 'architecture' as const, label: 'Kiến Trúc & Dữ Liệu' },
            { id: 'section-security', tab: 'security' as const, label: 'Bảo Mật & Riêng Tư' },
            { id: 'section-specs', tab: 'specs' as const, label: 'Thông Số & Môi Trường' },
            { id: 'section-changelog', tab: 'changelog' as const, label: 'Lịch Sử & Roadmap' },
            { id: 'section-faq', tab: 'faq' as const, label: 'FAQ Kỹ Thuật' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id, item.tab)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                activeTabSection === item.tab
                  ? 'bg-surface-3 text-indigo-300 border border-white/[0.09]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      <section className="panel p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-slate-100">
                Trạng Thái Vận Hành Máy Trạm Nội Bộ
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Địa chỉ Loopback: 127.0.0.1 &bull; Đồng bộ tức thì qua WebSocket
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs font-mono">
            <div className="panel-subtle px-3 py-2 rounded-lg flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400">Quest Engine</span>
              <span className={`text-[11px] font-semibold flex items-center gap-1 mt-0.5 ${questConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                {questConnected ? ':3001 OK' : ':3001 Off'}
              </span>
            </div>

            <div className="panel-subtle px-3 py-2 rounded-lg flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400">StreamBot</span>
              <span className={`text-[11px] font-semibold flex items-center gap-1 mt-0.5 ${streamConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
                {streamConnected ? ':3000 Live' : ':3000 Standby'}
              </span>
            </div>

            <div className="panel-subtle px-3 py-2 rounded-lg flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400">Science Engine</span>
              <span className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Python Ready
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="section-modules" className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-slate-100">
            3 Trụ Cột Kỹ Thuật Độc Lập
          </h2>
          <span className="text-slate-600 font-light select-none text-sm">/</span>
          <span className="text-indigo-400 font-medium text-xs sm:text-sm">
            Tối Ưu Hóa Từng Thành Phần Theo Tiêu Chuẩn Giao Thức Discord
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="panel p-5 space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase">Module 01</span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-100">Quest Engine</h3>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-slate-400 border border-white/[0.06]">
                  Port :3001
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Giải pháp cày nhiệm vụ Discord Quests tự động không cần cài đặt game dung lượng lớn. Hệ thống giả lập các gói tin Heartbeat định kỳ gửi đến máy chủ Discord theo đúng định dạng ứng dụng Desktop.
              </p>

              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                  Đặc Điểm Kỹ Thuật
                </p>
                <ul className="space-y-1 text-xs text-slate-300">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Mô phỏng Heartbeat 30 giây chuẩn RFC</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Dừng ngay với cơ chế AbortController</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Tự động nhận thưởng (Claim Reward Code)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Không cần tải xuống 50GB-100GB dữ liệu</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400">Node.js + Fastify + WS</span>
              <button
                onClick={() => onNavigateTab('quests')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                <span>Xem nhiệm vụ</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="panel p-5 space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Tv className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">Module 02</span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-100">StreamBot Voice</h3>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-slate-400 border border-white/[0.06]">
                  Port :3000
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Hệ thống truyền phát âm thanh chuẩn Opus và video vào kênh đàm thoại Voice Channel 24/7, tích hợp module Viewer Farm duy trì thời lượng xem stream cho tài khoản mà không bị gián đoạn.
              </p>

              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                  Đặc Điểm Kỹ Thuật
                </p>
                <ul className="space-y-1 text-xs text-slate-300">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Giải mã đa nguồn: YouTube, Twitch, File MP4</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Trình mã hóa FFmpeg + yt-dlp tối ưu CPU</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Viewer Farm tự động farm phút xem stream</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Chế độ phát lặp vô hạn (Infinite Loop)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400">@discordjs/voice + FFmpeg</span>
              <button
                onClick={() => onNavigateTab('stream')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
              >
                <span>Bật phát voice</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="panel p-5 space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">Module 03</span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-100">Science Telemetry</h3>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-slate-400 border border-white/[0.06]">
                  Python Engine
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Bộ công cụ giả lập nhịp độ chơi game (Gaming Session Telemetry) gửi trực tiếp lên cổng phân tích Discord Science API với chữ ký Windows PE nhị phân thực tế để cày huy hiệu và số giờ chơi hồ sơ.
              </p>

              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                  Đặc Điểm Kỹ Thuật
                </p>
                <ul className="space-y-1 text-xs text-slate-300">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Trích xuất Windows PE Fingerprint thực tế</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Gửi gói tin trực tiếp /api/v9/science</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Cộng dồn số giờ chơi trên Activity Profile</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Mô phỏng thư viện game phong phú</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400">Python 3 + PE Header Hash</span>
              <button
                onClick={() => onNavigateTab('badges')}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
              >
                <span>Xem cấu hình</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="section-architecture" className="panel p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] via-transparent to-transparent pointer-events-none" />
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Workflow className="w-4 h-4 text-indigo-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Kiến Trúc Hệ Thống &amp; Luồng Dữ Liệu
            </h2>
            <span className="text-slate-600 font-light select-none text-sm">/</span>
            <span className="text-indigo-400 font-medium text-xs sm:text-sm">
              Mô Hình Tự Vận Hành Nội Bộ (Local-First Architecture)
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            Arychi Suite vận hành theo mô hình ba tầng khép kín: Trình duyệt người dùng (Front-end), cụm tiến trình xử lý cục bộ (Local Backend) và máy chủ chính thức của Discord (Official Discord API). Không có bất kỳ máy chủ bên thứ ba nào can thiệp vào luồng truyền tin.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="panel-subtle p-4 rounded-xl space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                Tầng 01 &bull; Giao Diện
              </span>
              <span className="text-[10px] font-mono text-slate-400">:5173</span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100">Web Dashboard</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                React 18, Vite &amp; Tailwind CSS. Lưu trữ User Token mã hóa tại <code className="text-indigo-300 font-mono">localStorage</code> trình duyệt.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-1 border border-white/[0.04] text-[11px] font-mono text-slate-400 space-y-1">
              <div>&bull; WebSocket Client (:3001 &amp; :3000)</div>
              <div>&bull; Quản lý trạng thái đa tiến trình</div>
              <div>&bull; Bảng điều khiển thời gian thực</div>
            </div>
          </div>

          <div className="panel-subtle p-4 rounded-xl space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                Tầng 02 &bull; Cục Bộ
              </span>
              <span className="text-[10px] font-mono text-slate-400">127.0.0.1</span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100">Local Backend Services</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Tập hợp tiến trình Node.js &amp; Python chạy ngầm. Xử lý logic giải mã gói tin, FFmpeg audio codec và heartbeat timers.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-1 border border-white/[0.04] text-[11px] font-mono text-slate-400 space-y-1">
              <div>&bull; Quest Automation Daemon (:3001)</div>
              <div>&bull; StreamBot Voice Engine (:3000)</div>
              <div>&bull; Python PE Telemetry Spoofer</div>
            </div>
          </div>

          <div className="panel-subtle p-4 rounded-xl space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                Tầng 03 &bull; Đích Đến
              </span>
              <span className="text-[10px] font-mono text-slate-400">HTTPS TLS 1.3</span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100">Discord Official Endpoints</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Kết nối mã hóa đầu-cuối trực tiếp từ máy trạm đến hạ tầng Discord. Nhận token và cập nhật dữ liệu tài khoản chính chủ.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-1 border border-white/[0.04] text-[11px] font-mono text-slate-400 space-y-1">
              <div>&bull; /api/v9/quests/&lt;id&gt;/heartbeat</div>
              <div>&bull; /api/v9/science (Game metrics)</div>
              <div>&bull; Discord Voice RTC Gateway</div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <div className="panel-subtle overflow-hidden rounded-xl">
            <div className="p-3 bg-surface-2 border-b border-white/[0.06] flex items-center justify-between text-xs font-semibold text-slate-200">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>Bảng Danh Mục Cổng Mạng (Port Map) &amp; Giao Thức</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Cục Bộ 100% Loopback</span>
            </div>
            <div className="divide-y divide-white/[0.04] text-xs">
              <div className="p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-slate-300">
                <span className="font-mono text-indigo-400 font-bold">5173 (TCP)</span>
                <span>Giao diện Web Frontend</span>
                <span className="text-slate-400 font-mono">Vite + React SPA</span>
                <span className="text-emerald-400 font-mono text-[11px]">Chỉ mở trên Localhost</span>
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-slate-300">
                <span className="font-mono text-indigo-400 font-bold">3001 (TCP/WS)</span>
                <span>Quest Engine Daemon</span>
                <span className="text-slate-400 font-mono">Fastify + WebSocket Server</span>
                <span className="text-emerald-400 font-mono text-[11px]">Đồng bộ tiến độ Quest realtime</span>
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-slate-300">
                <span className="font-mono text-indigo-400 font-bold">3000 (TCP/WS)</span>
                <span>StreamBot Voice Service</span>
                <span className="text-slate-400 font-mono">Node.js + @discordjs/voice</span>
                <span className="text-emerald-400 font-mono text-[11px]">Quản lý Voice Stream &amp; Farm</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="section-security" className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-slate-100">
            Cam Kết Bảo Mật &amp; Quyền Riêng Tư
          </h2>
          <span className="text-slate-600 font-light select-none text-sm">/</span>
          <span className="text-emerald-400 font-medium text-xs sm:text-sm">
            Bảo Vệ Tài Khoản Tuyệt Đối Từ Thiết Kế Hệ Thống
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="panel p-5 space-y-2.5 relative overflow-hidden">
            <div className="flex items-center gap-2 text-indigo-400">
              <Lock className="w-4 h-4 shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-slate-100">Không Lưu Trữ Cloud &bull; Client-Side Only</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Discord User Token của bạn chỉ được lưu trong bộ nhớ máy trạm (LocalStorage trình duyệt và biến cục bộ trong RAM của backend). Arychi không sở hữu bất kỳ cơ sở dữ liệu trên mây nào để thu thập dữ liệu người dùng.
            </p>
          </div>

          <div className="panel p-5 space-y-2.5 relative overflow-hidden">
            <div className="flex items-center gap-2 text-emerald-400">
              <Zap className="w-4 h-4 shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-slate-100">Mô Phỏng Nhịp Độ Chuẩn (Anti-Rate Limit)</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Các gói tin telemetry gửi đến Discord được thiết kế với chu kỳ đệm tự nhiên tương tự ứng dụng chính thức, không bắn dồn dập bất thường nhằm triệt tiêu nguy cơ vi phạm giới hạn tốc độ (HTTP 429).
            </p>
          </div>

          <div className="panel p-5 space-y-2.5 relative overflow-hidden">
            <div className="flex items-center gap-2 text-cyan-400">
              <Globe className="w-4 h-4 shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-slate-100">Không Cài Cắm Theo Dõi (Zero Analytics)</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ứng dụng không nhúng bất kỳ đoạn mã theo dõi hành vi, Google Analytics, pixel quảng cáo hay dịch vụ báo cáo lỗi của bên thứ ba nào. Mã nguồn chạy sạch sẽ 100%.
            </p>
          </div>

          <div className="panel p-5 space-y-2.5 relative overflow-hidden">
            <div className="flex items-center gap-2 text-amber-400">
              <Code2 className="w-4 h-4 shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-slate-100">Minh Bạch Mã Nguồn (Audit-Ready)</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Toàn bộ source code TypeScript, Python và tệp thực thi đều nằm trực tiếp trên máy của bạn. Bạn hoàn toàn có thể mở bất kỳ tệp tin nào để kiểm tra, debug gói tin mạng hoặc mở tab F12 Network để giám sát.
            </p>
          </div>
        </div>
      </section>

      <section id="section-specs" className="panel p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Thông Số Kỹ Thuật &amp; Yêu Cầu Môi Trường
            </h2>
            <span className="text-slate-600 font-light select-none text-sm">/</span>
            <span className="text-indigo-400 font-medium text-xs sm:text-sm">
              Tương Thích Mọi Môi Trường Máy Trạm Cá Nhân
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Hệ thống được tối ưu hóa cực kỳ nhẹ, chiếm dụng tài nguyên CPU và RAM tối thiểu để bạn có thể thoải mái vừa vận hành suite vừa chơi game hoặc làm việc.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="panel-subtle p-4 rounded-xl space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              <span>Yêu Cầu Phần Mềm Môi Trường</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Hệ Điều Hành</span>
                <span className="font-mono text-slate-200">Windows 10/11 64-bit, Linux, macOS</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Node.js Runtime</span>
                <span className="font-mono text-slate-200">&gt;= v18.16.0 LTS (Khuyến nghị v20+)</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Python Runtime</span>
                <span className="font-mono text-slate-200">&gt;= 3.10.x</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Công cụ bổ trợ</span>
                <span className="font-mono text-slate-200">FFmpeg, yt-dlp (đã tích hợp)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Trình duyệt web</span>
                <span className="font-mono text-slate-200">Chrome, Edge, Firefox, Brave</span>
              </div>
            </div>
          </div>

          <div className="panel-subtle p-4 rounded-xl space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Hiệu Suất Tiêu Thụ Tài Nguyên</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Dung lượng RAM chiếm dụng</span>
                <span className="font-mono text-emerald-400 font-semibold">~120MB &bull; 250MB (Rất nhẹ)</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Mức sử dụng CPU cơ bản</span>
                <span className="font-mono text-emerald-400 font-semibold">&lt; 1% (Khi chỉ chạy Quest/Badge)</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04]">
                <span className="text-slate-400">CPU khi phát StreamBot</span>
                <span className="font-mono text-indigo-400 font-semibold">2% &bull; 5% (Tùy độ phân giải video)</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Băng thông mạng yêu cầu</span>
                <span className="font-mono text-slate-200">&gt;= 5 Mbps (Cho StreamBot Voice)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Khởi động hệ thống</span>
                <span className="font-mono text-slate-200">1-click qua start-all.bat</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="section-changelog" className="panel p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Lịch Sử Phát Triển &amp; Lộ Trình (Changelog)
            </h2>
            <span className="text-slate-600 font-light select-none text-sm">/</span>
            <span className="text-indigo-400 font-medium text-xs sm:text-sm">
              Tiến Trình Cải Tiến Phiên Bản
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel-subtle p-4.5 rounded-xl border-l-2 border-l-indigo-500 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                  v2.0.0
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-100">
                  Hợp Nhất Toàn Diện &bull; Dark UI Công Nghiệp
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Phiên bản hiện tại</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
              <li>Xây dựng trung tâm điều khiển Web hợp nhất với React 18, Vite 5 và Tailwind CSS.</li>
              <li>Tích hợp cơ chế kênh đôi WebSocket đồng bộ tiến độ cày Quest và trạng thái Stream thời gian thực.</li>
              <li>Hệ thống cảnh báo Toast đa tầng, bảng điều khiển nhật ký thiết bị dạng Terminal tương tác.</li>
              <li>Bổ sung tính năng cày giờ chơi game hồ sơ qua module Science Telemetry.</li>
            </ul>
          </div>

          <div className="panel-subtle p-4 rounded-xl border-l-2 border-l-amber-500/60 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                  v1.5.0
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-200">
                  Nâng Cấp StreamBot Voice &amp; Viewer Farm
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Lịch sử</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside">
              <li>Tích hợp yt-dlp bản sửa lỗi thuật toán YouTube và chống trễ tiếng.</li>
              <li>Bổ sung module Viewer Farm tự động giữ người xem trong phòng thoại để cày điều kiện stream.</li>
              <li>Cải tiến trình quản lý danh sách hàng đợi (Queue Manager) và vòng lặp vô hạn.</li>
            </ul>
          </div>

          <div className="panel-subtle p-4 rounded-xl border-l-2 border-l-slate-600 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-surface-2 text-slate-400 font-mono text-xs font-bold border border-white/[0.06]">
                  v1.0.0
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-300">
                  Bản Khởi Đầu &bull; Độc Lập Quest CLI
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Lịch sử</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Phiên bản thử nghiệm đầu tiên thực hiện các gói heartbeat cho nhiệm vụ Discord Quests thông qua dòng lệnh.
            </p>
          </div>
        </div>
      </section>

      <section id="section-faq" className="panel p-6 sm:p-8 space-y-4 relative overflow-hidden">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Giải Đáp Kỹ Thuật Chuyên Sâu (FAQ)
            </h2>
            <span className="text-slate-600 font-light select-none text-sm">/</span>
            <span className="text-indigo-400 font-medium text-xs sm:text-sm">
              Những Câu Hỏi Thường Gặp Về Vận Hành &amp; An Toàn
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          {[
            {
              q: 'Tôi có thể tắt tab trình duyệt khi hệ thống đang làm Quest hoặc Stream không?',
              a: 'Có thể. Các engine xử lý chính (Quest Engine :3001 và StreamBot :3000) chạy dưới dạng tiến trình độc lập trên máy tính của bạn sau khi bạn mở start-all.bat. Bạn hoàn toàn có thể thu nhỏ hoặc đóng tab trình duyệt; các tiến trình vẫn tiếp tục chạy ngầm cho đến khi hoàn thành.',
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
            {
              q: 'Tôi cần làm gì khi YouTube cập nhật thuật toán khiến StreamBot không phát được?',
              a: 'Bạn chỉ cần mở cửa sổ dòng lệnh trong thư mục "stream" và chạy lệnh cập nhật yt-dlp, hoặc hệ thống sẽ tự động cập nhật binary yt-dlp mới nhất khi khởi động lại backend.',
            },
          ].map((item, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div key={idx} className="panel-subtle overflow-hidden rounded-lg">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full p-3.5 text-left flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5 text-xs text-slate-400 leading-relaxed border-t border-white/[0.04] pt-2.5">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="p-4 rounded-xl border border-white/[0.06] bg-surface-1/50 space-y-2 text-xs text-slate-400">
        <p className="font-semibold text-slate-300">Tuyên Bố Về Quyền Sở Hữu &amp; Miễn Trừ Trách Nhiệm</p>
        <p className="leading-relaxed text-[11px]">
          Arychi Suite được phát triển với mục đích học tập, nghiên cứu giao thức mạng và phục vụ tiện ích tự động hóa cá nhân trên máy trạm cục bộ. Dự án không liên kết, không được tài trợ hoặc xác nhận bởi Discord Inc. Người dùng tự chịu trách nhiệm về cách thức vận hành tài khoản của mình.
        </p>
      </section>

      <footer className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">Arychi Suite v2.0.0</span>
          <span>&bull;</span>
          <span>Localhost Automation Environment</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <button
            type="button"
            onClick={() => onNavigateTab('home')}
            className="hover:text-indigo-400 transition-colors"
          >
            Tổng Quan
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('quests')}
            className="hover:text-indigo-400 transition-colors"
          >
            Nhiệm Vụ
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('stream')}
            className="hover:text-indigo-400 transition-colors"
          >
            StreamBot
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('logs')}
            className="hover:text-indigo-400 transition-colors"
          >
            Nhật Ký
          </button>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;
