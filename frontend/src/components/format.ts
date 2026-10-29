import { LogEntry } from '../types';

const SOURCE_PREFIX = /^\[(StreamBot)\]\s*/;

export interface ParsedLog {
  time: string;
  source: string;
  message: string;
  level: LogEntry['level'];
}

export const levelLabel: Record<LogEntry['level'], string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  success: 'OK',
};

export const levelClass: Record<LogEntry['level'], string> = {
  info: 'text-zinc-500',
  warn: 'text-amber-400',
  error: 'text-rose-400',
  success: 'text-emerald-400',
};

export const formatTime = (timestamp: string) => {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('vi-VN', { hour12: false });
};

export const parseLog = (log: LogEntry): ParsedLog => {
  const match = log.message.match(SOURCE_PREFIX);
  return {
    time: formatTime(log.timestamp),
    source: match ? match[1] : 'Quest',
    message: match ? log.message.slice(match[0].length) : log.message,
    level: log.level,
  };
};

export const formatPing = (connected: boolean, ping?: number) =>
  connected && typeof ping === 'number' && ping >= 0 ? `${ping} ms` : '—';
