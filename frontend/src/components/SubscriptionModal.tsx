import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { AuthUser, PaymentOrderDTO, PlanTierId, UserSubscription } from '../types';
import { questApi } from '../services/api';
import { StatusDot } from './ui';

export interface PricingPlan {
  id: PlanTierId;
  name: string;
  durationLabel: string;
  price: string;
  pricePerMonth: number;
  popular?: boolean;
  summary: string;
  features: string[];
}

export const SINGLE_PLAN_50K: PricingPlan = {
  id: 'monthly_50k',
  name: 'Gói Full Tính Năng',
  durationLabel: '50.000đ / 1 tháng',
  price: '50.000đ',
  pricePerMonth: 50000,
  popular: true,
  summary:
    'Một gói duy nhất mở khóa 100% tính năng trên dash.arychi.xyz. Tự động xác nhận qua VietQR & PayOS, cộng dồn thời hạn theo số tháng đăng ký.',
  features: [
    'Mở khóa toàn bộ tính năng trên miền phụ dash.arychi.xyz',
    'Discord Quests tự động (nhập 1 Token Acc Discord)',
    'Treo Stream Voice 24/7 + Viewer Farm (nhập 2 Token: 1 Chính + 1 Phụ)',
    'Science Telemetry cày giờ chơi hồ sơ (tối đa 5.000 giờ)',
    'Tự động xác nhận qua API VietQR & PayOS, lưu trữ vào Database',
  ],
};

export const PRICING_PLANS: PricingPlan[] = [SINGLE_PLAN_50K];

interface AccessGateBannerProps {
  user: AuthUser | null;
  subscription: UserSubscription | null;
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal: (defaultPlan?: PlanTierId) => void;
  featureName?: string;
}

export const AccessGateBanner: React.FC<AccessGateBannerProps> = ({
  user,
  subscription,
  onOpenLoginModal,
  onOpenSubscriptionModal,
  featureName = 'tính năng tự động hóa',
}) => {
  const isConnected = Boolean(user);
  const hasPlan = Boolean(subscription && subscription.isActive !== false);

  if (isConnected && hasPlan && subscription) {
    return (
      <div className="surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-mono font-medium text-blue-300">
            <StatusDot tone="ok" />
            OAUTH2: @{user?.username} ({user?.provider.toUpperCase()})
          </span>
          <span className="text-slate-400">•</span>
          <span className="font-mono text-slate-200">
            GÓI: <strong className="text-white">50.000Đ / THÁNG (FULL TÍNH NĂNG)</strong>
          </span>
          {subscription.daysRemaining !== undefined && (
            <>
              <span className="text-slate-400">•</span>
              <span className="font-mono text-blue-300">
                CÒN {subscription.daysRemaining} NGÀY
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenSubscriptionModal('monthly_50k')}
          className="btn-secondary btn-sm self-start sm:self-auto"
        >
          Gia hạn thêm tháng (+50k)
        </button>
      </div>
    );
  }

  return (
    <div className="surface p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-400 shrink-0" />
            <h2 className="text-base font-bold text-white">
              Yêu cầu đăng nhập OAuth2 &amp; kích hoạt gói 50.000đ/tháng để dùng {featureName}
            </h2>
          </div>
          <p className="text-[13px] text-slate-300 leading-relaxed">
            Hệ thống sử dụng một gói duy nhất 50.000đ / 1 tháng mở khóa toàn bộ tính năng, tự động xác nhận qua VietQR &amp; PayOS và lưu trực tiếp vào Database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!isConnected ? (
            <button type="button" onClick={onOpenLoginModal} className="btn-primary">
              <span>Bước 1: Đăng nhập OAuth2</span>
            </button>
          ) : (
            <button type="button" onClick={() => onOpenSubscriptionModal('monthly_50k')} className="btn-primary">
              <span>Bước 2: Mua gói 50k/tháng</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
        <div className="flex items-start gap-3">
          <div className="icon-badge">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-blue-300">BƯỚC 01</span>
              <span className="text-xs font-mono text-slate-300">
                {isConnected ? '• Đã hoàn tất' : '• Bắt buộc'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white">
              {isConnected ? `Đã đăng nhập: @${user?.username}` : 'Đăng nhập Bot Discord OAuth2 / Google'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isConnected
                ? `Tài khoản ${user?.provider.toUpperCase()} đã được lưu trong Database.`
                : 'Đăng nhập qua tính năng OAuth2 của Bot Discord hoặc đăng ký bằng tài khoản Google.'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="icon-badge">
            <KeyRound className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-blue-300">BƯỚC 02</span>
              <span className="text-xs font-mono text-slate-300">
                {hasPlan ? '• Đã kích hoạt' : '• Chưa có gói'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white">
              {hasPlan ? 'Đã kích hoạt gói 50.000đ/tháng' : 'Thanh toán VietQR & PayOS (50k/tháng)'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Quét mã VietQR hoặc cổng PayOS để tự động xác nhận và cộng dồn số tháng sử dụng vào Database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  subscription: UserSubscription | null;
  sessionToken?: string;
  initialPlanId?: PlanTierId;
  onOpenLoginModal: () => void;
  onActivateSubscription: (sub: UserSubscription, updatedUser?: AuthUser) => void;
}

const MONTH_OPTIONS = [
  { months: 1, label: '1 tháng', amount: 50000, badge: 'Cơ bản' },
  { months: 3, label: '3 tháng', amount: 150000, badge: 'Phổ biến' },
  { months: 6, label: '6 tháng', amount: 300000, badge: 'Ổn định' },
  { months: 12, label: '12 tháng', amount: 600000, badge: 'Cả năm' },
];

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  user,
  subscription,
  sessionToken = '',
  onOpenLoginModal,
  onActivateSubscription,
}) => {
  const [months, setMonths] = useState<number>(1);
  const [order, setOrder] = useState<PaymentOrderDTO | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setOrder(null);
      setError(null);
    }
  }, [isOpen]);

  // Poll order status every 4s while an order is PENDING
  useEffect(() => {
    if (!isOpen || !order || order.status !== 'PENDING') return;
    const timer = setInterval(async () => {
      try {
        const res = await questApi.checkPaymentOrder(order.orderCode);
        if (res.order.status === 'PAID' && res.subscription) {
          setOrder(res.order);
          onActivateSubscription(res.subscription, res.account || undefined);
          clearInterval(timer);
        }
      } catch {
        // Ignore transient network errors while polling
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [isOpen, order, onActivateSubscription]);

  if (!isOpen) return null;

  const activeToken = sessionToken || user?.sessionToken || '';

  const handleCreateOrder = async () => {
    if (!user || !activeToken) {
      onClose();
      onOpenLoginModal();
      return;
    }
    setCreatingOrder(true);
    setError(null);
    try {
      const res = await questApi.createPaymentOrder(activeToken, months);
      setOrder(res.order);
    } catch (err: any) {
      setError(err?.message || 'Không thể khởi tạo mã VietQR / PayOS');
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!order) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await questApi.confirmPaymentOrder(order.orderCode);
      setOrder(res.order);
      onActivateSubscription(res.subscription, res.account);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể xác nhận thanh toán');
    } finally {
      setConfirming(false);
    }
  };

  const handleCopyTransferContent = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.description);
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    } catch {}
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-2xl p-6 space-y-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-line">
          <div className="space-y-1">
            <h2 id="sub-modal-title" className="text-lg font-bold text-white">
              Đăng ký Gói 50.000đ / 1 tháng (VietQR &amp; PayOS)
            </h2>
            <p className="text-xs text-slate-300">
              Một gói duy nhất mở khóa 100% tính năng trên dash.arychi.xyz. Tự động cộng dồn tháng vào Database.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="btn-ghost btn-sm px-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-line">
          <div className="space-y-0.5">
            <span className="text-xs font-mono text-slate-300">TÀI KHOẢN ĐĂNG KÝ (DATABASE)</span>
            {user ? (
              <p className="text-sm font-semibold text-white">
                @{user.username}{' '}
                <span className="font-mono text-xs text-blue-300">
                  ({user.provider === 'google' ? 'Google OAuth2' : 'Discord Bot OAuth2'})
                </span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-rose-300">
                Chưa đăng nhập tài khoản OAuth2
              </p>
            )}
          </div>
          {subscription && subscription.isActive && (
            <div className="text-right">
              <span className="text-xs font-mono text-blue-300">
                ĐANG HOẠT ĐỘNG • CÒN {subscription.daysRemaining} NGÀY
              </span>
              {subscription.expiresAt && (
                <p className="text-xs text-slate-300">
                  Hết hạn: {new Date(subscription.expiresAt).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
          )}
          {!user && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLoginModal();
              }}
              className="btn-primary btn-sm"
            >
              Đăng nhập OAuth2 ngay
            </button>
          )}
        </div>

        {!order ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-[#141722] border border-blue-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-blue-300">
                  GÓI DUY NHẤT • FULL TÍNH NĂNG
                </span>
                <span className="text-lg font-bold font-mono text-white">
                  50.000đ / 1 tháng
                </span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200 pt-2 border-t border-line">
                {SINGLE_PLAN_50K.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2.5">
              <label className="field-label">
                Chọn số tháng muốn đăng ký / cộng dồn (30 ngày / tháng)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {MONTH_OPTIONS.map((opt) => {
                  const active = months === opt.months;
                  return (
                    <button
                      key={opt.months}
                      type="button"
                      onClick={() => setMonths(opt.months)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        active
                          ? 'bg-[#151B2B] border-blue-500 text-white'
                          : 'bg-[#0E1017] border-line text-slate-300 hover:border-line-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono text-blue-300">
                        <span>{opt.label.toUpperCase()}</span>
                        <span>+{opt.months * 30}d</span>
                      </div>
                      <p className="mt-1.5 text-base font-bold font-mono text-white">
                        {opt.amount.toLocaleString('vi-VN')}đ
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">{opt.badge}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-xs text-rose-300">{error}</p>}

            <div className="flex items-center justify-between pt-3 border-t border-line">
              <div>
                <span className="text-xs text-slate-300">Tổng thanh toán:</span>
                <p className="text-xl font-bold font-mono text-white">
                  {(months * 50000).toLocaleString('vi-VN')} VNĐ{' '}
                  <span className="text-xs font-normal text-blue-300">
                    (+{months} tháng sử dụng)
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={creatingOrder}
                className="btn-primary h-10 px-5"
              >
                {creatingOrder ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                <span>Tạo mã VietQR &amp; PayOS</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
            <div className="p-3 rounded-xl bg-white flex flex-col items-center space-y-2">
              <img
                src={order.vietqrUrl}
                alt={`Mã VietQR cho đơn ${order.orderCode}`}
                className="w-48 h-48 object-contain"
              />
              <span className="text-xs font-mono font-semibold text-slate-900">
                VIETQR • PAYOS AUTO
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <span className="text-xs font-mono text-blue-300">
                  MÃ ĐƠN HÀNG #{order.orderCode}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-200">
                  <StatusDot tone={order.status === 'PAID' ? 'ok' : 'brand'} />
                  {order.status === 'PAID' ? 'ĐÃ THANH TOÁN' : 'ĐANG CHỜ QUÉT QR'}
                </span>
              </div>

              <dl className="divide-y divide-line border-y border-line text-xs">
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-slate-300">Ngân hàng thụ hưởng</dt>
                  <dd className="font-mono font-semibold text-white">{order.bankInfo.bankName}</dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-slate-300">Số tài khoản</dt>
                  <dd className="font-mono font-semibold text-white">{order.bankInfo.accountNo}</dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-slate-300">Số tiền ({order.months} tháng)</dt>
                  <dd className="font-mono font-bold text-blue-300">
                    {order.amount.toLocaleString('vi-VN')} VNĐ
                  </dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-slate-300">Nội dung chuyển khoản</dt>
                  <dd className="flex items-center gap-2">
                    <code className="inline-code font-bold text-white">{order.description}</code>
                    <button
                      type="button"
                      onClick={handleCopyTransferContent}
                      className="btn-ghost btn-sm px-2"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedContent ? 'Đã chép' : 'Chép'}
                    </button>
                  </dd>
                </div>
              </dl>

              {error && <p className="text-xs text-rose-300">{error}</p>}

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={confirming}
                  className="btn-primary flex-1"
                >
                  {confirming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>
                    {confirming
                      ? 'Đang xác nhận VietQR / PayOS…'
                      : `Xác nhận thanh toán (+${order.months} tháng)`}
                  </span>
                </button>

                {order.payosCheckoutUrl && (
                  <a
                    href={order.payosCheckoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                  >
                    <span>Mở cổng PayOS</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setOrder(null)}
                  className="btn-ghost btn-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Đổi số tháng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
