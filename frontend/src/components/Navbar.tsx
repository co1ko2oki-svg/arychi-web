import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ChevronRight, KeyRound, Menu, ShieldCheck, X } from 'lucide-react';
import { AuthUser, PlanTierId, UserSubscription } from '../types';
import { questApi } from '../services/api';

export type NavTabId = 'home' | 'about' | 'quests' | 'stream' | 'badges' | 'logs';

export const DiscordIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 127.14 96.36"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
  </svg>
);

interface NavbarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  user: AuthUser | null;
  subscription?: UserSubscription | null;
  questConnected?: boolean;
  streamConnected?: boolean;
  runningQuestsCount?: number;
  streamPlaying?: boolean;
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal?: (planId?: PlanTierId) => void;
  onEnterDashboard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  subscription,
  onOpenLoginModal,
  onOpenSubscriptionModal,
  onEnterDashboard,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('intro');

  const sectionLinks = [
    { href: '#intro', id: 'intro', label: 'Giới thiệu' },
    { href: '#modules', id: 'modules', label: 'Tính năng' },
    { href: '#pricing', id: 'pricing', label: 'Gói 20k/tháng' },
    { href: '#architecture', id: 'architecture', label: 'Kiến trúc' },
    { href: '#faq', id: 'faq', label: 'Hỏi đáp' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const targetId = href.replace('#', '');
    setActiveSection(targetId);

    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDiscordLogin = async () => {
    try {
      const res = await questApi.getOAuthConfig();
      if (res?.oauth?.discordAuthUrl) {
        window.location.href = res.oauth.discordAuthUrl;
        return;
      }
    } catch {
      // Fallback directly
    }
    const clientId = '1566061523636330497';
    const redirectUri = window.location.origin;
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=identify+guilds+guilds.join`;
  };

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const sections = ['intro', 'modules', 'pricing', 'architecture', 'faq'];
          let currentSection = sections[0];
          for (const sectionId of sections) {
            const el = document.getElementById(sectionId);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= 120) {
                currentSection = sectionId;
              }
            }
          }
          setActiveSection(currentSection);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const hasActivePlan = Boolean(subscription && subscription.isActive !== false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#07080C]/95 backdrop-blur-md border-b border-[#1E2230]">
      <div className="page h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <a
          href="#intro"
          onClick={(e) => handleNavClick(e, '#intro')}
          className="flex items-center gap-2.5 shrink-0 select-none"
        >
          <span className="grid place-items-center w-7 h-7 rounded-md bg-blue-600 text-white text-[13px] font-bold border border-blue-400/30">
            A
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">Arychi</span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#141722] border border-[#1E2230] text-[11px] font-mono text-blue-300">
            arychi.xyz
          </span>
        </a>

        {/* Center Nav Links */}
        <nav aria-label="Điều hướng trang giới thiệu" className="hidden lg:flex items-center gap-1">
          {sectionLinks.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ${
                  isActive
                    ? 'text-white bg-[#141722] font-semibold border border-[#1E2230]'
                    : 'text-slate-300 hover:text-white hover:bg-[#141722]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {onOpenSubscriptionModal && (
            <button
              type="button"
              onClick={() => onOpenSubscriptionModal('monthly_20k')}
              className={`hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150 shrink-0 ${
                hasActivePlan
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-[#141722] hover:bg-[#1C2030] text-slate-200 border border-[#1E2230]'
              }`}
            >
              <KeyRound
                className={`w-3.5 h-3.5 ${hasActivePlan ? 'text-emerald-400' : 'text-blue-400'}`}
              />
              <span>
                {hasActivePlan
                  ? `Gói 20k (${subscription?.daysRemaining ?? 30}d)`
                  : 'Mua gói 20k/tháng'}
              </span>
            </button>
          )}

          {/* User Account / Discord Login Button */}
          {user ? (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium whitespace-nowrap bg-[#141722] hover:bg-[#1C2030] text-slate-200 border border-[#1E2230] transition-colors duration-150 shrink-0"
              aria-label={`Tài khoản @${user.username}`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="max-w-[100px] truncate">@{user.username}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-xl bg-white hover:bg-[#F2F3F5] text-black font-bold transition-all duration-150 active:scale-95 shadow-sm border border-white/40 shrink-0 cursor-pointer"
              title="Đăng nhập tài khoản Discord (OAuth2 hoặc Token)"
            >
              <DiscordIcon className="w-4 h-4 text-black shrink-0" />
              <div className="text-[11px] font-bold leading-[1.1] text-black text-left select-none">
                <div>Đăng</div>
                <div>nhập</div>
              </div>
            </button>
          )}

          {onEnterDashboard && (
            <button
              type="button"
              onClick={onEnterDashboard}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/50 transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              <span>dash.arychi.xyz</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#141722] border border-[#1E2230] text-slate-300 hover:text-white transition-colors"
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#1E2230] bg-[#07080C]">
          <div className="page py-3 space-y-2">
            <nav aria-label="Điều hướng di động" className="space-y-1">
              {sectionLinks.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className={`flex items-center justify-between h-9 px-3 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-white bg-[#141722] font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-[#141722]'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </a>
                );
              })}
            </nav>

            <div className="pt-2 border-t border-[#1E2230] space-y-2">
              {!user && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleDiscordLogin();
                  }}
                  className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-white hover:bg-[#F2F3F5] text-black font-bold text-xs"
                >
                  <DiscordIcon className="w-4 h-4 text-black" />
                  <span>Đăng nhập Discord (OAuth2)</span>
                </button>
              )}

              {onOpenSubscriptionModal && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenSubscriptionModal('monthly_20k');
                  }}
                  className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-[#141722] hover:bg-[#1C2030] text-slate-200 border border-[#1E2230] text-xs font-medium"
                >
                  <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {hasActivePlan
                      ? `Gói 20k (${subscription?.daysRemaining ?? 30}d)`
                      : 'Mua gói 20k/tháng'}
                  </span>
                </button>
              )}

              {onEnterDashboard && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onEnterDashboard();
                  }}
                  className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  <span>Vào dash.arychi.xyz</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
