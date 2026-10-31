import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Globe,
  Lock,
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
    <div className="space-y-16 py-4">
      <PageHeader
        title="Tài liệu Kỹ thuật & Kiến trúc"
        description="Kiến trúc vận hành 2 tên miền (arychi.xyz & dash.arychi.xyz), đồng bộ Database với VietQR/PayOS và quản lý Token."
        meta={
          <>
            <span className="text-white">Arychi Suite v2.0.0</span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone="ok" />
              Gói 50.000đ / 1 tháng (Full tính năng)
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
              <span>Về Tổng quan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="btn-primary"
            >
              <span>Đăng nhập OAuth2</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )
        }
      />

      <nav
        aria-label="Mục lục trang"
        className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-line text-xs"
      >
        {[
          { id: 'sec-modules', label: '3 Trụ cột kỹ thuật' },
          { id: 'sec-arch', label: 'Kiến trúc & Cổng mạng' },
          { id: 'sec-security', label: 'Bảo mật & Database' },
          { id: 'sec-specs', label: 'Thông số môi trường' },
          { id: 'sec-history', label: 'Lịch sử phát triển' },
          { id: 'sec-faq', label: 'Giải đáp kỹ thuật' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            className="px-3 py-1.5 rounded-md whitespace-nowrap text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <Section
        id="sec-modules"
        title="3 Trụ cột kỹ thuật độc lập"
        description="Mỗi module chịu trách nhiệm cho một luồng xử lý riêng biệt trên dash.arychi.xyz."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="surface-interactive p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-300">
                  Module 01
                </span>
                <span className="text-xs font-mono text-slate-200">1 Token • :3001</span>
              </div>
              <h3 className="text-base font-bold text-white">Quest Engine</h3>
              <p className="text-[13px] text-slate-300 leading-relaxed">
                Giải pháp cày nhiệm vụ Discord Quests tự động không cần cài đặt game dung lượng lớn.
                Giả lập heartbeat định kỳ gửi đến Discord theo định dạng desktop client chính thức.
              </p>
              <ul className="pt-3 border-t border-line space-y-1.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Yêu cầu nhập 1 Token Acc Discord</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Dừng ngay với AbortController</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Tự động nhận thưởng (Claim)</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-line text-xs font-mono text-slate-300">
              Node.js + Express + WS
            </div>
          </div>

          <div className="surface-interactive p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-300">
                  Module 02
                </span>
                <span className="text-xs font-mono text-slate-200">2 Token • :3000</span>
              </div>
              <h3 className="text-base font-bold text-white">StreamBot Voice</h3>
              <p className="text-[13px] text-slate-300 leading-relaxed">
                Truyền phát âm thanh Opus và video vào Voice Channel 24/7, tích hợp Viewer Farm duy
                trì thời lượng xem stream bằng tài khoản phụ.
              </p>
              <ul className="pt-3 border-t border-line space-y-1.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>1 Token Chính (Stream) + 1 Token Phụ (Xem)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>FFmpeg + yt-dlp tối ưu CPU</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Viewer Farm tự động farm phút</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-line text-xs font-mono text-slate-300">
              discord.js-selfbot-v13 + FFmpeg
            </div>
          </div>

          <div className="surface-interactive p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-300">
                  Module 03
                </span>
                <span className="text-xs font-mono text-slate-200">1 Token • Python 3</span>
              </div>
              <h3 className="text-base font-bold text-white">Science Telemetry</h3>
              <p className="text-[13px] text-slate-300 leading-relaxed">
                Giả lập nhịp độ chơi game gửi trực tiếp lên endpoint phân tích Discord Science API
                với chữ ký Windows PE nhị phân thực tế để cày huy hiệu hồ sơ.
              </p>
              <ul className="pt-3 border-t border-line space-y-1.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Trích xuất Windows PE Fingerprint</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Gửi gói tin /api/v9/science</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Cộng dồn số giờ chơi trên Activity</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-line text-xs font-mono text-slate-300">
              Python 3 + PE Header Hash
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="sec-arch"
        title="Kiến trúc 2 Tên miền & Cổng mạng"
        description="Phân tách rõ tầng giới thiệu (arychi.xyz) và tầng điều khiển (dash.arychi.xyz)."
      >
        <div className="surface divide-y divide-line">
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                Tầng 01: arychi.xyz
              </p>
              <p className="text-sm font-semibold text-white">Cổng Giới thiệu &amp; Thanh toán</p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Đăng nhập OAuth2 (Bot Discord / Google) và thanh toán gói 50.000đ/tháng qua VietQR
                &amp; PayOS.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                Tầng 02: dash.arychi.xyz
              </p>
              <p className="text-sm font-semibold text-white">Xác minh Lần 2 &amp; Sidebar</p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kiểm tra lại trạng thái gói trong Database trước khi mở giao diện điều khiển cột
                trái.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                Tầng 03: Backend &amp; Database
              </p>
              <p className="text-sm font-semibold text-white">Port :3001 &amp; :3000</p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Lưu trữ tài khoản, thời hạn gói thuê bao và cấu hình Token vào Database.
              </p>
            </div>
          </div>

          <div className="p-5 divide-y divide-line text-[13px]">
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-mono text-white font-semibold">5173 (TCP) • Web Portal</span>
              <span className="text-slate-300">
                Hỗ trợ định tuyến tên miền arychi.xyz và miền phụ dash.arychi.xyz
              </span>
              <span className="text-blue-300 font-mono text-xs">Dual-Domain</span>
            </div>
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-mono text-white font-semibold">
                3001 (TCP/WS) • Quest &amp; Subscription DB
              </span>
              <span className="text-slate-300">
                REST API OAuth2, VietQR/PayOS, Database &amp; Quest WebSocket
              </span>
              <span className="text-blue-300 font-mono text-xs">Realtime DB</span>
            </div>
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-mono text-white font-semibold">
                3000 (TCP/WS) • StreamBot Dual-Token
              </span>
              <span className="text-slate-300">
                Quản lý đồng thời 1 Token Chính (Stream) và 1 Token Phụ (Viewer Farm)
              </span>
              <span className="text-blue-300 font-mono text-xs">2-Token Voice</span>
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="sec-security"
        title="Cam kết bảo mật & Quyền riêng tư"
        description="Nguyên tắc thiết kế bảo vệ an toàn tài khoản và dữ liệu cá nhân."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-300" />
              <span>Xác minh Kép (2nd Verification)</span>
            </h3>
            <p className="text-[13px] text-slate-300 leading-relaxed">
              Mọi lượt truy cập vào miền phụ dash.arychi.xyz đều phải qua bước xác minh lần 2 trực
              tiếp với Database để đảm bảo gói 50.000đ/tháng đang còn hạn.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-300" />
              <span>Anti-Rate Limit</span>
            </h3>
            <p className="text-[13px] text-slate-300 leading-relaxed">
              Các gói tin telemetry gửi đến Discord được thiết kế với chu kỳ đệm tự nhiên tương tự
              ứng dụng chính thức, không bắn dồn dập bất thường.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-300" />
              <span>VietQR &amp; PayOS Tự động</span>
            </h3>
            <p className="text-[13px] text-slate-300 leading-relaxed">
              Giao dịch mua gói 50.000đ/tháng được xử lý qua chuẩn VietQR và PayOS API, tự động cộng
              dồn số ngày sử dụng (30 ngày/tháng) vào Database.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-300" />
              <span>Tách biệt Token theo Module</span>
            </h3>
            <p className="text-[13px] text-slate-300 leading-relaxed">
              Token dùng cho Discord Quests (1 Token) và Treo Stream (2 Token: 1 Chính + 1 Phụ) được
              quản lý độc lập ngay trong bảng điều khiển.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="sec-specs"
        title="Yêu cầu hệ thống"
        description="Môi trường vận hành khuyến nghị."
      >
        <div className="surface divide-y sm:divide-y-0 sm:divide-x divide-line grid grid-cols-1 sm:grid-cols-2">
          <div className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Yêu cầu phần mềm</h3>
            <dl className="divide-y divide-line text-[13px]">
              <div className="py-2 flex items-center justify-between">
                <dt className="text-slate-300">Hệ điều hành</dt>
                <dd className="font-mono text-white text-xs">Windows 10/11, Linux, macOS</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-slate-300">Node.js Runtime</dt>
                <dd className="font-mono text-white text-xs">&gt;= v18.16.0 LTS (v20+)</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-slate-300">Python Runtime</dt>
                <dd className="font-mono text-white text-xs">&gt;= 3.10.x</dd>
              </div>
            </dl>
          </div>

          <div className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Tài nguyên chiếm dụng</h3>
            <dl className="divide-y divide-line text-[13px]">
              <div className="py-2 flex items-center justify-between">
                <dt className="text-slate-300">RAM</dt>
                <dd className="font-mono text-blue-300 text-xs font-semibold">~120MB – 250MB</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-slate-300">CPU (Quests/Badges)</dt>
                <dd className="font-mono text-blue-300 text-xs font-semibold">&lt; 1%</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-slate-300">CPU (StreamBot)</dt>
                <dd className="font-mono text-blue-300 text-xs font-semibold">2% – 5%</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <Section
        id="sec-history"
        title="Lịch sử phát triển"
        description="Các cột mốc phiên bản chính của Arychi Suite."
      >
        <div className="surface divide-y divide-line">
          <div className="p-5 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-blue-300 bg-blue-600/20 px-2 py-0.5 rounded">
                v2.1.0
              </span>
              <p className="text-sm font-semibold text-white">
                Kiến trúc arychi.xyz / dash.arychi.xyz &amp; VietQR PayOS
              </p>
              <span className="text-xs text-slate-300 ml-auto">Hiện tại</span>
            </div>
            <ul className="space-y-1 text-[13px] text-slate-300 list-disc list-inside pt-1">
              <li>Đồng nhất gói duy nhất 50.000đ/tháng mở khóa toàn bộ tính năng.</li>
              <li>Tích hợp API VietQR &amp; PayOS tự động xác nhận và cộng tháng vào Database.</li>
              <li>Xác minh lần 2 khi chuyển hướng sang dash.arychi.xyz với bố cục Sidebar cột trái.</li>
              <li>Cấu hình 1 Token cho Quest/Giờ chơi và 2 Token (Chính + Phụ) cho Treo Stream.</li>
            </ul>
          </div>

          <div className="p-5 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium text-slate-200 bg-white/[0.06] px-2 py-0.5 rounded">
                v1.5.0
              </span>
              <p className="text-sm font-semibold text-white">StreamBot Voice &amp; Viewer Farm</p>
            </div>
            <p className="text-[13px] text-slate-300 leading-relaxed">
              Tích hợp yt-dlp và FFmpeg tự động giải mã video phòng thoại, bổ sung module Viewer
              Farm tự động giữ kết nối.
            </p>
          </div>
        </div>
      </Section>

      <Section id="sec-faq" title="Giải đáp kỹ thuật (FAQ)">
        <div className="space-y-3">
          {[
            {
              q: 'Tôi có thể tắt tab trình duyệt khi hệ thống đang làm Quest hoặc Stream không?',
              a: 'Có thể. Các engine xử lý chính (Quest Engine :3001 và StreamBot :3000) chạy dưới dạng tiến trình độc lập trên máy chủ. Bạn có thể đóng tab trình duyệt mà tiến trình vẫn tiếp tục chạy ngầm.',
            },
            {
              q: 'Tại sao việc cày Discord Quest không cần phải tải game nặng?',
              a: 'Ứng dụng Discord Desktop xác nhận tiến độ nhiệm vụ qua các gói tin telemetry định kỳ (heartbeat) gửi lên máy chủ. Quest Engine mô phỏng chuẩn xác định dạng này mỗi 30 giây.',
            },
            {
              q: 'Tại sao Treo Stream lại cần nhập 2 Token (1 Chính và 1 Phụ)?',
              a: 'Discord yêu cầu có ít nhất 1 người xem trong kênh thoại để ghi nhận thời gian stream. Do đó 1 Token Chính được dùng để phát video và 1 Token Phụ tự động vào xem stream đó.',
            },
          ].map((item, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className={`surface p-5 ${isOpen ? 'border-blue-500/60' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full text-left flex items-center justify-between text-sm font-semibold text-white hover:text-blue-300 transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-blue-300 shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-300 shrink-0 ml-4" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-3 pt-3 border-t border-line text-[13px] text-slate-300 leading-relaxed">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
};

export default AboutPage;
