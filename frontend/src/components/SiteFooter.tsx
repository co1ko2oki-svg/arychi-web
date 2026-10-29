import React from 'react';
import { NavTabId } from './Navbar';

interface SiteFooterProps {
  onNavigateTab: (tab: NavTabId) => void;
}

const links: Array<{ id: NavTabId; label: string }> = [
  { id: 'quests', label: 'Nhiệm vụ' },
  { id: 'stream', label: 'StreamBot' },
  { id: 'logs', label: 'Nhật ký' },
  { id: 'about', label: 'Giới thiệu' },
];

export const SiteFooter: React.FC<SiteFooterProps> = ({ onNavigateTab }) => (
  <footer className="border-t border-line">
    <div className="page py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500">
      <p>
        <span className="text-zinc-300 font-medium">Arychi Suite 2.0</span> — chạy cục bộ trên 127.0.0.1. Không liên kết với Discord Inc.
      </p>
      <nav aria-label="Liên kết cuối trang" className="flex items-center gap-4">
        {links.map((l) => (
          <a
            key={l.id}
            href={`#${l.id}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigateTab(l.id);
            }}
            className="hover:text-zinc-200 transition-colors"
          >
            {l.label}
          </a>
        ))}
      </nav>
    </div>
  </footer>
);

export default SiteFooter;
