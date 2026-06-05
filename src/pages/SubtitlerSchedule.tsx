import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParsedSchedule, getDateDisplay } from '@/lib/parseSubtitlerExcel';
import { SUBTITLER_TIME_SLOTS } from '@/lib/scheduleConstants';
import { useSubtitler } from '@/contexts/SubtitlerContext';
import PartnerAssignmentLogPanel from '@/components/schedule/PartnerAssignmentLogPanel';
import { useSchedule } from '@/contexts/ScheduleContext';
import { buildPartnerLogsFromSchedule } from '@/lib/buildPartnerLogs';
import { getPartnerRelationshipWarnings } from '@/lib/autoSchedule';
import { cn } from '@/lib/utils';
import { findBestNameMatch } from '@/lib/searchHelpers';
import { buildBidirectionalPartnerMap } from '@/lib/partnerOverrides';
import { toast } from 'sonner';

export default function SubtitlerSchedule() {
  const [scheduleData, setScheduleData] = useState<ParsedSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'local' | 'default' | null>(null);
  const [showPartnerLog, setShowPartnerLog] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [highlightRowKey, setHighlightRowKey] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const {
    subtitlerData,
    uploadedFileName,
    getEffectivePartnerFor,
    isManualPartnerOverrideFor,
    setManualPartner,
    manualPartnerOverrides,
  } = useSubtitler();
  const { scheduleTable } = useSchedule();

  const partnerLogData = useMemo(() => {
    if (!subtitlerData) return { partnerLogs: [], partnerWarnings: [] as string[] };
    return {
      partnerLogs: buildPartnerLogsFromSchedule(
        scheduleTable,
        subtitlerData.rows,
        manualPartnerOverrides
      ),
      partnerWarnings: getPartnerRelationshipWarnings(subtitlerData.rows, manualPartnerOverrides),
    };
  }, [scheduleTable, subtitlerData, manualPartnerOverrides]);

  const bidirectionalPartnerOf = useMemo(() => {
    if (!subtitlerData) return new Map<string, string>();
    return buildBidirectionalPartnerMap(subtitlerData.rows, manualPartnerOverrides).partnerOf;
  }, [subtitlerData, manualPartnerOverrides]);

  const navigate = useNavigate();

  useEffect(() => {
    // 优先使用本地数据
    if (subtitlerData) {
      setScheduleData(subtitlerData);
      if (subtitlerData.dates.length > 0) {
        setSelectedDate(subtitlerData.dates[0]);
      }
      setDataSource('local');
      setLoading(false);
      return;
    }

    setLoading(false);
    setError('暂无本地数据，请先在仪表盘上传字幕员数据');
  }, [subtitlerData]);

  const rows = scheduleData?.rows ?? [];

  const setRowRef = useCallback((rowKey: string) => (el: HTMLTableRowElement | null) => {
    if (el) rowRefs.current.set(rowKey, el);
    else rowRefs.current.delete(rowKey);
  }, []);

  const locateSubtitler = useCallback(() => {
    const match = findBestNameMatch(nameSearch, rows);
    if (!match) {
      toast.error('未找到该字幕员');
      return;
    }
    const rowKey = match.id;
    setHighlightRowKey(rowKey);
    window.setTimeout(() => setHighlightRowKey(null), 3000);
    requestAnimationFrame(() => {
      rowRefs.current.get(rowKey)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [nameSearch, rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37] mx-auto mb-4"></div>
          <p className="text-gray-400">加载字幕员数据中...</p>
        </div>
      </div>
    );
  }

  if (error || !scheduleData) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="bg-white shadow-sm px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">字幕员时间表</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <i className="fa-solid fa-file-excel text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 mb-4">{error || '暂无字幕员数据'}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-upload mr-2"></i>
              前往上传数据
            </button>
          </div>
        </div>
      </div>
    );
  }

  const headers = scheduleData.headers ?? {
    dates: scheduleData.dates,
    timeSlots: scheduleData.dates.length ? (Object.keys(scheduleData.rows[0]?.schedule?.[scheduleData.dates[0]] ?? {}) as string[]) : [],
    districts: [],
  };
  const timeSlots = headers.timeSlots?.length ? headers.timeSlots : SUBTITLER_TIME_SLOTS;
  const districts = headers.districts ?? [];
  const showDistricts = districts.length > 0;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">字幕员时间表</h1>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    locateSubtitler();
                  }
                }}
                placeholder="搜索字幕员姓名"
                className="w-44 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <button
                type="button"
                onClick={locateSubtitler}
                className="rounded-lg bg-[#2B3A67] px-3 py-1.5 text-sm text-white hover:bg-[#2B3A67]/90 transition-colors"
              >
                <i className="fa-solid fa-location-crosshairs mr-1" />
                定位
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {dataSource === 'local' && uploadedFileName && (
                <span className="text-sm text-green-600">
                  <i className="fa-solid fa-check-circle mr-1"></i>
                  数据来源：{uploadedFileName}
                </span>
              )}
              {dataSource === 'default' && (
                <span className="text-sm text-blue-600">
                  <i className="fa-solid fa-database mr-1"></i>
                  默认数据
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPartnerLog(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#D4AF37] text-[#2B3A67] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-sm font-medium transition-colors"
            >
              <i className="fa-solid fa-user-group" />
              搭档去向
              {partnerLogData && partnerLogData.partnerLogs.length > 0 && (
                <span className="bg-[#D4AF37] text-white text-xs px-1.5 py-0.5 rounded-full">
                  {partnerLogData.partnerLogs.length}
                </span>
              )}
            </button>
            <div className="flex gap-2">
            {(headers.dates ?? scheduleData.dates).map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedDate === date
                    ? 'bg-[#D4AF37] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getDateDisplay(date)}
              </button>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* 表格区域 */}
      <div ref={tableScrollRef} className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                {/* 主表头：姓名、区域、搭档、时间段 */}
                <tr>
                  <th 
                    rowSpan={2} 
                    className="border border-gray-200 px-4 py-3 text-center font-bold text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[80px]"
                  >
                    姓名
                  </th>
                  {showDistricts && (
                  <th 
                    colSpan={districts.length} 
                    className="border border-gray-200 px-4 py-3 text-center font-bold text-gray-700 bg-blue-50"
                  >
                    区域
                  </th>
                  )}
                  <th 
                    rowSpan={2} 
                    className="border border-gray-200 px-4 py-3 text-center font-bold text-gray-700 min-w-[80px]"
                  >
                    搭档
                  </th>
                  <th 
                    colSpan={timeSlots.length} 
                    className="border border-gray-200 px-4 py-3 text-center font-bold text-gray-700 bg-green-50"
                  >
                    {selectedDate} 时间段
                  </th>
                </tr>
                
                {/* 二级表头：区域细分 */}
                <tr>
                  {showDistricts && districts.map((district) => (
                    <th 
                      key={district} 
                      className="border border-gray-200 px-3 py-2 text-center text-sm font-medium text-gray-600 bg-blue-50 min-w-[60px]"
                    >
                      {district.replace('区', '')}
                    </th>
                  ))}
                  {timeSlots.map((slot) => (
                    <th 
                      key={slot} 
                      className="border border-gray-200 px-2 py-2 text-center text-xs font-medium text-gray-600 bg-green-50 min-w-[50px]"
                    >
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              
              <tbody>
                {rows.map((row, idx) => {
                  const hasPartner = bidirectionalPartnerOf.has(row.name);
                  return (
                  <tr 
                    key={`${row.id}-${row.name}-${idx}`}
                    ref={setRowRef(row.id)}
                    className={cn(
                      hasPartner
                        ? 'bg-indigo-50/70'
                        : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                      highlightRowKey === row.id && 'ring-2 ring-[#D4AF37] ring-inset bg-[#D4AF37]/10'
                    )}
                  >
                    {/* 姓名 */}
                    <td className={cn(
                      'border border-gray-200 px-4 py-2 font-medium sticky left-0 z-10 min-w-[80px]',
                      hasPartner
                        ? 'bg-indigo-100 text-indigo-900'
                        : 'text-gray-800 bg-inherit'
                    )}>
                      {row.name}
                      {hasPartner && (
                        <i className="fa-solid fa-user-group ml-1.5 text-indigo-500 text-xs" title="已双向绑定搭档" />
                      )}
                    </td>
                    
                    {/* 区域 */}
                    {showDistricts && districts.map((district) => {
                      const value = row.districts[district];
                      const hasValue = value !== null && value !== undefined;
                      return (
                        <td 
                          key={district} 
                          className={`border border-gray-200 px-3 py-2 text-center ${
                            hasValue ? 'bg-green-100' : ''
                          }`}
                        >
                          {hasValue ? '1' : ''}
                        </td>
                      );
                    })}
                    
                    {/* 搭档（可手动修改，须双向绑定） */}
                    <td className={cn(
                      'border border-gray-200 px-2 py-1 text-center min-w-[120px]',
                      hasPartner && 'bg-indigo-50'
                    )}>
                      <select
                        value={getEffectivePartnerFor(row.name) ?? ''}
                        onChange={(e) => setManualPartner(row.name, e.target.value || null)}
                        className={cn(
                          'w-full rounded border px-2 py-1 text-sm text-center',
                          isManualPartnerOverrideFor(row.name)
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#2B3A67] font-medium'
                            : hasPartner
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-900 font-medium'
                              : 'border-gray-200 bg-white text-gray-600'
                        )}
                        title={
                          isManualPartnerOverrideFor(row.name)
                            ? '已手动修改（优先级最高，双向绑定）'
                            : hasPartner
                              ? '已双向绑定搭档'
                              : '选择搭档（将自动双向绑定）'
                        }
                      >
                        <option value="">无</option>
                        {rows
                          .filter(other => other.name !== row.name)
                          .map(other => (
                            <option key={other.id} value={other.name}>
                              {other.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    
                    {/* 时间段 - 根据选中的日期显示 */}
                    {timeSlots.map((slot) => {
                      const value = row.schedule[selectedDate]?.[slot];
                      const hasValue = value !== null && value !== undefined;
                      return (
                        <td 
                          key={slot} 
                          className={`border border-gray-200 px-2 py-2 text-center ${
                            hasValue ? 'bg-green-200 font-medium' : ''
                          }`}
                        >
                          {value || ''}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="mt-4 text-sm text-gray-500 flex items-center gap-4">
          <span>共 {rows.length} 名字幕员</span>
          <span>时间段 {timeSlots.length} 个</span>
          {showDistricts && <span>区域 {districts.length} 个</span>}
          <span className="text-xs text-gray-400">淡紫色行表示已双向绑定搭档 · 金色边框为手动修改</span>
          <button
            onClick={() => navigate('/')}
            className="ml-auto text-[#D4AF37] hover:text-[#D4AF37]/80 flex items-center"
          >
            <i className="fa-solid fa-upload mr-1"></i>
            上传/更新数据
          </button>
        </div>
      </div>

      {showPartnerLog && (
        <PartnerAssignmentLogPanel
          partnerLogs={partnerLogData?.partnerLogs ?? []}
          partnerWarnings={partnerLogData?.partnerWarnings ?? []}
          onClose={() => setShowPartnerLog(false)}
        />
      )}
    </div>
  );
}
