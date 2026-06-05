import { useMemo, useState, useRef, useEffect } from 'react';
import { ScheduleTable } from '@/contexts/ScheduleContext';
import { ScheduleViewItem } from '@/lib/buildScheduleViewData';
import { getSlotKey } from '@/lib/scheduleConstants';
import { cn } from '@/lib/utils';

interface ScheduleOverviewSearchProps {
  scheduleTable: ScheduleTable | null;
  scheduleViewData: ScheduleViewItem[];
  onNavigateToSlot: (slotKey: string) => void;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function findMovieMatches(
  scheduleTable: ScheduleTable | null,
  query: string
): { key: string; label: string }[] {
  if (!scheduleTable) return [];
  const q = normalizeQuery(query);
  if (!q) return [];

  return scheduleTable.cells
    .filter(cell => {
      if (!cell.movieName) return false;
      const name = cell.movieName.toLowerCase();
      const code = cell.movieCode.toLowerCase();
      return name.includes(q) || code.includes(q);
    })
    .map(cell => {
      const key = getSlotKey(cell.date, cell.cinema, cell.hall, cell.timeSlot);
      const codePrefix = cell.movieCode ? `[${cell.movieCode}] ` : '';
      return {
        key,
        label: `${codePrefix}${cell.movieName} · ${cell.date} ${cell.timeSlot} · ${cell.cinema} ${cell.hall}`,
      };
    })
    .slice(0, 12);
}

function findSubtitlerMatches(
  scheduleViewData: ScheduleViewItem[],
  query: string
): ScheduleViewItem[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  return scheduleViewData
    .filter(
      item =>
        item.subtitler1?.toLowerCase().includes(q) ||
        item.subtitler2?.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.time.localeCompare(b.time);
    })
    .slice(0, 12);
}

export default function ScheduleOverviewSearch({
  scheduleTable,
  scheduleViewData,
  onNavigateToSlot,
}: ScheduleOverviewSearchProps) {
  const [movieQuery, setMovieQuery] = useState('');
  const [subtitlerQuery, setSubtitlerQuery] = useState('');
  const [movieOpen, setMovieOpen] = useState(false);
  const [subtitlerOpen, setSubtitlerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const movieMatches = useMemo(
    () => findMovieMatches(scheduleTable, movieQuery),
    [scheduleTable, movieQuery]
  );

  const subtitlerMatches = useMemo(
    () => findSubtitlerMatches(scheduleViewData, subtitlerQuery),
    [scheduleViewData, subtitlerQuery]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMovieOpen(false);
        setSubtitlerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMovieSelect = (key: string) => {
    onNavigateToSlot(key);
    setMovieOpen(false);
  };

  const handleSubtitlerSelect = (item: ScheduleViewItem) => {
    onNavigateToSlot(item.id);
    setSubtitlerOpen(false);
  };

  const handleMovieSubmit = () => {
    if (movieMatches.length === 0) return;
    handleMovieSelect(movieMatches[0].key);
  };

  return (
    <div ref={containerRef} className="flex items-start gap-2">
      <div className="relative">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={movieQuery}
            onChange={e => {
              setMovieQuery(e.target.value);
              setMovieOpen(true);
              setSubtitlerOpen(false);
            }}
            onFocus={() => {
              setMovieOpen(true);
              setSubtitlerOpen(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleMovieSubmit();
              }
              if (e.key === 'Escape') setMovieOpen(false);
            }}
            placeholder="搜索影片名称/编号"
            className="w-44 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
          <button
            type="button"
            onClick={handleMovieSubmit}
            disabled={movieMatches.length === 0}
            className={cn(
              'rounded-lg px-2 py-1.5 text-sm transition-colors',
              movieMatches.length > 0
                ? 'bg-[#2B3A67] text-white hover:bg-[#2B3A67]/90'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
            title="定位到影片"
          >
            <i className="fa-solid fa-film" />
          </button>
        </div>
        {movieOpen && movieQuery.trim() && (
          <div className="absolute right-0 top-full z-40 mt-1 w-80 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {movieMatches.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">未找到匹配影片</div>
            ) : (
              movieMatches.map(match => (
                <button
                  key={match.key}
                  type="button"
                  onClick={() => handleMovieSelect(match.key)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[#D4AF37]/10 border-b border-gray-50 last:border-0"
                >
                  {match.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={subtitlerQuery}
          onChange={e => {
            setSubtitlerQuery(e.target.value);
            setSubtitlerOpen(true);
            setMovieOpen(false);
          }}
          onFocus={() => {
            setSubtitlerOpen(true);
            setMovieOpen(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') setSubtitlerOpen(false);
          }}
          placeholder="搜索字幕员"
          className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
        {subtitlerOpen && subtitlerQuery.trim() && (
          <div className="absolute right-0 top-full z-40 mt-1 w-80 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {subtitlerMatches.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">该字幕员暂无排片</div>
            ) : (
              subtitlerMatches.map(item => {
                const role =
                  item.subtitler1 &&
                  normalizeQuery(subtitlerQuery) &&
                  item.subtitler1.toLowerCase().includes(normalizeQuery(subtitlerQuery))
                    ? item.subtitler1
                    : item.subtitler2;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSubtitlerSelect(item)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[#D4AF37]/10 border-b border-gray-50 last:border-0"
                  >
                    <div className="font-medium text-gray-800 truncate">{item.movieName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.date} {item.time} · {item.cinema} {item.hall}
                      {role && <span className="ml-1 text-[#2B3A67]">({role})</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
