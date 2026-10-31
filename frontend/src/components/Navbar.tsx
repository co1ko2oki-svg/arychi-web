import React, { useEffect, useState } from 'react';
import { KeyRound, Menu, X } from 'lucide-react';
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
}

interface NavItem {
  id: NavTabId;
  label: string;
  indicator?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  user,
  subscription,
  questConnected,
  streamConnected,
  runningQuestsCount = 0,
  streamPlaying = false,
  onOpenLoginModal,
  onOpenSubscriptionModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  const navItems: NavItem[] = [
    { id: 'home', label: 'Tổng quan' },
    {
      id: 'quests',
      label: 'Nhiệm vụ',
      indicator:
        runningQuestsCount > 0 ? (
          <span className="text-xs tabular-nums font-medium text-blue-300">{runningQuestsCount}</span>
        ) : undefined,
    },
    {
      id: 'stream',
      label: 'StreamBot',
      indicator: streamPlaying ? <StatusDot tone="error" /> : undefined,
    },
    { id: 'badges', label: 'Giờ chơi' },
    { id: 'logs', label: 'Nhật ký' },
    { id: 'about', label: 'Giới thiệu' },
  ];

  const go = (e: React.MouseEvent, id: NavTabId) => {
    e.preventDefault();
    onSelectTab(id);
  };

  const services = (
    <>
      <span className="inline-flex items-center gap-1.5" title={`Quest Engine :3001 — ${questConnected ? 'đang kết nối' : 'mất kết nối'}`}>
        <StatusDot tone={questConnected ? 'ok' : 'error'} />
        Quest
      </span>
      <span className="inline-flex items-center gap-1.5" title={`StreamBot :3000 — ${streamConnected ? 'đang kết nối' : 'mất kết nối'}`}>
        <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
        Stream
      </span>
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-[#07080C]/90 backdrop-blur-md border-b border-line">
      <div className="page h-14 flex items-center gap-6">
        <a href="#home" onClick={(e) => go(e, 'home')} className="flex items-center gap-2.5 shrink-0 rounded-md">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-blue-600 text-white text-[13px] font-bold border border-blue-400/30">
            A
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">Arychi</span>
        </a>

        <nav aria-label="Điều hướng chính" className="hidden md:flex items-center self-stretch">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => go(e, item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-1.5 h-full px-3 text-[13px] font-medium transition-colors ${
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {item.indicator}
                {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-blue-500" />}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-slate-400 mr-1">{services}</div>

          {onOpenSubscriptionModal && (
            <button
              type="button"
              onClick={() => onOpenSubscriptionModal(subscription?.planId || 'pro')}
              className="btn-secondary btn-sm h-8 px-3"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-400" />
              <span>{subscription ? subscription.planName : 'Mua gói'}</span>
            </button>
          )}

          {user ? (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="flex items-center gap-2 h-8 pl-1 pr-2.5 rounded-full bg-[#141722] border border-line hover:border-line-strong transition-colors"
              aria-label={`Tài khoản @${user.username}`}
            >
              <img
                src={user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                alt=""
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="hidden sm:block text-[13px] font-medium text-slate-200 max-w-[110px] truncate">{user.username}</span>
            </button>
          ) : (
            <button type="button" onClick={onOpenLoginModal} className="btn-primary h-8 px-3 text-xs">
              Kết nối Bot
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden btn-ghost btn-sm px-1.5"
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-nav" className="md:hidden border-t border-line bg-[#07080C]">
          <nav aria-label="Điều hướng chính" className="page py-2">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => go(e, item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between h-11 px-2 -mx-2 rounded-md text-sm font-medium ${
                    active ? 'text-white bg-white/[0.06]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                  {item.indicator}
                </a>
              );
            })}
          </nav>
          <div className="page py-3 border-t border-line flex items-center gap-4 text-xs text-slate-400">{services}</div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
