import React from 'react';
import { useDrag, useDrop } from "react-dnd";
import { cn } from "@/lib/utils";

interface ScheduleSlot {
  id?: string;
  date: string;
  time?: string;
  film: string;
  staff: string;
  status: "available" | "assigned" | "conflict";
}

interface CalendarViewProps {
  data: Record<string, ScheduleSlot[]>;
  staffData: Array<{
    id: string;
    name: string;
    district: string;
    languages: string[];
  }>;
  onAssign: (scheduleId: string, staffId: string) => void;
  onUnassign: (scheduleId: string) => void;
}

const StaffCard = ({ staff, onDrop }: {
  staff: {
    id: string;
    name: string;
    district: string;
    languages: string[];
  };
  onDrop: (item: any) => void;
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
      className={cn(
        "p-2 mb-2 rounded cursor-move border border-transparent",
        isDragging ? "opacity-50 border-gray-300" : "bg-[#2B3A67] text-white"
      )}
    >
      <div className="font-medium">{staff.name}</div>
      <div className="text-xs">{staff.district}</div>
      <div className="text-xs">{staff.languages.join(", ")}</div>
    </div>
  );
};

const TimeSlot = ({ slot, staffData, onAssign, onUnassign }: {
  slot: ScheduleSlot;
  staffData: Array<{
    id: string;
    name: string;
    district: string;
    languages: string[];
  }>;
  onAssign: (scheduleId: string, staffId: string) => void;
  onUnassign: (scheduleId: string) => void;
}) => {
  const slotId = slot.id ?? slot.date;

  const [{ isOver }, drop] = useDrop(() => ({
    accept: "STAFF",
    drop: (item: { id: string }) => onAssign(slotId, item.id),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  const assignedStaff = staffData.find(s => s.id === slot.staff);

  return (
    <div
      ref={drop}
      className={cn(
        "p-2 rounded border",
        slot.status === "available" && "bg-blue-100 border-blue-200",
        slot.status === "assigned" && "bg-[#D4AF37]/20 border-[#D4AF37]",
        slot.status === "conflict" && "bg-red-100 border-red-200",
        isOver && "bg-gray-200"
      )}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">{slot.film}</div>
          <div className="text-sm text-gray-600">
            {slot.time ?? slot.date.split(" ")[1]}
          </div>
        </div>
        {slot.staff && (
          <button
            onClick={() => onUnassign(slotId)}
            className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
          >
            取消
          </button>
        )}
      </div>
      {assignedStaff && (
        <div className="mt-2 p-1 bg-[#2B3A67]/10 rounded text-sm">
          {assignedStaff.name}
        </div>
      )}
    </div>
  );
};

export default function CalendarView({ data, staffData, onAssign, onUnassign }: CalendarViewProps) {
  return (
    <div className="flex">
      {/* 人员列表 */}
      <div className="w-64 pr-4 border-r border-gray-200">
        <h3 className="font-bold mb-4 text-[#2B3A67]">字幕员列表</h3>
        <div className="max-h-[500px] overflow-y-auto">
          {staffData.map(staff => (
            <StaffCard key={staff.id} staff={staff} onDrop={() => {}} />
          ))}
        </div>
      </div>

      {/* 时间轴 */}
      <div className="flex-1 pl-4">
        {Object.entries(data).map(([date, slots]) => (
          <div key={date} className="mb-6">
            <h3 className="font-bold text-lg mb-2 text-[#2B3A67]">{date}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {slots.map(slot => (
                <TimeSlot
                  key={slot.id ?? slot.date}
                  slot={slot}
                  staffData={staffData}
                  onAssign={onAssign}
                  onUnassign={onUnassign}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
