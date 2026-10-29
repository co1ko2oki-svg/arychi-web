import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
  Terminal,
  Tv,
  Zap,
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
    } else {
      window.location.hash = `#${tab}`;
    }
  };

  const services = [
    {
      port: ':3001',
      title: 'Quest Engine',
      summary: 'Mô phỏng heartbeat 30 giây theo chuẩn client desktop để hoàn thành Discord Quests mà không cần tải game nặng 50GB–100GB.',
      tech: 'Node.js · Fastify · WebSocket',
      tab: 'quests' as const,
      icon: Sparkles,
      action: 'Mở danh sách nhiệm vụ',
    },
    {
      port: ':3000',
      title: 'StreamBot Voice',
      summary: 'Truyền phát YouTube, Twitch hoặc file video MP4 vào Voice Channel bằng FFmpeg và yt-dlp, tích hợp Viewer Farm duy trì thời gian xem.',
      tech: 'FFmpeg · yt-dlp · Opus Codec',
      tab: 'stream' as const,
      icon: Tv,
      action: 'Phát trực tiếp voice',
    },
    {
      port: 'Python 3',
      title: 'Science Telemetry',
      summary: 'Tạo Windows PE Fingerprint gửi gói tin telemetry trực tiếp lên /api/v9/science để tăng số giờ chơi và mở khóa mốc game trên hồ sơ.',
      tech: 'Python 3 · PE Hash Spoofer',
      tab: 'badges' as const,
      icon: Cpu,
      action: 'Tạo lệnh cày giờ',
    },
  ];

  const features = [
    {
      icon: Lock,
      title: '100% Cục bộ & Bảo mật',
      desc: 'Discord User Token chỉ lưu trong LocalStorage trình duyệt và gửi về backend máy tính nội bộ 127.0.0.1. Tuyệt đối không qua bất kỳ cloud server bên thứ ba nào.',
    },
    {
      icon: Zap,
      title: 'Mô phỏng nhịp độ tự nhiên',
      desc: 'Khoảng thời gian heartbeat và telemetry được căn chuẩn theo client chính thức, tránh dồn dập request nhằm giảm thiểu tối đa nguy cơ HTTP 429.',
    },
    {
      icon: Radio,
      title: 'Truyền phát Voice Channel đa nguồn',
      desc: 'Giải mã luồng trực tiếp với binary FFmpeg và yt-dlp tích hợp sẵn, hỗ trợ phát lặp vô hạn và duy trì hiện diện cho thành viên phòng thoại.',
    },
    {
      icon: ShieldCheck,
      title: 'Mã nguồn minh bạch, kiểm tra tùy ý',
      desc: 'Toàn bộ script TypeScript, Fastify backend và Python spoofer nằm trực tiếp trong thư mục dự án của bạn. Bạn có thể mở F12 Network kiểm tra bất cứ lúc nào.',
    },
  ];

  return (
    <div className="space-y-20 py-8">
      <section className="space-y-6 max-w-3xl">
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] border border-line text-zinc-300 font-medium">
            Arychi Suite v2.0
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusDot tone={questConnected ? 'ok' : 'error'} />
            Quest :3001 {questConnected ? 'Online' : 'Offline'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
            Stream :3000 {streamConnected ? 'Live' : 'Standby'}
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.15]">
            Nền tảng tự động hóa Discord cục bộ
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed font-normal">
            Hợp nhất 3 giải pháp độc lập chạy trực tiếp trên thiết bị của bạn: Hoàn thành Discord Quests tự động không cần cài đặt game, truyền phát video vào kênh thoại và cày giờ chơi hồ sơ qua Discord Science API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
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
      </section>

      <section className="space-y-5">
        <div className="space-y-1">
          <p className="eyebrow">Cấu trúc module</p>
          <h2 className="text-xl font-semibold text-white tracking-tight">3 Trụ cột tự động hóa chuyên biệt</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map((svc) => {
            const Icon = svc.icon;
            return (
              <div
                key={svc.title}
                className="surface p-5 flex flex-col justify-between space-y-5 hover:border-line-strong transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-mono font-medium text-brand-text bg-brand-muted px-2 py-0.5 rounded">
                      {svc.port}
                    </span>
                    <Icon className="w-4 h-4 text-zinc-500" />
                  </div>
                  <h3 className="text-base font-semibold text-white">{svc.title}</h3>
                  <p className="text-[13px] text-zinc-400 leading-relaxed">{svc.summary}</p>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-mono">{svc.tech}</span>
                  <button
                    type="button"
                    onClick={() => navigateTo(svc.tab)}
                    className="link font-medium"
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

      <section className="space-y-5">
        <div className="space-y-1">
          <p className="eyebrow">Bảo mật &amp; Cơ chế</p>
          <h2 className="text-xl font-semibold text-white tracking-tight">Đặc điểm kỹ thuật</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="surface p-5 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-brand-text" />
                  <h3 className="text-sm font-semibold text-white">{feat.title}</h3>
                </div>
                <p className="text-[13px] text-zinc-400 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-5">
        <div className="space-y-1">
          <p className="eyebrow">Bắt đầu nhanh</p>
          <h2 className="text-xl font-semibold text-white tracking-tight">Vận hành trong 3 bước</h2>
        </div>

        <div className="surface divide-y sm:divide-y-0 sm:divide-x divide-line grid grid-cols-1 sm:grid-cols-3">
          <div className="p-5 space-y-2">
            <span className="text-2xs font-mono font-semibold text-zinc-500 uppercase">Bước 01</span>
            <p className="text-sm font-semibold text-white">Khởi động các dịch vụ</p>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Nhấp đúp file <code className="inline-code">start.bat</code> để mở đồng thời cả Quest Engine (:3001), StreamBot (:3000) và Web UI (:5173).
            </p>
          </div>

          <div className="p-5 space-y-2">
            <span className="text-2xs font-mono font-semibold text-zinc-500 uppercase">Bước 02</span>
            <p className="text-sm font-semibold text-white">Lấy Discord User Token</p>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Mở Discord trên trình duyệt, ấn <kbd className="inline-code">F12</kbd> &gt; tab Network &gt; tìm request <code className="inline-code">/users/@me</code> và sao chép header Authorization.
            </p>
          </div>

          <div className="p-5 space-y-2">
            <span className="text-2xs font-mono font-semibold text-zinc-500 uppercase">Bước 03</span>
            <p className="text-sm font-semibold text-white">Kết nối &amp; Điều khiển</p>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Bấm &quot;Kết nối Discord&quot; ở góc trên, dán token vào và chọn &quot;Chạy tất cả&quot; hoặc chọn từng nhiệm vụ mong muốn.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="space-y-1">
          <p className="eyebrow">Giải đáp thắc mắc</p>
          <h2 className="text-xl font-semibold text-white tracking-tight">Câu hỏi thường gặp (FAQ)</h2>
        </div>

        <div className="surface divide-y divide-line">
          {[
            {
              q: 'Token của tôi có bị gửi ra máy chủ bên ngoài không?',
              a: 'Tuyệt đối không. Arychi được thiết kế theo mô hình self-hosted 100%. Toàn bộ mã nguồn chạy trên máy trạm của bạn và chỉ giao tiếp giữa giao diện web (port 5173), backend nội bộ (port 3001/3000) và trực tiếp Discord API.',
            },
            {
              q: 'Tại sao làm nhiệm vụ Discord Quest không cần phải tải game?',
              a: 'Discord xác định tiến độ quest thông qua các gói tin telemetry định kỳ (heartbeat) được gửi từ client Desktop. Backend Arychi mô phỏng chính xác các gói tin này theo định dạng chính thức với chu kỳ 30 giây.',
            },
            {
              q: 'Tôi có thể tắt tab trình duyệt khi hệ thống đang chạy không?',
              a: 'Có thể. Các tiến trình xử lý chính (Quest Engine và StreamBot) chạy độc lập trên máy của bạn sau khi bạn mở start.bat. Tab trình duyệt chỉ là giao diện điều khiển.',
            },
          ].map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left flex items-center justify-between text-sm font-semibold text-zinc-200 hover:text-white transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-brand-text shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0 ml-4" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-2.5 text-[13px] text-zinc-400 leading-relaxed max-w-3xl">
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
