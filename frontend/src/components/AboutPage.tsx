import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Cpu,
  Globe,
  HardDrive,
  Lock,
  Server,
  ShieldCheck,
  Sparkles,
  Tv,
  Zap,
} from 'lucide-react';
import { NavTabId } from './Navbar';
import { PageHeader, Section, StatusDot } from './ui';

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
    <div className="space-y-16 py-6">
      <PageHeader
        title="Giới thiệu hệ thống"
        description="Nền tảng tự động hóa Discord hợp nhất chạy trực tiếp trên thiết bị cá nhân của bạn. Gom toàn bộ công cụ vào một giao diện Web duy nhất qua kết nối nội bộ 127.0.0.1."
        meta={
          <>
            <span className="text-zinc-200">Arychi Suite v2.0.0</span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone="ok" />
              100% Localhost • Zero External Cloud
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={questConnected ? 'ok' : 'error'} />
              Quest :3001
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
              Stream :3000
            </span>
          </>
        }
        actions={
          isLoggedIn ? (
            <button
              type="button"
              onClick={() => onNavigateTab('home')}
              className="btn-primary"
            >
              <span>Mở bảng điều khiển</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="btn-primary"
            >
              <span>Kết nối tài khoản Discord</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )
        }
      />

      <nav aria-label="Mục lục trang" className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-line text-xs">
        {[
          { id: 'sec-modules', label: '3 Trụ cột kỹ thuật' },
          { id: 'sec-arch', label: 'Kiến trúc & Cổng mạng' },
          { id: 'sec-security', label: 'Bảo mật & Riêng tư' },
          { id: 'sec-specs', label: 'Thông số môi trường' },
          { id: 'sec-history', label: 'Lịch sử phát triển' },
          { id: 'sec-faq', label: 'Giải đáp kỹ thuật' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            className="px-3 py-1.5 rounded-md whitespace-nowrap text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <Section id="sec-modules" title="3 Trụ cột kỹ thuật độc lập" description="Mỗi module chịu trách nhiệm cho một luồng xử lý riêng biệt.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="surface p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-text">Module 01</span>
                <span className="text-xs font-mono text-zinc-400">Port :3001</span>
              </div>
              <h3 className="text-base font-semibold text-white">Quest Engine</h3>
              <p className="text-[13px] text-zinc-400 leading-relaxed">
                Giải pháp cày nhiệm vụ Discord Quests tự động không cần cài đặt game dung lượng lớn. Giả lập heartbeat định kỳ gửi đến Discord theo định dạng desktop client chính thức.
              </p>
              <ul className="space-y-1.5 text-xs text-zinc-300 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-text shrink-0" />
                  <span>Mô phỏng Heartbeat 30s</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-text shrink-0" />
                  <span>Dừng ngay với AbortController</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-text shrink-0" />
                  <span>Tự động nhận thưởng (Claim)</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-line text-xs font-mono text-zinc-500">
              Node.js + Fastify + WS
            </div>
          </div>

          <div className="surface p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Module 02</span>
                <span className="text-xs font-mono text-zinc-400">Port :3000</span>
              </div>
              <h3 className="text-base font-semibold text-white">StreamBot Voice</h3>
              <p className="text-[13px] text-zinc-400 leading-relaxed">
                Truyền phát âm thanh Opus và video vào Voice Channel 24/7, tích hợp module Viewer Farm duy trì thời lượng xem stream cho tài khoản mà không bị gián đoạn.
              </p>
              <ul className="space-y-1.5 text-xs text-zinc-300 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Đa nguồn: YouTube, Twitch, MP4</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>FFmpeg + yt-dlp tối ưu CPU</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Viewer Farm tự động farm phút</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-line text-xs font-mono text-zinc-500">
              @discordjs/voice + FFmpeg
            </div>
          </div>

          <div className="surface p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Module 03</span>
                <span className="text-xs font-mono text-zinc-400">Python 3</span>
              </div>
              <h3 className="text-base font-semibold text-white">Science Telemetry</h3>
              <p className="text-[13px] text-zinc-400 leading-relaxed">
                Giả lập nhịp độ chơi game gửi trực tiếp lên endpoint phân tích Discord Science API với chữ ký Windows PE nhị phân thực tế để cày huy hiệu và số giờ chơi hồ sơ.
              </p>
              <ul className="space-y-1.5 text-xs text-zinc-300 pt-1">
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
                  <span>Cộng dồn số giờ chơi trên Activity</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-line text-xs font-mono text-zinc-500">
              Python 3 + PE Header Hash
            </div>
          </div>
        </div>
      </Section>

      <Section id="sec-arch" title="Kiến trúc & Cổng mạng" description="Mọi luồng dữ liệu đều được cô lập trong môi trường loopback.">
        <div className="surface divide-y divide-line">
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-text">Tầng 01: Frontend</p>
              <p className="text-sm font-semibold text-white">Web UI (:5173)</p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                React 18 + Vite SPA, lưu trữ token trong LocalStorage trình duyệt người dùng.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Tầng 02: Cục bộ</p>
              <p className="text-sm font-semibold text-white">Local Services (127.0.0.1)</p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Quest Engine (:3001), StreamBot (:3000) và Python Spoofer xử lý tác vụ không trung gian.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Tầng 03: Đích đến</p>
              <p className="text-sm font-semibold text-white">Discord API Endpoints</p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                HTTPS TLS 1.3 kết nối trực tiếp đến các endpoint chính thức: /quests, /science, Voice RTC.
              </p>
            </div>
          </div>

          <div className="p-5 divide-y divide-line text-[13px]">
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-mono text-zinc-200 font-semibold">5173 (TCP) • Vite Frontend</span>
              <span className="text-zinc-400">Giao diện điều khiển SPA (React 18, Tailwind CSS)</span>
              <span className="text-emerald-400 font-mono text-xs">Localhost only</span>
            </div>
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-mono text-zinc-200 font-semibold">3001 (TCP/WS) • Quest Daemon</span>
              <span className="text-zinc-400">Fastify REST API &amp; WebSocket Server cho tiến trình Quest</span>
              <span className="text-emerald-400 font-mono text-xs">Đồng bộ realtime</span>
            </div>
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-mono text-zinc-200 font-semibold">3000 (TCP/WS) • StreamBot Service</span>
              <span className="text-zinc-400">Node.js Web API, FFmpeg stream pipeline và Voice Gateway</span>
              <span className="text-emerald-400 font-mono text-xs">Quản lý Voice Stream</span>
            </div>
          </div>
        </div>
      </Section>

      <Section id="sec-security" title="Cam kết bảo mật & Quyền riêng tư" description="Nguyên tắc thiết kế bảo vệ an toàn tài khoản và dữ liệu cá nhân.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand-text" />
              <span>Client-Side Only</span>
            </h3>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Discord User Token chỉ lưu trong bộ nhớ trình duyệt và RAM tiến trình nội bộ máy bạn. Arychi không sở hữu bất kỳ cơ sở dữ liệu trên mây nào để thu thập dữ liệu người dùng.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Anti-Rate Limit</span>
            </h3>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Các gói tin telemetry gửi đến Discord được thiết kế với chu kỳ đệm tự nhiên tương tự ứng dụng chính thức, không bắn dồn dập bất thường nhằm triệt tiêu nguy cơ vi phạm giới hạn tốc độ.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Zero Analytics</span>
            </h3>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Ứng dụng không nhúng bất kỳ đoạn mã theo dõi hành vi, Google Analytics, pixel quảng cáo hay dịch vụ báo cáo lỗi của bên thứ ba nào. Mã nguồn chạy sạch sẽ 100%.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-400" />
              <span>Audit-Ready</span>
            </h3>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Toàn bộ source code TypeScript, Python và tệp thực thi đều nằm trực tiếp trên máy của bạn. Bạn hoàn toàn có thể mở bất kỳ tệp tin nào để kiểm tra, debug gói tin mạng.
            </p>
          </div>
        </div>
      </Section>

      <Section id="sec-specs" title="Yêu cầu hệ thống" description="Môi trường vận hành khuyến nghị.">
        <div className="surface divide-y sm:divide-y-0 sm:divide-x divide-line grid grid-cols-1 sm:grid-cols-2">
          <div className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Yêu cầu phần mềm</h3>
            <dl className="divide-y divide-line text-[13px]">
              <div className="py-2 flex items-center justify-between">
                <dt className="text-zinc-500">Hệ điều hành</dt>
                <dd className="font-mono text-zinc-200 text-xs">Windows 10/11, Linux, macOS</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-zinc-500">Node.js Runtime</dt>
                <dd className="font-mono text-zinc-200 text-xs">&gt;= v18.16.0 LTS (v20+)</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-zinc-500">Python Runtime</dt>
                <dd className="font-mono text-zinc-200 text-xs">&gt;= 3.10.x</dd>
              </div>
            </dl>
          </div>

          <div className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Tài nguyên chiếm dụng</h3>
            <dl className="divide-y divide-line text-[13px]">
              <div className="py-2 flex items-center justify-between">
                <dt className="text-zinc-500">RAM</dt>
                <dd className="font-mono text-emerald-400 text-xs font-semibold">~120MB – 250MB</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-zinc-500">CPU (Quests/Badges)</dt>
                <dd className="font-mono text-emerald-400 text-xs font-semibold">&lt; 1%</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-zinc-500">CPU (StreamBot)</dt>
                <dd className="font-mono text-brand-text text-xs font-semibold">2% – 5%</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <Section id="sec-history" title="Lịch sử phát triển" description="Các cột mốc phiên bản chính của Arychi Suite.">
        <div className="surface divide-y divide-line">
          <div className="p-5 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-brand-text bg-brand-muted px-2 py-0.5 rounded">
                v2.0.0
              </span>
              <p className="text-sm font-semibold text-white">Arychi UI Redesign &amp; Unified Dashboard</p>
              <span className="text-xs text-zinc-500 ml-auto">Hiện tại</span>
            </div>
            <ul className="space-y-1 text-[13px] text-zinc-400 list-disc list-inside pt-1">
              <li>Xây dựng trung tâm điều khiển hợp nhất React 18, Vite 5 và Tailwind CSS.</li>
              <li>Loại bỏ hoàn toàn phong cách AI template, chuyển sang thiết kế tối giản, sắc sảo.</li>
              <li>Đồng bộ trạng thái realtime qua WebSocket kép (:3001 và :3000).</li>
              <li>Tích hợp module Science Telemetry cày giờ chơi qua PE Fingerprint.</li>
            </ul>
          </div>

          <div className="p-5 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                v1.5.0
              </span>
              <p className="text-sm font-semibold text-white">StreamBot Voice &amp; Viewer Farm</p>
            </div>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Tích hợp yt-dlp và FFmpeg tự động giải mã video phòng thoại, bổ sung module Viewer Farm tự động giữ kết nối.
            </p>
          </div>

          <div className="p-5 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium text-zinc-400 bg-white/[0.05] px-2 py-0.5 rounded">
                v1.0.0
              </span>
              <p className="text-sm font-semibold text-white">Phiên bản ban đầu</p>
            </div>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Bản thử nghiệm đầu tiên thực hiện các gói heartbeat cho nhiệm vụ Discord Quests qua CLI.
            </p>
          </div>
        </div>
      </Section>

      <Section id="sec-faq" title="Giải đáp kỹ thuật (FAQ)">
        <div className="surface divide-y divide-line">
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
              <div key={idx} className="p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
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
      </Section>

      <div className="p-4 rounded-lg border border-line bg-raised text-xs text-zinc-500 leading-relaxed">
        <strong className="text-zinc-400 font-medium">Tuyên bố miễn trừ trách nhiệm: </strong>
        Arychi Suite được phát triển với mục đích học tập, nghiên cứu giao thức mạng và tự động hóa cá nhân trên máy trạm cục bộ. Dự án không liên kết, không được tài trợ hoặc xác nhận bởi Discord Inc.
      </div>
    </div>
  );
};

export default AboutPage;
