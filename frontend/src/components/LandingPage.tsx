import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
  Terminal,
  Tv,
} from 'lucide-react';
import { NavTabId } from './Navbar';
import { StatusDot } from './ui';

interface LandingPageProps {
  onOpenLoginModal: () => void;
  questConnected: boolean;
  streamConnected: boolean;
  onNavigateTab?: (tab: NavTabId) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLoginModal,
  questConnected,
  streamConnected,
  onNavigateTab,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const navigateTo = (tab: NavTabId) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const services: Array<{
    title: string;
    port: string;
    accentClass: string;
    badgeClass: string;
    iconBoxClass: string;
    summary: string;
    specs: string[];
    tech: string;
    action: string;
    tab: NavTabId;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      title: 'Quest Engine',
      port: 'PORT :3001',
      accentClass: 'card-accent-indigo',
      badgeClass: 'text-brand-text bg-brand-muted border border-brand/30',
      iconBoxClass: 'bg-brand/15 border-brand/35 text-brand-text',
      summary:
        'Mô phỏng gói tin heartbeat 30 giây theo chuẩn Discord Desktop để hoàn thành nhiệm vụ tự động mà không cần tải game.',
      specs: [
        'Giả lập tiến trình thực thi đa nhiệm',
        'Hỗ trợ dừng tức thì qua AbortController',
      ],
      tech: 'Node.js · Fastify · WS',
      action: 'Mở bảng nhiệm vụ',
      tab: 'quests',
      icon: Sparkles,
    },
    {
      title: 'StreamBot Voice',
      port: 'PORT :3000',
      accentClass: 'card-accent-amber',
      badgeClass: 'text-amber-300 bg-amber-500/15 border border-amber-500/30',
      iconBoxClass: 'bg-amber-500/15 border-amber-500/35 text-amber-300',
      summary:
        'Truyền phát trực tiếp YouTube, Twitch hoặc file MP4 vào kênh thoại bằng FFmpeg, tích hợp sẵn bộ đếm Viewer Farm.',
      specs: [
        'Mã hóa luồng H264 / Opus độ trễ thấp',
        'Tự động duy trì thời lượng xem stream',
      ],
      tech: 'FFmpeg · yt-dlp · Opus',
      action: 'Điều khiển phát luồng',
      tab: 'stream',
      icon: Tv,
    },
    {
      title: 'Science Telemetry',
      port: 'PYTHON 3',
      accentClass: 'card-accent-emerald',
      badgeClass: 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30',
      iconBoxClass: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
      summary:
        'Khởi tạo chữ ký nhị phân Windows PE gửi trực tiếp tới /api/v9/science nhằm cộng giờ chơi và mở khóa huy hiệu hồ sơ.',
      specs: [
        'Đa luồng song song tốc độ cao',
        'Hỗ trợ cả CLI tự động & menu tương tác',
      ],
      tech: 'Python 3 · PE Spoofer',
      action: 'Tạo cấu hình cày giờ',
      tab: 'badges',
      icon: Cpu,
    },
  ];

  const features = [
    {
      icon: Lock,
      tag: 'LOOPBACK 127.0.0.1',
      title: 'Vận hành cục bộ, bảo mật tuyệt đối',
      desc: 'Token xác thực chỉ lưu tại máy trạm cá nhân và giao tiếp trực tiếp với máy chủ Discord qua kết nối TLS, không đi qua bên thứ ba.',
    },
    {
      icon: Terminal,
      tag: 'REALTIME WEBSOCKET',
      title: 'Giả lập chuẩn giao thức Desktop Client',
      desc: 'Tự động đồng bộ phiên bản build mới nhất từ Discord, gửi gói tin trạng thái theo chu kỳ 30 giây giúp tiến độ ghi nhận chính xác.',
    },
    {
      icon: Radio,
      tag: 'FFMPEG + OPUS',
      title: 'Truyền phát Voice Channel đa nguồn',
      desc: 'Giải mã luồng trực tiếp với binary FFmpeg và yt-dlp tích hợp sẵn, hỗ trợ phát lặp vô hạn và duy trì hiện diện trong phòng thoại.',
    },
    {
      icon: ShieldCheck,
      tag: '100% AUDITABLE',
      title: 'Mã nguồn minh bạch, kiểm tra tùy ý',
      desc: 'Toàn bộ mã nguồn TypeScript, Fastify backend và Python spoofer nằm ngay trong thư mục dự án, cho phép kiểm chứng mọi gói tin.',
    },
  ];

  const steps = [
    {
      step: 'BƯỚC 01',
      time: '~10 giây',
      title: 'Khởi động các dịch vụ',
      desc: 'Nhấp đúp file thực thi ở thư mục gốc để bật đồng thời cả 3 dịch vụ Quest Engine, StreamBot và giao diện điều khiển Web.',
      cmdLabel: 'Launcher Script',
      cmdValue: '> start.bat',
    },
    {
      step: 'BƯỚC 02',
      time: '~30 giây',
      title: 'Lấy Discord User Token',
      desc: 'Mở Discord trên trình duyệt, bật F12 chuyển sang tab Network, lọc tìm request thông tin tài khoản và sao chép mã xác thực.',
      cmdLabel: 'Header mục tiêu',
      cmdValue: 'GET /api/v9/users/@me',
    },
    {
      step: 'BƯỚC 03',
      time: 'Tức thì',
      title: 'Kết nối & Tự động hóa',
      desc: 'Nhấn nút kết nối trên thanh công cụ, dán token và kích hoạt chế độ chạy đồng loạt hoặc tùy chỉnh từng tiến trình riêng lẻ.',
      cmdLabel: 'Trạng thái phiên',
      cmdValue: 'Heartbeat: Active (30s)',
    },
  ];

  const faqs = [
    {
      q: 'Token của tôi có bị gửi ra máy chủ bên ngoài không?',
      a: 'Tuyệt đối không. Hệ thống hoạt động theo mô hình self-hosted 100% trên máy cá nhân, chỉ giao tiếp nội bộ giữa trình duyệt (port 5173), backend (port 3001/3000) và Discord API.',
    },
    {
      q: 'Tại sao làm nhiệm vụ Discord Quest không cần phải tải game?',
      a: 'Discord ghi nhận tiến độ nhiệm vụ dựa trên các gói tin telemetry định kỳ từ ứng dụng Desktop. Quest Engine mô phỏng chính xác cấu trúc gói tin này theo chu kỳ 30 giây.',
    },
    {
      q: 'Tôi có thể đóng tab trình duyệt khi nhiệm vụ đang chạy không?',
      a: 'Hoàn toàn được. Tiến trình Quest Engine và StreamBot chạy độc lập dưới nền hệ điều hành thông qua cửa sổ dòng lệnh start.bat, tab trình duyệt chỉ đóng vai trò bảng điều khiển.',
    },
  ];

  return (
    <div className="space-y-20 py-6">
      <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-zinc-300">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-muted border border-brand/30 text-brand-text font-medium">
              Arychi Suite v2.0
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-line">
              <StatusDot tone={questConnected ? 'ok' : 'error'} />
              Quest :3001 {questConnected ? 'Online' : 'Offline'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-line">
              <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
              Stream :3000 {streamConnected ? 'Live' : 'Standby'}
            </span>
          </div>

          <div className="space-y-3.5">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.15] [text-wrap:balance]">
              Nền tảng tự động hóa Discord cục&nbsp;bộ
            </h1>
            <p className="text-base text-zinc-300 leading-relaxed max-w-[52ch]">
              Hợp nhất 3 công cụ chuyên biệt chạy trực tiếp trên thiết bị của bạn: Hoàn thành Discord Quests không cần cài game, phát video kênh thoại 24/7 và cày giờ chơi hồ sơ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="btn-primary h-10 px-5 text-sm"
            >
              <span>Kết nối tài khoản Discord</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => navigateTo('about')}
              className="btn-secondary h-10 px-4 text-sm"
            >
              Tìm hiểu kiến trúc
            </button>
          </div>

          <div className="pt-2 grid grid-cols-3 gap-4 max-w-md border-t border-line">
            <div>
              <p className="text-lg font-bold font-mono text-white">30s</p>
              <p className="text-xs text-zinc-400">Chu kỳ Heartbeat</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-brand-text">127.0.0.1</p>
              <p className="text-xs text-zinc-400">Mạng nội bộ</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-emerald-400">0 GB</p>
              <p className="text-xs text-zinc-400">Dung lượng tải game</p>
            </div>
          </div>
        </div>

        <div className="surface card-accent-indigo p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-1.5 text-xs font-mono font-medium text-zinc-300">
                RUNTIME TOPOLOGY
              </span>
            </div>
            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-white/[0.06] border border-line text-zinc-300">
              LOCALHOST
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="surface-well p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center text-brand-text shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Quest Engine Daemon</p>
                  <p className="text-2xs font-mono text-zinc-400 truncate">Fastify REST &amp; WS · Port 3001</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-2xs font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-200 shrink-0">
                <StatusDot tone={questConnected ? 'ok' : 'error'} />
                {questConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <div className="surface-well p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                  <Tv className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">StreamBot Media Server</p>
                  <p className="text-2xs font-mono text-zinc-400 truncate">FFmpeg + Viewer Farm · Port 3000</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-2xs font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-200 shrink-0">
                <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
                {streamConnected ? 'READY' : 'STANDBY'}
              </span>
            </div>

            <div className="surface-well p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Science Telemetry CLI</p>
                  <p className="text-2xs font-mono text-zinc-400 truncate">Windows PE Spoofer · /v9/science</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-2xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 shrink-0">
                PE READY
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-2xs font-mono text-zinc-400">
            <span>TLS 1.3 Direct to discord.com</span>
            <span className="text-emerald-400">● Zero Cloud Proxy</span>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            3 Trụ cột tự động hóa chuyên biệt
          </h2>
          <p className="text-xs font-mono text-zinc-400">
            Mỗi dịch vụ hoạt động độc lập, không xung đột tài nguyên
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((svc) => {
            const Icon = svc.icon;
            return (
              <div
                key={svc.title}
                className={`surface-interactive ${svc.accentClass} p-6 flex flex-col justify-between space-y-6`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${svc.iconBoxClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-2xs font-mono font-semibold px-2.5 py-1 rounded-md ${svc.badgeClass}`}>
                      {svc.port}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">{svc.title}</h3>
                    <p className="text-[13px] text-zinc-300 leading-relaxed max-w-[44ch]">
                      {svc.summary}
                    </p>
                  </div>

                  <div className="surface-well p-3 space-y-2">
                    {svc.specs.map((spec) => (
                      <div key={spec} className="flex items-center gap-2 text-xs text-zinc-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-text shrink-0" />
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-line flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-mono">{svc.tech}</span>
                  <button
                    type="button"
                    onClick={() => navigateTo(svc.tab)}
                    className="link"
                  >
                    <span>{svc.action}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Đặc điểm kỹ thuật &amp; Cơ chế an toàn
          </h2>
          <p className="text-xs font-mono text-zinc-400">
            Kiến trúc ưu tiên quyền riêng tư và hiệu năng hệ thống
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="surface-interactive p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="icon-badge">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-2xs font-mono font-medium px-2.5 py-1 rounded bg-white/[0.04] border border-line text-zinc-300">
                    {feat.tag}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">{feat.title}</h3>
                  <p className="text-[13px] text-zinc-300 leading-relaxed max-w-[50ch]">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Vận hành nhanh trong 3 bước
          </h2>
          <p className="text-xs font-mono text-zinc-400">
            Thiết lập một lần, tự động khôi phục phiên ở các lần mở sau
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((item) => (
            <div
              key={item.step}
              className="surface-interactive p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-brand-muted border border-brand/30 text-brand-text">
                    {item.step}
                  </span>
                  <span className="text-xs font-mono text-zinc-400">{item.time}</span>
                </div>
                <h3 className="text-base font-bold text-white">{item.title}</h3>
                <p className="text-[13px] text-zinc-300 leading-relaxed max-w-[44ch]">
                  {item.desc}
                </p>
              </div>

              <div className="surface-well px-3.5 py-2.5 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">{item.cmdLabel}</span>
                <span className="text-zinc-200 font-medium">{item.cmdValue}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-8 items-start">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Câu hỏi thường gặp
          </h2>
          <p className="text-[13px] text-zinc-300 leading-relaxed max-w-[38ch]">
            Giải đáp nhanh về cơ chế bảo mật token, cách thức mô phỏng gói tin và vận hành tiến trình ngầm trên máy trạm.
          </p>

          <div className="surface p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-300 font-semibold">KIỂM CHỨNG BẢO MẬT</span>
              <span className="text-emerald-400">LOCAL ONLY</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed max-w-[36ch]">
              Bạn có thể mở DevTools (F12) bất kỳ lúc nào để kiểm tra toàn bộ lưu lượng mạng chỉ kết nối tới <code className="inline-code">localhost</code>.
            </p>
          </div>
        </div>

        <div className="space-y-3.5">
          {faqs.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className={`surface p-5 ${isOpen ? 'card-accent-indigo border-brand/40' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left flex items-center justify-between gap-4 text-sm font-semibold text-zinc-100 hover:text-white transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-brand-text shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-3 pt-3 border-t border-line text-[13px] text-zinc-300 leading-relaxed max-w-[54ch]">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
