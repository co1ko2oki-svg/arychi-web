import React, { useState } from 'react';
import {
  Sparkles,
  LayoutDashboard,
  Tv,
  Award,
  Terminal,
  Info,
  User,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { AuthUser } from '../types';

export type NavTabId = 'home' | 'about' | 'quests' | 'stream' | 'badges' | 'logs';

interface NavbarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  user: AuthUser | null;
  questConnected: boolean;
  streamConnected: boolean;
  runningQuestsCount?: number;
  streamPlaying?: boolean;
  onOpenLoginModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  user,
  questConnected,
  streamConnected,
  runningQuestsCount = 0,
  streamPlaying = false,
  onOpenLoginModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      id: 'home' as const,
      label: 'Tổng Quan',
      icon: LayoutDashboard,
      hash: '#home',
    },
    {
      id: 'quests' as const,
      label: 'Nhiệm Vụ',
      icon: Sparkles,
      hash: '#quests',
      badge: runningQuestsCount > 0 ? `${runningQuestsCount}` : undefined,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    },
    {
      id: 'stream' as const,
      label: 'StreamBot',
      icon: Tv,
      hash: '#stream',
      badge: streamPlaying ? 'LIVE' : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'badges' as const,
      label: 'Cày Giờ Chơi',
      icon: Award,
      hash: '#badges',
    },
    {
      id: 'logs' as const,
      label: 'Nhật Ký',
      icon: Terminal,
      hash: '#logs',
    },
    {
      id: 'about' as const,
      label: 'Giới Thiệu',
      icon: Info,
      hash: '#about',
    },
  ];

  const handleNavClick = (id: NavTabId, hash: string) => {
    onSelectTab(id);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#000000]/85 border-b border-white/[0.06] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('home', '#home');
              }}
              className="flex items-center gap-3 group cursor-pointer"
            >
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 border border-white/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4 fill-white/20" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#000000]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                    Arychi
                  </span>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 font-bold uppercase tracking-wider">
                    Suite v2.0
                  </span>
                </div>
              </div>
            </a>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.hash}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(item.id, item.hash);
                    }}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'text-white bg-white/[0.08] shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-bold ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
                    )}
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  {questConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                </span>
                <span className="text-slate-400">:3001</span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  {streamConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
                </span>
                <span className="text-slate-400">:3000</span>
              </div>
            </div>

            {user ? (
              <button
                onClick={onOpenLoginModal}
                className="flex items-center gap-2.5 p-1.5 pl-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-indigo-500/40 transition-all group"
              >
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold text-white group-hover:text-indigo-200 truncate max-w-[100px]">
                    @{user.username}
                  </p>
                </div>
                <div className="relative shrink-0">
                  <img
                    src={user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                    alt={user.username}
                    className="w-7 h-7 rounded-full object-cover border border-emerald-500/50"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#000000]" />
                </div>
              </button>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="btn-primary py-2 px-4 text-xs shadow-md"
              >
                <User className="w-3.5 h-3.5" />
                <span>Kết Nối Discord</span>
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#05060A]/95 backdrop-blur-2xl px-4 py-4 space-y-2">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.hash}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(item.id, item.hash);
                    }}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive
                        ? 'text-white bg-white/[0.08] border border-white/[0.08]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-bold ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </a>
                );
              })}
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-slate-400 px-2">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                Quest :3001
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
                Stream :3000
              </span>
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Navbar;
