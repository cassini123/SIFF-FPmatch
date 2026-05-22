import { useMemo } from 'react';
import { ScheduleViewItem } from '@/lib/buildScheduleViewData';

interface StaffAssignmentPanelProps {
  staff: { id: string; name: string; district: string; languages: string[] };
  assignments: ScheduleViewItem[];
}

export default function StaffAssignmentPanel({
  staff,
  assignments,
}: StaffAssignmentPanelProps) {
  const sorted = useMemo(
    () =>
      [...assignments].sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return a.time.localeCompare(b.time);
      }),
    [assignments]
  );

  return (
    <div className="mb-4 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/5 p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <h4 className="font-bold text-[#2B3A67]">{staff.name}</h4>
        <span className="text-xs text-gray-500">{staff.district}</span>
        <span className="text-xs text-gray-500">共 {sorted.length} 场</span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">暂未分配到任何场次</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {sorted.map(slot => {
            const role =
              slot.subtitler1Id === staff.id
                ? '字幕员1'
                : slot.subtitler2Id === staff.id
                  ? '字幕员2'
                  : '';
            return (
              <li
                key={slot.id}
                className="text-sm border-b border-gray-100 pb-2 last:border-0"
              >
                <div className="font-medium text-gray-800">{slot.movieName}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {slot.date} {slot.time} · {slot.cinema} {slot.hall}
                  {role && <span className="ml-2 text-[#2B3A67]">{role}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
