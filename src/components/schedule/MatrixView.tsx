import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import SubtitlerSelect from "@/components/schedule/SubtitlerSelect";
import StaffAssignmentPanel from "@/components/schedule/StaffAssignmentPanel";
import { ScheduleViewItem } from "@/lib/buildScheduleViewData";
import { ScheduleMode } from "@/lib/scheduleConstants";
import { getSubtitlerTimeSlot } from "@/lib/scheduleHelpers";

interface MatrixViewProps {
  data: ScheduleViewItem[];
  allSlots: ScheduleViewItem[];
  staffData: Array<{
    id: string;
    name: string;
    district: string;
    languages: string[];
  }>;
  mode: ScheduleMode;
  onAssignmentChange: (
    scheduleId: string,
    field: 'subtitler1' | 'subtitler2',
    value: string | null
  ) => void;
  getAvailableSubtitlers: (
    subtitlerTimeSlot: string,
    assignedSubtitlers: string[],
    date: string
  ) => { id: string; name: string }[];
}

function countStaffAssignments(staffId: string, slots: ScheduleViewItem[]): number {
  return slots.filter(
    s => s.subtitler1Id === staffId || s.subtitler2Id === staffId
  ).length;
}

export default function MatrixView({
  data,
  allSlots,
  staffData,
  mode,
  onAssignmentChange,
  getAvailableSubtitlers,
}: MatrixViewProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const selectedStaff = staffData.find(s => s.id === selectedStaffId) ?? null;
  const selectedStaffAssignments = useMemo(() => {
    if (!selectedStaffId) return [];
    return allSlots.filter(
      s => s.subtitler1Id === selectedStaffId || s.subtitler2Id === selectedStaffId
    );
  }, [allSlots, selectedStaffId]);

  const handleInspect = (subtitler: { id: string; name: string }) => {
    setSelectedStaffId(subtitler.id);
  };

  return (
    <div className="flex gap-4">
      <div className="w-56 shrink-0 border-r border-gray-200 pr-4">
        <h3 className="font-bold mb-3 text-[#2B3A67] text-sm">字幕员</h3>
        <p className="text-xs text-gray-500 mb-2">点击查看已排场次</p>
        <div className="max-h-[480px] overflow-y-auto space-y-1">
          {staffData.map(staff => (
            <button
              key={staff.id}
              type="button"
              onClick={() =>
                setSelectedStaffId(prev => (prev === staff.id ? null : staff.id))
              }
              className={cn(
                "w-full text-left px-2 py-2 rounded text-sm transition-colors",
                selectedStaffId === staff.id
                  ? "bg-[#D4AF37] text-white"
                  : "hover:bg-gray-100 text-gray-800"
              )}
            >
              <div className="font-medium">{staff.name}</div>
              {countStaffAssignments(staff.id, allSlots) > 0 && (
                <div
                  className={cn(
                    "text-xs mt-0.5",
                    selectedStaffId === staff.id ? "text-white/90" : "text-gray-500"
                  )}
                >
                  共{countStaffAssignments(staff.id, allSlots)}场
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {selectedStaff && (
          <StaffAssignmentPanel
            staff={selectedStaff}
            assignments={selectedStaffAssignments}
          />
        )}

        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  日期/时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  影片
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                  字幕员1
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                  字幕员2
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((item, index) => {
                const slotId = item.id;
                const subtitlerTimeSlot = getSubtitlerTimeSlot(item.time);
                const isComplete = item.subtitler1 && item.subtitler2;

                const availableForSubtitler1 = subtitlerTimeSlot
                  ? getAvailableSubtitlers(
                      subtitlerTimeSlot,
                      item.subtitler2 ? [item.subtitler2] : [],
                      item.date
                    )
                  : staffData.map(s => ({ id: s.id, name: s.name }));

                const availableForSubtitler2 = subtitlerTimeSlot
                  ? getAvailableSubtitlers(
                      subtitlerTimeSlot,
                      item.subtitler1 ? [item.subtitler1] : [],
                      item.date
                    )
                  : staffData.map(s => ({ id: s.id, name: s.name }));

                return (
                  <tr
                    key={slotId}
                    className={cn(
                      index % 2 === 0 ? "bg-white" : "bg-gray-50",
                      item.status === "conflict" && "bg-red-50",
                      isComplete && "bg-green-50",
                      selectedStaffId &&
                        (item.subtitler1Id === selectedStaffId ||
                          item.subtitler2Id === selectedStaffId) &&
                        "ring-1 ring-inset ring-[#D4AF37]"
                    )}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div>{item.date}</div>
                      <div className="text-gray-500">{item.time}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{item.movieName}</div>
                      <div className="text-xs text-gray-500">{item.cinema} · {item.hall}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {mode === 'manual' ? (
                        <SubtitlerSelect
                          value={item.subtitler1}
                          onChange={(value) => onAssignmentChange(slotId, 'subtitler1', value)}
                          availableSubtitlers={availableForSubtitler1}
                          onInspect={handleInspect}
                        />
                      ) : (
                        <span
                          className={cn(
                            "px-2 py-1 text-xs rounded inline-block",
                            item.subtitler1 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-500"
                          )}
                        >
                          {item.subtitler1 || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {mode === 'manual' ? (
                        <SubtitlerSelect
                          value={item.subtitler2}
                          onChange={(value) => onAssignmentChange(slotId, 'subtitler2', value)}
                          availableSubtitlers={availableForSubtitler2}
                          onInspect={handleInspect}
                        />
                      ) : (
                        <span
                          className={cn(
                            "px-2 py-1 text-xs rounded inline-block",
                            item.subtitler2 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                          )}
                        >
                          {item.subtitler2 || '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
