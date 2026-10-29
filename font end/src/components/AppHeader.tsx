import React from 'react';
import { Menu, Sparkles, User } from 'lucide-react';
import { AuthUser } from '../types';

interface AppHeaderProps {
  onOpenMobileMenu: () => void;
  user: AuthUser | null;
  onOpenLoginModal: () => void;
  questConnected: boolean;
  streamConnected: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenMobileMenu,
  user,
  onOpenLoginModal,
  questConnected,
  streamConnected,
}) => {
  return (
    <header className="lg:hidden h-14 bg-[#101116] border-b border-white/[0.08] px-4 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-2 transition-colors"
          aria-label="Mở danh mục điều hướng"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-sm text-slate-100 tracking-tight">Arychi</span>
          <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-surface-2 text-indigo-300 border border-indigo-500/30">
            v2.0
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono pr-2 border-r border-white/[0.08]">
          <span className={`w-2 h-2 rounded-full ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} title="Quest Engine" />
          <span className={`w-2 h-2 rounded-full ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} title="StreamBot" />
        </div>

        {user ? (
          <button
            onClick={onOpenLoginModal}
            className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-surface-2"
          >
            <img
              src={user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
              alt={user.username}
              className="w-6 h-6 rounded-full object-cover border border-emerald-500/40"
            />
          </button>
        ) : (
          <button
            onClick={onOpenLoginModal}
            className="btn-primary py-1 px-2.5 text-xs"
          >
            <User className="w-3 h-3" />
            <span>Kết Nối</span>
          </button>
        )}
      </div>
    </header>
  );
};
