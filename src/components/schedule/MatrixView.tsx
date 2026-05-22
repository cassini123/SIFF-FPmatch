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

interface MatrixViewProps {
  data: ScheduleSlot[];
  staffData: Array<{
    id: string;
    name: string;
    district: string;
    languages: string[];
  }>;
  onAssign: (scheduleId: string, staffId: string) => void;
  onUnassign: (scheduleId: string) => void;
}

export default function MatrixView({ data, staffData, onAssign, onUnassign }: MatrixViewProps) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              时间
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              影片
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              分配状态
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, index) => {
            const slotId = item.id ?? item.date;
            const assignedStaff = staffData.find(s => s.id === item.staff);
            return (
              <tr 
                key={slotId} 
                className={cn(
                  index % 2 === 0 ? "bg-white" : "bg-gray-50",
                  item.status === "conflict" && "bg-red-50"
                )}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.date} {item.time ?? ""}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.film}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {assignedStaff ? (
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#D4AF37]/10 text-[#D4AF37]">
                      {assignedStaff.name}
                    </div>
                  ) : (
                    <span className="text-gray-400">未分配</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    {!item.staff ? (
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                        onChange={(e) => onAssign(slotId, e.target.value)}
                      >
                        <option value="">选择字幕员</option>
                        {staffData.map(staff => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name} ({staff.languages.join(", ")})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => onUnassign(slotId)}
                        className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
                      >
                        取消分配
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
