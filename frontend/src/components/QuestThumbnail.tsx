import React, { useMemo, useState } from 'react';
import { Gamepad2, Video } from 'lucide-react';
import { QuestDTO } from '../types';

interface QuestThumbnailProps {
  quest: QuestDTO;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 rounded-md',
  md: 'w-9 h-9 rounded-lg',
  lg: 'w-11 h-11 rounded-lg',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-4.5 h-4.5',
  lg: 'w-5 h-5',
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

    return list;
  }, [
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
    // Gracefully try next candidate URL in priority chain
    setCandidateIndex((prev) => prev + 1);
    setHasLoaded(false);
  };

  const handleImageLoad = () => {
    setHasLoaded(true);
  };

  const containerSizeClass = sizeClasses[size];
  const iconSizeClass = iconSizes[size];

  // If no candidate exists or all failed, render a clean SVG badge
  if (allCandidatesFailed || !currentUrl) {
    const initial = (quest.name || quest.application.name || 'Q').charAt(0).toUpperCase();

    return (
      <div
        className={`${containerSizeClass} flex items-center justify-center shrink-0 bg-[#161e1a] border border-[#2d3b33] text-[#9aa8a0] relative overflow-hidden select-none ${className}`}
        title={quest.name}
        aria-hidden="true"
      >
        <div className="flex flex-col items-center justify-center">
          {isVideo ? (
            <Video className={`${iconSizeClass} text-[#8e96e8]`} />
          ) : (
            <Gamepad2 className={`${iconSizeClass} text-[#72b991]`} />
          )}
          <span className="text-xs font-bold font-mono text-[#9aa8a0] mt-0.5 leading-none">
            {initial}
          </span>
        </div>
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
