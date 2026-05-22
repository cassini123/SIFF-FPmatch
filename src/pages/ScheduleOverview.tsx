import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useScheduleTable } from '@/contexts/ScheduleTableContext';
import { useSubtitler } from '@/contexts/SubtitlerContext';
import { useSchedule } from '@/contexts/ScheduleContext';
import { ScheduleCell, ScheduleAssignment } from '@/contexts/ScheduleContext';
import { buildScheduleViewData } from '@/lib/buildScheduleViewData';
import { useScheduleTableSync } from '@/hooks/useScheduleTableSync';
import { useAutoSchedule } from '@/hooks/useAutoSchedule';
import AutoScheduleReportPanel from '@/components/schedule/AutoScheduleReportPanel';
import StaffAssignmentPanel from '@/components/schedule/StaffAssignmentPanel';
import SubtitlerSelect from '@/components/schedule/SubtitlerSelect';
import { TIME_MAPPING, getCinemaDistrict } from '@/lib/scheduleConstants';
import { formatDateDisplay, getWeekDay } from '@/lib/parseScheduleTable';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// 标准化时间格式（移除前导零）用于匹配
function normalizeTime(time: string): string {
  // 将 "08:30" 转换为 "8:30" 用于匹配
  return time.replace(/^0(\d)/, '$1');
}

// 根据影片时间获取对应的字幕员时间段
function getSubtitlerTimeSlot(movieTimeSlot: string): string | null {
  const normalizedMovieTime = normalizeTime(movieTimeSlot);
  for (const [subtitlerSlot, movieSlots] of Object.entries(TIME_MAPPING)) {
    // 标准化影片时间进行比较
    const normalizedMovieSlots = movieSlots.map(t => normalizeTime(t));
    if (normalizedMovieSlots.includes(normalizedMovieTime)) {
      return subtitlerSlot;
    }
  }
  return null;
}

// 将电影排片日期格式转换为字幕员表日期格式
// 输入: "2024-06-18" 输出: "18日"
function convertToSubtitlerDate(dateStr: string): string {
  if (!dateStr) return '';
  // 从 "2024-06-18" 提取 "18" 并拼接 "日"
  const match = dateStr.match(/\d{4}-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[2]}日`;
  }
  // 如果已经是 "18日" 格式直接返回
  if (dateStr.includes('日')) {
    return dateStr;
  }
  return dateStr;
}

export default function ScheduleOverview() {
  const navigate = useNavigate();
  const { scheduleData } = useScheduleTable();
  const { subtitlerData } = useSubtitler();
  const { 
    scheduleTable, 
    mode, 
    setMode, 
    updateAssignment,
    getAssignment,
    clearAllAssignments 
  } = useSchedule();

  useScheduleTableSync();

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCinema, setSelectedCinema] = useState<string>('');
  const [sidebarTab, setSidebarTab] = useState<'cinema' | 'subtitler'>('cinema');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const { isAutoScheduling, lastReport, runAutoSchedule, clearReport } = useAutoSchedule(
    scheduleTable,
    subtitlerData,
    updateAssignment
  );

  const scheduleViewData = useMemo(
    () => (scheduleTable ? buildScheduleViewData(scheduleTable) : []),
    [scheduleTable]
  );

  const staffList = useMemo(() => {
    if (!subtitlerData) return [];
    return subtitlerData.rows.map(row => ({
      id: row.id,
      name: row.name,
      district: Object.entries(row.districts).find(([, v]) => v)?.[0] ?? '未指定',
      languages: row.partner ? [`搭档: ${row.partner}`] : [],
    }));
  }, [subtitlerData]);

  const selectedStaff = staffList.find(s => s.id === selectedStaffId) ?? null;
  const selectedStaffAssignments = useMemo(() => {
    if (!selectedStaffId) return [];
    return scheduleViewData.filter(
      s => s.subtitler1Id === selectedStaffId || s.subtitler2Id === selectedStaffId
    );
  }, [scheduleViewData, selectedStaffId]);

  // 设置默认选中
  useEffect(() => {
    if (scheduleData) {
      if (!selectedDate && scheduleData.dates.length > 0) {
        setSelectedDate(scheduleData.dates[0]);
      }
      if (!selectedCinema && scheduleData.cinemas.length > 0) {
        setSelectedCinema(scheduleData.cinemas[0]);
      }
    }
  }, [scheduleData, selectedDate, selectedCinema]);

  // 获取某时段可用的字幕员列表
  const getAvailableSubtitlers = useCallback((
    subtitlerTimeSlot: string,
    assignedSubtitlers: string[],
    date: string // 传入日期参数，不依赖外部状态
  ): { id: string; name: string }[] => {
    if (!subtitlerData) return [];

    // 转换日期格式：2024-06-18 -> 18日
    const subtitlerDate = convertToSubtitlerDate(date);

    return subtitlerData.rows
      .filter(row => {
        // 检查该字幕员此时段是否有空
        // schedule[date][timeSlot] === null 表示空闲（绿色格子）
        // 有值表示已被占用
        const daySchedule = row.schedule[subtitlerDate];
        if (!daySchedule) return false;
        
        // null 表示空闲，应该返回 true
        const isAvailable = daySchedule[subtitlerTimeSlot] === null;
        if (!isAvailable) return false;
        
        // 排除已分配的字幕员
        if (assignedSubtitlers.includes(row.name)) {
          return false;
        }
        return true;
      })
      .map(row => ({
        id: row.id,
        name: row.name
      }));
  }, [subtitlerData]);

  // 获取当前筛选的cells（按影厅分组）
  const cellsByHall = useMemo(() => {
    if (!scheduleTable) return {};
    
    const filtered = scheduleTable.cells.filter(cell =>
      cell.date === selectedDate && 
      cell.cinema === selectedCinema &&
      cell.movieName
    );
    
    const grouped: { [hall: string]: ScheduleCell[] } = {};
    filtered.forEach(cell => {
      if (!grouped[cell.hall]) {
        grouped[cell.hall] = [];
      }
      grouped[cell.hall].push(cell);
    });
    
    // 对每个影厅内的时间排序
    Object.keys(grouped).forEach(hall => {
      grouped[hall].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    });
    
    return grouped;
  }, [scheduleTable, selectedDate, selectedCinema]);

  // 获取当前筛选条件下的所有cells
  const filteredCells = useMemo(() => {
    if (!scheduleTable) return [];
    return scheduleTable.cells.filter(cell =>
      cell.date === selectedDate && 
      cell.cinema === selectedCinema &&
      cell.movieName
    ).sort((a, b) => {
      return a.timeSlot.localeCompare(b.timeSlot);
    });
  }, [scheduleTable, selectedDate, selectedCinema]);

  // 获取当前日期下的影厅列表
  const hallsByCinema = useMemo(() => {
    if (!scheduleData || !selectedDate || !selectedCinema) return [];
    
    const halls = new Set<string>();
    scheduleData.rows.forEach(row => {
      if (row.date === selectedDate && row.cinema === selectedCinema) {
        Object.values(row.shows).forEach(show => {
          if (show) halls.add(row.hall);
        });
      }
    });
    return Array.from(halls).sort();
  }, [scheduleData, selectedDate, selectedCinema]);

  // 处理字幕员分配变更
  const handleAssignmentChange = useCallback((
    cellKey: string,
    field: 'subtitler1' | 'subtitler2',
    value: string | null
  ) => {
    const current = getAssignment(cellKey);
    const assignment: ScheduleAssignment = {
      ...current,
      [field]: value,
      [`${field}Id`]: value ? subtitlerData?.rows.find(r => r.name === value)?.id || null : null
    };
    updateAssignment(cellKey, assignment);
  }, [getAssignment, updateAssignment, subtitlerData]);

  // 清除所有分配
  const handleClearAll = useCallback(() => {
    if (window.confirm('确定要清除所有排班分配吗？')) {
      clearAllAssignments();
      clearReport();
      toast.success('已清除所有分配');
    }
  }, [clearAllAssignments]);

  // 导出排班结果为Excel
  const handleExportExcel = useCallback(() => {
    if (!scheduleTable || !scheduleData) {
      toast.error('暂无排班数据');
      return;
    }

    // 收集所有日期
    const allDates = [...new Set(scheduleTable.cells.map(c => c.date))].sort();
    
    // 按日期分组，每个日期一个工作表
    const wb = XLSX.utils.book_new();
    
    allDates.forEach(date => {
      const dateCells = scheduleTable.cells.filter(c => c.date === date);
      const weekDay = getWeekDay(date);
      
      // 按影院分组并排序：已识别区域在前，未识别区域在后
      const knownCinemas: typeof dateCells = [];
      const unknownCinemas: typeof dateCells = [];
      
      dateCells.forEach(cell => {
        if (getCinemaDistrict(cell.cinema)) {
          knownCinemas.push(cell);
        } else {
          unknownCinemas.push(cell);
        }
      });
      
      // 按影院名称排序
      const sortByCinema = (a: typeof dateCells[0], b: typeof dateCells[0]) => 
        a.cinema.localeCompare(b.cinema);
      knownCinemas.sort(sortByCinema);
      unknownCinemas.sort(sortByCinema);
      
      const sortedCells = [...knownCinemas, ...unknownCinemas];
      
      // 构建工作表数据
      const sheetData: any[] = [];
      
      // 添加标题行
      sheetData.push(['影院', '影厅', '日期', '星期', '时间', '电影', '字幕员1', '字幕员2']);
      
      // 按影厅分组，按时间排序
      const cinemaHallMap = new Map<string, typeof dateCells>();
      sortedCells.forEach(cell => {
        const key = `${cell.cinema}|${cell.hall}`;
        if (!cinemaHallMap.has(key)) {
          cinemaHallMap.set(key, []);
        }
        cinemaHallMap.get(key)!.push(cell);
      });
      
      cinemaHallMap.forEach((cells) => {
        cells.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
        
        cells.forEach(cell => {
          const key = `${cell.date}|${cell.cinema}|${cell.hall}|${cell.timeSlot}`;
          const assignment = scheduleTable.assignments[key];
          
          sheetData.push([
            cell.cinema,
            cell.hall,
            date,
            weekDay,
            cell.timeSlot,
            cell.movieName,
            assignment?.subtitler1 || '',
            assignment?.subtitler2 || ''
          ]);
        });
      });
      
      // 创建工作表
      const ws = XLSX.utils.json_to_sheet(sheetData);
      
      // 设置列宽
      ws['!cols'] = [
        { wch: 15 },  // 影院
        { wch: 8 },   // 影厅
        { wch: 12 },  // 日期
        { wch: 6 },   // 星期
        { wch: 8 },   // 时间
        { wch: 20 },  // 电影
        { wch: 10 },  // 字幕员1
        { wch: 10 }   // 字幕员2
      ];
      
      // 标记未识别区域的行（灰色）
      let currentRow = 2; // 从第2行开始（第1行是标题）
      
      // 未识别区域行标灰
      if (unknownCinemas.length > 0) {
        cinemaHallMap.forEach((cells) => {
          const firstCell = cells[0];
          const isUnknown = !getCinemaDistrict(firstCell.cinema);
          if (isUnknown) {
            // 该影院的起始行和结束行
            const startRow = currentRow;
            const endRow = currentRow + cells.length - 1;
            // 设置整行背景色为灰色 (Gray Fill)
            for (let r = startRow; r <= endRow; r++) {
              for (let c = 0; c < 8; c++) {
                const cellRef = XLSX.utils.encode_cell({ r: r - 1, c });
                if (!ws[cellRef]) ws[cellRef] = {};
                ws[cellRef].s = {
                  fill: { fgColor: { rgb: '808080' } },
                  font: { color: { rgb: 'FFFFFF' } }
                };
              }
            }
          }
          currentRow += cells.length;
        });
      }
      
      // 添加工作表到工作簿
      const sheetName = date.replace(/-/g, ''); // 如 "20240618"
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    
    // 生成文件名
    const fileName = `排班总表_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
    
    // 触发下载
    XLSX.writeFile(wb, fileName);
    toast.success(`已导出 ${fileName}`);
  }, [scheduleTable, scheduleData]);

  // 统计
  const totalCount = filteredCells.length;
  const assignedCount = filteredCells.filter(cell => {
    const key = `${cell.date}|${cell.cinema}|${cell.hall}|${cell.timeSlot}`;
    const assignment = scheduleTable?.assignments[key];
    return assignment?.subtitler1 && assignment?.subtitler2;
  }).length;

  if (!scheduleData) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <i className="fa-solid fa-calendar text-6xl text-gray-300 mb-4"></i>
          <p className="text-gray-500 mb-4">暂无电影排片数据，请先上传排片表</p>
          <button
            onClick={() => navigate('/')}
            className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-upload mr-2"></i>
            前往上传数据
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">排班总表</h1>
            <div className="flex items-center gap-4 mt-1 text-sm">
              <span className="text-gray-500">
                {selectedCinema} - {formatDateDisplay(selectedDate, getWeekDay(selectedDate))}
              </span>
              <span className="text-blue-600 font-medium">
                已分配 {assignedCount} / {totalCount} 场
              </span>
              {assignedCount < totalCount && assignedCount > 0 && (
                <span className="text-orange-500">
                  <i className="fa-solid fa-exclamation-circle mr-1"></i>
                  未完成 {totalCount - assignedCount} 场
                </span>
              )}
            </div>
          </div>

          {/* 右上角：模式切换和操作 */}
          <div className="flex items-center gap-4">
            {/* 模式切换 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setMode('manual')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  mode === 'manual' 
                    ? 'bg-white text-[#2B3A67] shadow' 
                    : 'text-gray-600 hover:text-gray-800'
                )}
              >
                <i className="fa-solid fa-hand-pointer mr-1"></i>
                手动排班
              </button>
              <button
                onClick={() => setMode('auto')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  mode === 'auto' 
                    ? 'bg-white text-[#2B3A67] shadow' 
                    : 'text-gray-600 hover:text-gray-800'
                )}
              >
                <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                自动排班
              </button>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              {mode === 'auto' && (
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 text-sm"
                >
                  <i className="fa-solid fa-trash-can mr-1"></i>
                  清除
                </button>
              )}
              <button
                onClick={handleExportExcel}
                disabled={!scheduleTable || scheduleTable.cells.length === 0}
                className={cn(
                  "px-4 py-2 rounded text-white text-sm",
                  !scheduleTable || scheduleTable.cells.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                <i className="fa-solid fa-file-export mr-1"></i>
                导出Excel
              </button>
              {mode === 'auto' && (
                <button
                  onClick={runAutoSchedule}
                  disabled={isAutoScheduling}
                  className={cn(
                    "px-4 py-2 rounded text-white text-sm",
                    isAutoScheduling 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700'
                  )}
                >
                  <i className={cn("fa-solid mr-1", isAutoScheduling ? 'fa-spinner fa-spin' : 'fa-play')}></i>
                  {isAutoScheduling ? '排班中...' : '执行自动排班'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 日期选择 */}
        <div className="flex gap-2 flex-wrap">
          {scheduleData.dates.map(date => {
            const weekDay = getWeekDay(date);
            const isSelected = selectedDate === date;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-colors text-sm",
                  isSelected
                    ? "bg-[#D4AF37] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {formatDateDisplay(date, weekDay)}
              </button>
            );
          })}
        </div>

        {lastReport && mode === 'auto' && (
          <div className="mt-4">
            <AutoScheduleReportPanel report={lastReport} onClose={clearReport} />
          </div>
        )}
      </div>

      {/* 主体内容 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 左侧：影院 / 字幕员 */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
          <div className="p-2 border-b border-gray-200 bg-gray-50 flex gap-1">
            <button
              type="button"
              onClick={() => setSidebarTab('cinema')}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded',
                sidebarTab === 'cinema' ? 'bg-[#D4AF37] text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              影院
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('subtitler')}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded',
                sidebarTab === 'subtitler' ? 'bg-[#D4AF37] text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              字幕员
            </button>
          </div>
          <div className="py-2 flex-1 overflow-y-auto">
            {sidebarTab === 'subtitler' ? (
              staffList.map(staff => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() =>
                    setSelectedStaffId(prev => (prev === staff.id ? null : staff.id))
                  }
                  className={cn(
                    'w-full text-left px-4 py-2.5 transition-colors',
                    selectedStaffId === staff.id
                      ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-l-4 border-[#D4AF37]'
                      : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
                  )}
                >
                  <div className="font-medium truncate">{staff.name}</div>
                  <div className="text-xs text-gray-400 truncate">{staff.district}</div>
                </button>
              ))
            ) : (
            /* 先渲染有区域的影院，再渲染无区域的影院（灰色） */
            (() => {
              const knownCinemas = scheduleData.cinemas.filter(c => getCinemaDistrict(c) !== null);
              const unknownCinemas = scheduleData.cinemas.filter(c => getCinemaDistrict(c) === null);
              return (
                <>
                  {knownCinemas.map(cinema => (
                    <button
                      key={cinema}
                      onClick={() => setSelectedCinema(cinema)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 transition-colors",
                        selectedCinema === cinema
                          ? "bg-[#D4AF37]/10 text-[#D4AF37] border-l-4 border-[#D4AF37]"
                          : "text-gray-600 hover:bg-gray-50 border-l-4 border-transparent"
                      )}
                    >
                      <div className="font-medium truncate">{cinema}</div>
                    </button>
                  ))}
                  {unknownCinemas.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-xs text-gray-400 border-t mt-2">
                        未识别区域
                      </div>
                      {unknownCinemas.map(cinema => (
                        <button
                          key={cinema}
                          onClick={() => setSelectedCinema(cinema)}
                          className={cn(
                            "w-full text-left px-4 py-2.5 transition-colors opacity-50",
                            selectedCinema === cinema
                              ? "bg-gray-200 text-gray-700 border-l-4 border-gray-400"
                              : "text-gray-400 hover:bg-gray-50 border-l-4 border-transparent"
                          )}
                        >
                          <div className="font-medium truncate">{cinema}</div>
                        </button>
                      ))}
                    </>
                  )}
                </>
              );
            })()
            )}
          </div>
        </div>

        {/* 右侧：排班表格 */}
        <div className="flex-1 overflow-auto p-4">
          {selectedStaff && (
            <StaffAssignmentPanel
              staff={selectedStaff}
              assignments={selectedStaffAssignments}
            />
          )}
          {/* 影厅标签 */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {hallsByCinema.map(hall => (
              <span
                key={hall}
                className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
              >
                {hall}
              </span>
            ))}
          </div>

          {/* 排班表格 - 使用电影排片表的CSS样式 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-700 min-w-[100px]">
                      影厅
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-700 min-w-[80px]">
                      时间
                    </th>
                    <th className="border border-gray-300 px-3 py-3 text-center font-bold text-gray-700 min-w-[140px]">
                      电影
                    </th>
                    <th className="border border-gray-300 px-3 py-3 text-center font-bold text-blue-600 min-w-[100px]">
                      字幕员1
                    </th>
                    <th className="border border-gray-300 px-3 py-3 text-center font-bold text-green-600 min-w-[100px]">
                      字幕员2
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hallsByCinema.map((hall, hallIdx) => {
                    const hallCells = cellsByHall[hall] || [];
                    return hallCells.map((cell, cellIdx) => {
                      const key = `${cell.date}|${cell.cinema}|${cell.hall}|${cell.timeSlot}`;
                      const assignment = scheduleTable?.assignments[key] || {
                        subtitler1: null,
                        subtitler2: null,
                        subtitler1Id: null,
                        subtitler2Id: null
                      };
                      const isComplete = assignment.subtitler1 && assignment.subtitler2;
                      
                      // 获取此时段对应的字幕员时间段
                      const subtitlerTimeSlot = getSubtitlerTimeSlot(cell.timeSlot);
                      
                      // 获取字幕员1可选列表（排除已选中的字幕员2）
                      const availableForSubtitler1 = subtitlerTimeSlot 
                        ? getAvailableSubtitlers(subtitlerTimeSlot, assignment.subtitler2 ? [assignment.subtitler2] : [], cell.date)
                        : [];
                      
                      // 获取字幕员2可选列表（排除已选中的字幕员1）
                      const availableForSubtitler2 = subtitlerTimeSlot 
                        ? getAvailableSubtitlers(subtitlerTimeSlot, assignment.subtitler1 ? [assignment.subtitler1] : [], cell.date)
                        : [];
                      
                      const isFirstCellOfHall = cellIdx === 0;
                      const rowSpan = hallCells.length;
                      
                      return (
                        <tr 
                          key={key}
                          className={cn(
                            hallIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                            isComplete && "bg-green-50"
                          )}
                        >
                          {/* 影厅列 - 只在第一行显示并使用rowspan */}
                          {isFirstCellOfHall && (
                            <td 
                              className="border border-gray-300 px-4 py-3 font-medium text-gray-800 bg-gray-50 align-top"
                              rowSpan={rowSpan}
                            >
                              {hall}
                            </td>
                          )}
                          
                          <td className="border border-gray-300 px-4 py-3 text-gray-600">
                            {cell.timeSlot}
                          </td>
                          
                          <td className="border border-gray-300 px-3 py-3 text-left align-top">
                            <div className="font-medium text-gray-800 truncate max-w-[140px]" title={cell.movieName}>
                              {cell.movieName}
                            </div>
                          </td>
                          
                          <td className="border border-gray-300 px-2 py-2 text-center">
                            {mode === 'manual' ? (
                              <SubtitlerSelect
                                value={assignment.subtitler1}
                                onChange={(value) => handleAssignmentChange(key, 'subtitler1', value)}
                                availableSubtitlers={availableForSubtitler1}
                                disabled={mode === 'auto'}
                                onInspect={(s) => setSelectedStaffId(s.id)}
                              />
                            ) : (
                              <span className={cn(
                                "px-2 py-1 text-xs rounded min-w-[80px] inline-block text-center",
                                assignment.subtitler1 
                                  ? "bg-blue-50 text-blue-700 font-medium" 
                                  : "bg-red-50 text-red-500"
                              )}>
                                {assignment.subtitler1 || '-'}
                              </span>
                            )}
                          </td>
                          
                          <td className="border border-gray-300 px-2 py-2 text-center">
                            {mode === 'manual' ? (
                              <SubtitlerSelect
                                value={assignment.subtitler2}
                                onChange={(value) => handleAssignmentChange(key, 'subtitler2', value)}
                                availableSubtitlers={availableForSubtitler2}
                                disabled={mode === 'auto'}
                                onInspect={(s) => setSelectedStaffId(s.id)}
                              />
                            ) : (
                              <span className={cn(
                                "px-2 py-1 text-xs rounded min-w-[80px] inline-block text-center",
                                assignment.subtitler2 
                                  ? "bg-green-50 text-green-700 font-medium" 
                                  : "bg-red-50 text-red-500"
                              )}>
                                {assignment.subtitler2 || '-'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}
                  
                  {/* 如果没有数据 */}
                  {filteredCells.length === 0 && (
                    <tr>
                      <td colSpan={5} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                        该影院当日暂无排片
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 说明 */}
          {mode === 'manual' && (
            <div className="mt-3 text-xs text-gray-400">
              <i className="fa-solid fa-info-circle mr-1"></i>
              字幕员下拉列表只显示此时段有空且未被其他场次占用的字幕员
            </div>
          )}

          {/* 统计信息 */}
          <div className="mt-4 text-sm text-gray-500 flex items-center gap-4">
            <span>共 {scheduleData.cinemas.length} 家影院</span>
            <span>共 {hallsByCinema.length} 个影厅</span>
            <span>当前日期 {totalCount} 场排片</span>
            {assignedCount < totalCount && assignedCount > 0 && (
              <span className="text-orange-500">未完成 {totalCount - assignedCount} 场</span>
            )}
            <button
              onClick={() => navigate('/')}
              className="ml-auto text-[#D4AF37] hover:text-[#D4AF37]/80 flex items-center"
            >
              <i className="fa-solid fa-upload mr-1"></i>
              上传/更新数据
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
