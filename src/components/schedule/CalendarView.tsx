import { useMemo, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import SubtitlerSelect from "@/components/schedule/SubtitlerSelect";
import StaffAssignmentPanel from "@/components/schedule/StaffAssignmentPanel";
import { ScheduleViewItem } from "@/lib/buildScheduleViewData";
import { ScheduleMode } from "@/lib/scheduleConstants";
import { getSubtitlerTimeSlot } from "@/lib/scheduleHelpers";

interface CalendarViewProps {
  data: Record<string, ScheduleViewItem[]>;
  allSlots: ScheduleViewItem[];
  staffData: Array<{
    id: string;
    name: string;
    district: string;
    languages: string[];
  }>;
  mode: ScheduleMode;
  onAssign: (scheduleId: string, staffId: string) => void;
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

function countStaffAssignments(
  staffId: string,
  slots: ScheduleViewItem[]
): number {
  return slots.filter(
    s => s.subtitler1Id === staffId || s.subtitler2Id === staffId
  ).length;
}

const StaffCard = ({
  staff,
  assignmentCount,
  isSelected,
  onSelect,
}: {
  staff: {
    id: string;
    name: string;
    district: string;
    languages: string[];
  };
  assignmentCount: number;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "STAFF",
    item: { id: staff.id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      onClick={onSelect}
      className={cn(
        "p-2 mb-2 rounded cursor-pointer border transition-colors",
        isDragging && "opacity-50",
        isSelected
          ? "bg-[#D4AF37] text-white border-[#D4AF37]"
          : isDragging
            ? "border-gray-300 bg-[#2B3A67] text-white"
            : "bg-[#2B3A67] text-white border-transparent hover:border-[#D4AF37]/50"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-medium">{staff.name}</div>
        {assignmentCount > 0 && (
          <span
            className={cn(
              "text-[10px] shrink-0",
              isSelected ? "text-white/90" : "text-[#D4AF37]"
            )}
          >
            共{assignmentCount}场
          </span>
        )}
      </div>
      <div className="text-xs opacity-80">{staff.district}</div>
      <div className="text-xs opacity-80">{staff.languages.join(", ")}</div>
    </div>
  );
};

const TimeSlot = ({
  slot,
  staffData,
  mode,
  onAssign,
  onAssignmentChange,
  getAvailableSubtitlers,
  highlightStaffId,
  onInspectStaff,
}: {
  slot: ScheduleViewItem;
  staffData: Array<{
    id: string;
    name: string;
    district: string;
    languages: string[];
  }>;
  mode: ScheduleMode;
  onAssign: (scheduleId: string, staffId: string) => void;
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
  highlightStaffId: string | null;
  onInspectStaff: (staffId: string) => void;
}) => {
  const slotId = slot.id;
  const subtitlerTimeSlot = getSubtitlerTimeSlot(slot.time);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: "STAFF",
    drop: (item: { id: string }) => onAssign(slotId, item.id),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  const assignedStaff1 = staffData.find(s => s.id === slot.subtitler1Id);
  const assignedStaff2 = staffData.find(s => s.id === slot.subtitler2Id);
  const isComplete = slot.subtitler1 && slot.subtitler2;
  const isHighlighted =
    highlightStaffId &&
    (slot.subtitler1Id === highlightStaffId || slot.subtitler2Id === highlightStaffId);

  const availableForSubtitler1 = subtitlerTimeSlot
    ? getAvailableSubtitlers(
        subtitlerTimeSlot,
        slot.subtitler2 ? [slot.subtitler2] : [],
        slot.date
      )
    : staffData.map(s => ({ id: s.id, name: s.name }));

  const availableForSubtitler2 = subtitlerTimeSlot
    ? getAvailableSubtitlers(
        subtitlerTimeSlot,
        slot.subtitler1 ? [slot.subtitler1] : [],
        slot.date
      )
    : staffData.map(s => ({ id: s.id, name: s.name }));

  return (
    <div
      ref={drop}
      className={cn(
        "p-3 rounded border",
        slot.status === "available" && "bg-blue-50 border-blue-200",
        slot.status === "assigned" && "bg-[#D4AF37]/10 border-[#D4AF37]",
        slot.status === "conflict" && "bg-red-100 border-red-200",
        isComplete && "bg-green-50 border-green-300",
        isHighlighted && "ring-2 ring-[#D4AF37] ring-offset-1",
        isOver && "bg-gray-200"
      )}
    >
      <div className="mb-2">
        <div className="font-medium text-sm">{slot.movieName}</div>
        <div className="text-xs text-gray-500">{slot.cinema} · {slot.hall}</div>
        <div className="text-xs text-gray-600 mt-1">{slot.time}</div>
      </div>

      {mode === 'manual' ? (
        <div className="space-y-2">
          <div>
            <div className="text-xs text-blue-600 mb-1">字幕员1</div>
            <SubtitlerSelect
              value={slot.subtitler1}
              onChange={(value) => onAssignmentChange(slotId, 'subtitler1', value)}
              availableSubtitlers={availableForSubtitler1}
              onInspect={(s) => onInspectStaff(s.id)}
            />
          </div>
          <div>
            <div className="text-xs text-green-600 mb-1">字幕员2</div>
            <SubtitlerSelect
              value={slot.subtitler2}
              onChange={(value) => onAssignmentChange(slotId, 'subtitler2', value)}
              availableSubtitlers={availableForSubtitler2}
              onInspect={(s) => onInspectStaff(s.id)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <div className="text-blue-700">
            字幕员1: {slot.subtitler1 || assignedStaff1?.name || '-'}
          </div>
          <div className="text-green-700">
            字幕员2: {slot.subtitler2 || assignedStaff2?.name || '-'}
          </div>
        </div>
      )}
    </div>
  );
};

export default function CalendarView({
  data,
  allSlots,
  staffData,
  mode,
  onAssign,
  onAssignmentChange,
  getAvailableSubtitlers,
}: CalendarViewProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const selectedStaff = staffData.find(s => s.id === selectedStaffId) ?? null;

  const selectedStaffAssignments = useMemo(() => {
    if (!selectedStaffId) return [];
    return allSlots.filter(
      s => s.subtitler1Id === selectedStaffId || s.subtitler2Id === selectedStaffId
    );
  }, [allSlots, selectedStaffId]);

  const handleStaffSelect = (staffId: string) => {
    setSelectedStaffId(prev => (prev === staffId ? null : staffId));
  };

  return (
    <div className="flex">
      <div className="w-64 pr-4 border-r border-gray-200 shrink-0">
        <h3 className="font-bold mb-4 text-[#2B3A67]">字幕员列表</h3>
        <p className="text-xs text-gray-500 mb-3">
          点击查看排片；拖拽到场次可快速分配字幕员1
        </p>
        <div className="max-h-[500px] overflow-y-auto">
          {staffData.map(staff => (
            <StaffCard
              key={staff.id}
              staff={staff}
              assignmentCount={countStaffAssignments(staff.id, allSlots)}
              isSelected={selectedStaffId === staff.id}
              onSelect={() => handleStaffSelect(staff.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 pl-4 min-w-0">
        {selectedStaff && (
          <StaffAssignmentPanel
            staff={selectedStaff}
            assignments={selectedStaffAssignments}
          />
        )}

        {Object.entries(data).map(([date, slots]) => (
          <div key={date} className="mb-6">
            <h3 className="font-bold text-lg mb-2 text-[#2B3A67]">{date}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {slots.map(slot => (
                <TimeSlot
                  key={slot.id}
                  slot={slot}
                  staffData={staffData}
                  mode={mode}
                  onAssign={onAssign}
                  onAssignmentChange={onAssignmentChange}
                  getAvailableSubtitlers={getAvailableSubtitlers}
                  highlightStaffId={selectedStaffId}
                  onInspectStaff={(staffId) => setSelectedStaffId(staffId)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
