import { useState, useMemo, useCallback } from "react";
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
import { ScheduleAssignment } from "@/contexts/ScheduleContext";
import { useScheduleTableSync } from "@/hooks/useScheduleTableSync";
import {
  buildScheduleViewData,
  buildStaffViewData,
  buildScheduleTableFromParsedData,
} from "@/lib/buildScheduleViewData";
import { getAvailableSubtitlers } from "@/lib/scheduleHelpers";
import { cn } from "@/lib/utils";
import { useAutoSchedule } from "@/hooks/useAutoSchedule";
import AutoScheduleReportPanel from "@/components/schedule/AutoScheduleReportPanel";

export default function SchedulePage() {
  const navigate = useNavigate();
  const { scheduleData } = useScheduleTable();
  const { subtitlerData } = useSubtitler();
  const {
    scheduleTable,
    mode,
    setMode,
    updateAssignment,
    getAssignment,
    undo,
    canUndo,
    clearAllAssignments,
  } = useSchedule();

  useScheduleTableSync();

  const effectiveScheduleTable = useMemo(() => {
    if (scheduleTable?.cells?.length) return scheduleTable;
    if (scheduleData) return buildScheduleTableFromParsedData(scheduleData);
    return null;
  }, [scheduleTable, scheduleData]);

  const { isAutoScheduling, lastReport, runAutoSchedule, clearReport } = useAutoSchedule(
    effectiveScheduleTable,
    subtitlerData,
    updateAssignment
  );

  const [viewMode, setViewMode] = useState<"calendar" | "matrix">("calendar");

  const staffData = useMemo(
    () => (subtitlerData ? buildStaffViewData(subtitlerData) : []),
    [subtitlerData]
  );

  const scheduleViewData = useMemo(
    () =>
      effectiveScheduleTable
        ? buildScheduleViewData(effectiveScheduleTable)
        : [],
    [effectiveScheduleTable]
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

  const getAvailableSubtitlersForSlot = useCallback((
    subtitlerTimeSlot: string,
    assignedSubtitlers: string[],
    date: string
  ) => {
    return getAvailableSubtitlers(subtitlerData, subtitlerTimeSlot, assignedSubtitlers, date);
  }, [subtitlerData]);

  const handleAssignmentChange = useCallback((
    cellKey: string,
    field: 'subtitler1' | 'subtitler2',
    value: string | null
  ) => {
    const current = getAssignment(cellKey);
    const assignment: ScheduleAssignment = {
      ...current,
      [field]: value,
      [`${field}Id`]: value
        ? subtitlerData?.rows.find(r => r.name === value)?.id || null
        : null,
    };
    updateAssignment(cellKey, assignment, { source: 'manual' });
  }, [getAssignment, updateAssignment, subtitlerData]);

  const handleAssignStaff = useCallback((scheduleId: string, staffId: string) => {
    const staff = staffData.find(s => s.id === staffId);
    if (!staff) return;

    const current = getAssignment(scheduleId);
    updateAssignment(scheduleId, {
      ...current,
      subtitler1: staff.name,
      subtitler1Id: staffId,
    }, { source: 'manual' });
  }, [staffData, getAssignment, updateAssignment]);

  const toggleViewMode = () => {
    setViewMode(prev => (prev === "calendar" ? "matrix" : "calendar"));
  };

  const assignedCount = scheduleViewData.filter(
    item => item.subtitler1 && item.subtitler2
  ).length;

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
                  尚未上传字幕员数据，分配功能不可用。请先在仪表盘上传字幕员表。
                </div>
              )}

              <div className="bg-white rounded-lg p-4 shadow-lg text-gray-800">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <button
                      onClick={toggleViewMode}
                      className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-medium py-2 px-4 rounded transition-colors"
                    >
                      <i className="fa-solid fa-rotate mr-2"></i>
                      {viewMode === "calendar" ? "切换至矩阵视图" : "切换至日历视图"}
                    </button>
                    <button
                      onClick={undo}
                      disabled={!canUndo || mode !== 'manual'}
                      className={cn(
                        "px-3 py-2 rounded text-sm font-medium border transition-colors",
                        canUndo && mode === 'manual'
                          ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                          : "border-gray-200 text-gray-400 cursor-not-allowed"
                      )}
                      title="撤回上一步分配修改"
                    >
                      <i className="fa-solid fa-rotate-left mr-1"></i>
                      撤回上一步
                    </button>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setMode('manual')}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                          mode === 'manual'
                            ? 'bg-white text-[#2B3A67] shadow'
                            : 'text-gray-600 hover:text-gray-800'
                        )}
                      >
                        手动排班
                      </button>
                      <button
                        onClick={() => setMode('auto')}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                          mode === 'auto'
                            ? 'bg-white text-[#2B3A67] shadow'
                            : 'text-gray-600 hover:text-gray-800'
                        )}
                      >
                        <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                        自动排班
                      </button>
                    </div>
                    {mode === 'auto' && (
                      <>
                        <button
                          onClick={runAutoSchedule}
                          disabled={isAutoScheduling || !subtitlerData}
                          className={cn(
                            "px-4 py-2 rounded text-white text-sm font-medium",
                            isAutoScheduling || !subtitlerData
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-700"
                          )}
                        >
                          <i className={cn("fa-solid mr-1", isAutoScheduling ? "fa-spinner fa-spin" : "fa-play")}></i>
                          {isAutoScheduling ? "排班中..." : "执行自动排班"}
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("确定清除所有排班分配吗？")) {
                              clearAllAssignments();
                              clearReport();
                            }
                          }}
                          className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
                        >
                          清除分配
                        </button>
                      </>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    共 {scheduleViewData.length} 场 · 已完成 {assignedCount} 场
                    <span className="text-gray-400 ml-2">（与排班总表同步保存）</span>
                  </div>
                </div>
              </div>

              {lastReport && mode === 'auto' && (
                <AutoScheduleReportPanel report={lastReport} onClose={clearReport} />
              )}

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
                          allSlots={scheduleViewData}
                          staffData={staffData}
                          mode={mode}
                          onAssign={handleAssignStaff}
                          onAssignmentChange={handleAssignmentChange}
                          getAvailableSubtitlers={getAvailableSubtitlersForSlot}
                        />
                      ) : (
                        <MatrixView
                          data={scheduleViewData}
                          allSlots={scheduleViewData}
                          staffData={staffData}
                          mode={mode}
                          onAssignmentChange={handleAssignmentChange}
                          getAvailableSubtitlers={getAvailableSubtitlersForSlot}
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
