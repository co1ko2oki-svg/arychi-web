import React, { useMemo, useState } from 'react';
import { Gamepad2, Video } from 'lucide-react';
import { QuestDTO } from '../types';

interface QuestThumbnailProps {
  quest: QuestDTO;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
};

export const QuestThumbnail: React.FC<QuestThumbnailProps> = ({
  quest,
  size = 'md',
  className = '',
}) => {
  const isVideo = quest.task.type.includes('VIDEO');

  // Build ordered list of candidate URLs
  const candidateUrls = useMemo(() => {
    const list: string[] = [];
    const add = (url?: string | null) => {
      if (url && typeof url === 'string') {
        const trimmed = url.trim();
        if (trimmed && !list.includes(trimmed)) {
          list.push(trimmed);
        }
      }
    };

    add(quest.application?.iconUrl);
    add(quest.assets?.gameTile);
    add(quest.assets?.hero);
    add(quest.assets?.banner);
    add(quest.rewards?.assetUrl);

    if (quest.id) {
      add(`https://cdn.discordapp.com/quest-assets/${quest.id}/${quest.id}.png`);
      add(`https://cdn.discordapp.com/assets/quests/${quest.id}/dark/hero.png`);
    }
    if (quest.application?.id) {
      add(`https://cdn.discordapp.com/app-icons/${quest.application.id}/icon.png?size=256`);
    }

    return list;
  }, [
    quest.id,
    quest.application?.id,
    quest.application?.iconUrl,
    quest.assets?.gameTile,
    quest.assets?.hero,
    quest.assets?.banner,
    quest.rewards?.assetUrl,
  ]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  const currentUrl = candidateUrls[candidateIndex];
  const allCandidatesFailed = candidateIndex >= candidateUrls.length;

  const handleImageError = () => {
    setCandidateIndex((prev) => prev + 1);
    setHasLoaded(false);
  };

  const handleImageLoad = () => {
    setHasLoaded(true);
  };

  const containerSizeClass = sizeClasses[size];
  const iconSizeClass = iconSizes[size];

  // If no candidate exists or all failed, render a clean, high-contrast SVG badge
  if (allCandidatesFailed || !currentUrl) {
    return (
      <div
        className={`${containerSizeClass} flex items-center justify-center shrink-0 bg-gradient-to-br from-[#212c27] via-[#1a231f] to-[#141b17] border border-[#3b4c42] relative overflow-hidden select-none shadow-sm ${className}`}
        title={quest.name}
        aria-hidden="true"
      >
        {isVideo ? (
          <Video className={`${iconSizeClass} text-[#8e96e8]`} />
        ) : (
          <Gamepad2 className={`${iconSizeClass} text-[#72b991]`} />
        )}
      </div>
    );
  }

  return (
    <div
      className={`${containerSizeClass} relative overflow-hidden shrink-0 bg-[#161e1a] border border-[#2d3b33] select-none ${className}`}
    >
      {/* Subtle skeleton placeholder while image fades in */}
      {!hasLoaded && (
        <div className="absolute inset-0 bg-[#1a231f] flex items-center justify-center text-[#9aa8a0]">
          {isVideo ? (
            <Video className="w-3.5 h-3.5 opacity-40 text-[#8e96e8]" />
          ) : (
            <Gamepad2 className="w-3.5 h-3.5 opacity-40 text-[#72b991]" />
          )}
        </div>
      )}

      <img
        key={currentUrl}
        src={currentUrl}
        alt={quest.name || 'Quest thumbnail'}
        loading="lazy"
        decoding="async"
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`w-full h-full object-cover transition-opacity duration-300 ease-out ${
          hasLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
