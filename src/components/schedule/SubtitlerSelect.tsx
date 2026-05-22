import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface SubtitlerSelectProps {
  value: string | null;
  onChange: (name: string | null) => void;
  availableSubtitlers: { id: string; name: string }[];
  disabled?: boolean;
  /** 点击「查看」时展示该字幕员已排场次 */
  onInspect?: (subtitler: { id: string; name: string }) => void;
}

export default function SubtitlerSelect({
  value,
  onChange,
  availableSubtitlers,
  disabled,
  onInspect,
}: SubtitlerSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredSubtitlers = useMemo(() => {
    if (!search) return availableSubtitlers;
    return availableSubtitlers.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [availableSubtitlers, search]);

  return (
    <div className="relative">
      <div
        className={cn(
          'border rounded px-2 py-1 text-xs cursor-pointer min-w-[80px]',
          disabled ? 'bg-gray-100 cursor-not-allowed opacity-75' : 'hover:border-gray-400',
          value ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-300'
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {value || '-'}
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border rounded-lg shadow-lg w-44 max-h-60 overflow-hidden">
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="搜索..."
              className="w-full px-2 py-1 text-sm border rounded"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredSubtitlers.length === 0 ? (
              <div className="p-2 text-sm text-gray-500 text-center">此时段无空闲字幕员</div>
            ) : (
              filteredSubtitlers.map(subtitler => (
                <div
                  key={subtitler.id}
                  className="px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => {
                      onChange(subtitler.name);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    {subtitler.name}
                  </button>
                  {onInspect && (
                    <button
                      type="button"
                      className="text-xs text-[#2B3A67] hover:underline shrink-0"
                      title="查看该字幕员已排场次"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspect(subtitler);
                        setIsOpen(false);
                        setSearch('');
                      }}
                    >
                      查看
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div
            className="p-2 text-sm text-red-500 hover:bg-red-50 cursor-pointer border-t text-center"
            onClick={() => {
              onChange(null);
              setIsOpen(false);
              setSearch('');
            }}
          >
            清除
          </div>
        </div>
      )}
    </div>
  );
}
