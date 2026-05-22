import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import CalendarView from "@/components/schedule/CalendarView";
import MatrixView from "@/components/schedule/MatrixView";
import { useScheduleTable } from "@/contexts/ScheduleTableContext";
import { useSubtitler } from "@/contexts/SubtitlerContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import {
  buildScheduleTableFromParsedData,
  buildScheduleViewData,
  buildStaffViewData,
} from "@/lib/buildScheduleViewData";
export default function SchedulePage() {
  const navigate = useNavigate();
  const { scheduleData } = useScheduleTable();
  const { subtitlerData } = useSubtitler();
  const { scheduleTable, setScheduleTable, updateAssignment, getAssignment } = useSchedule();

  const [viewMode, setViewMode] = useState<"calendar" | "matrix">("calendar");

  useEffect(() => {
    if (scheduleData && !scheduleTable) {
      setScheduleTable(buildScheduleTableFromParsedData(scheduleData));
    }
  }, [scheduleData, scheduleTable, setScheduleTable]);

  const staffData = useMemo(
    () => (subtitlerData ? buildStaffViewData(subtitlerData) : []),
    [subtitlerData]
  );

  const scheduleViewData = useMemo(
    () => (scheduleTable ? buildScheduleViewData(scheduleTable) : []),
    [scheduleTable]
  );

  const groupedScheduleData = useMemo(() => {
    return scheduleViewData.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = [];
      }
      acc[item.date].push(item);
      return acc;
    }, {} as Record<string, typeof scheduleViewData>);
  }, [scheduleViewData]);

  const handleAssignStaff = useCallback((scheduleId: string, staffId: string) => {
    const staff = staffData.find(s => s.id === staffId);
    if (!staff) return;

    const current = getAssignment(scheduleId);
    updateAssignment(scheduleId, {
      ...current,
      subtitler1: staff.name,
      subtitler1Id: staffId,
    });
  }, [staffData, getAssignment, updateAssignment]);

  const handleUnassignStaff = useCallback((scheduleId: string) => {
    const current = getAssignment(scheduleId);
    updateAssignment(scheduleId, {
      ...current,
      subtitler1: null,
      subtitler1Id: null,
    });
  }, [getAssignment, updateAssignment]);

  const toggleViewMode = () => {
    setViewMode(prev => (prev === "calendar" ? "matrix" : "calendar"));
  };

  if (!scheduleData) {
    return (
      <div className="flex h-screen bg-[#2B3A67] text-white">
        <Navigation />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md bg-white rounded-lg p-8 shadow-lg text-gray-800">
              <i className="fa-solid fa-calendar text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 mb-4">暂无电影排片数据，请先在仪表盘上传排片表</p>
              <button
                onClick={() => navigate("/")}
                className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-medium py-2 px-6 rounded transition-colors"
              >
                <i className="fa-solid fa-upload mr-2"></i>
                前往上传数据
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen bg-[#2B3A67] text-white">
        <Navigation />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              {!subtitlerData && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
                  <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                  尚未上传字幕员数据，拖拽分配功能不可用。请先在仪表盘上传字幕员表。
                </div>
              )}

              <div className="bg-white rounded-lg p-4 shadow-lg text-gray-800">
                <div className="flex justify-between items-center">
                  <div className="flex space-x-4">
                    <button
                      onClick={toggleViewMode}
                      className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-medium py-2 px-4 rounded transition-colors"
                    >
                      <i className="fa-solid fa-rotate mr-2"></i>
                      {viewMode === "calendar" ? "切换至矩阵视图" : "切换至日历视图"}
                    </button>
                  </div>
                  <div className="text-sm text-gray-500">
                    共 {scheduleViewData.length} 场 · 已分配{" "}
                    {scheduleViewData.filter(item => item.staff).length} 场
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-lg min-h-[600px]">
                {scheduleViewData.length === 0 ? (
                  <div className="flex items-center justify-center h-[500px] text-gray-500">
                    排片表中没有可排班的场次
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={viewMode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {viewMode === "calendar" ? (
                        <CalendarView
                          data={groupedScheduleData}
                          staffData={staffData}
                          onAssign={handleAssignStaff}
                          onUnassign={handleUnassignStaff}
                        />
                      ) : (
                        <MatrixView
                          data={scheduleViewData}
                          staffData={staffData}
                          onAssign={handleAssignStaff}
                          onUnassign={handleUnassignStaff}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </DndProvider>
  );
}
