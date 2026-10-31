import React, { useState } from 'react';
import { ArrowUpRight, KeyRound, Menu, ShieldCheck, X } from 'lucide-react';
import { AuthUser, PlanTierId, UserSubscription } from '../types';
import { StatusDot } from './ui';

export type NavTabId = 'home' | 'about' | 'quests' | 'stream' | 'badges' | 'logs';

interface NavbarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  user: AuthUser | null;
  subscription?: UserSubscription | null;
  questConnected: boolean;
  streamConnected: boolean;
  runningQuestsCount?: number;
  streamPlaying?: boolean;
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal?: (planId?: PlanTierId) => void;
  onEnterDashboard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  subscription,
  questConnected,
  streamConnected,
  onOpenLoginModal,
  onOpenSubscriptionModal,
  onEnterDashboard,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sectionLinks = [
    { href: '#intro', label: 'Giới thiệu' },
    { href: '#modules', label: 'Tính năng' },
    { href: '#pricing', label: 'Gói 50k/tháng' },
    { href: '#architecture', label: 'Kiến trúc' },
    { href: '#faq', label: 'Hỏi đáp' },
  ];

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const el = document.querySelector(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const hasActivePlan = Boolean(subscription && subscription.isActive !== false);

  return (
    <header className="sticky top-0 z-40 bg-[#07080C]/95 backdrop-blur-md border-b border-line">
      <div className="page h-14 flex items-center gap-6">
        <a
          href="#intro"
          onClick={(e) => scrollTo(e, '#intro')}
          className="flex items-center gap-2.5 shrink-0 rounded-md"
        >
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-blue-600 text-white text-[13px] font-bold border border-blue-400/30">
            A
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">Arychi</span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#141722] border border-line text-2xs font-mono text-blue-300">
            arychi.xyz
          </span>
        </a>

        <nav aria-label="Điều hướng trang giới thiệu" className="hidden md:flex items-center self-stretch">
          {sectionLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => scrollTo(e, item.href)}
              className="flex items-center h-full px-3 text-[13px] font-medium text-slate-300 hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden xl:flex items-center gap-3 text-xs font-mono text-slate-300 mr-1">
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={questConnected ? 'ok' : 'error'} />
              Quest :3001
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
              Stream :3000
            </span>
          </div>

          {onOpenSubscriptionModal && (
            <button
              type="button"
              onClick={() => onOpenSubscriptionModal('monthly_50k')}
              className="btn-secondary btn-sm h-8 px-3"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {hasActivePlan
                  ? `Gói 50k (${subscription?.daysRemaining ?? 30}d)`
                  : 'Mua gói 50k/tháng'}
              </span>
            </button>
          )}

          {user ? (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="btn-secondary btn-sm h-8 px-3"
              aria-label={`Tài khoản @${user.username}`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="max-w-[110px] truncate">@{user.username}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="btn-secondary btn-sm h-8 px-3"
            >
              Đăng nhập OAuth2
            </button>
          )}

          {onEnterDashboard && (
            <button
              type="button"
              onClick={onEnterDashboard}
              className="btn-primary h-8 px-3 text-xs"
            >
              <span>dash.arychi.xyz</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden btn-ghost btn-sm px-1.5"
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-line bg-[#07080C]">
          <nav aria-label="Điều hướng di động" className="page py-2">
            {sectionLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => scrollTo(e, item.href)}
                className="flex items-center justify-between h-10 px-2 rounded-md text-sm font-medium text-slate-300 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
