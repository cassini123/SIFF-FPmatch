import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScheduleTable } from '@/contexts/ScheduleTableContext';
import { formatDateDisplay, getWeekDay } from '@/lib/parseScheduleTable';
import { cn } from '@/lib/utils';

export default function ScheduleTable() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCinema, setSelectedCinema] = useState<string>('');
  
  const { scheduleData, uploadedFileName } = useScheduleTable();
  const navigate = useNavigate();

  useEffect(() => {
    // 优先使用本地数据
    if (scheduleData) {
      if (!selectedDate && scheduleData.dates.length > 0) {
        setSelectedDate(scheduleData.dates[0]);
      }
      if (!selectedCinema && scheduleData.cinemas.length > 0) {
        setSelectedCinema(scheduleData.cinemas[0]);
      }
      setLoading(false);
      return;
    }

    setLoading(false);
    setError('暂无本地数据，请先在仪表盘上传排片表');
  }, [scheduleData, selectedDate, selectedCinema]);

  // 获取当前日期下的影厅列表
  const hallsByCinema = useMemo(() => {
    if (!scheduleData || !selectedDate || !selectedCinema) return [];
    
    const halls = new Set<string>();
    scheduleData.rows.forEach(row => {
      if (row.date === selectedDate && row.cinema === selectedCinema) {
        halls.add(row.hall);
      }
    });
    return Array.from(halls).sort();
  }, [scheduleData, selectedDate, selectedCinema]);

  // 获取当前筛选条件下的排片数据
  const filteredRows = useMemo(() => {
    if (!scheduleData || !selectedDate || !selectedCinema) return [];
    
    return scheduleData.rows.filter(row => 
      row.date === selectedDate && row.cinema === selectedCinema
    );
  }, [scheduleData, selectedDate, selectedCinema]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37] mx-auto mb-4"></div>
          <p className="text-gray-400">加载排片数据中...</p>
        </div>
      </div>
    );
  }

  if (error || !scheduleData) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="bg-white shadow-sm px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">电影排片表</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <i className="fa-solid fa-film text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 mb-4">{error || '暂无排片数据'}</p>
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

  const { dates, timeSlots } = scheduleData;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">电影排片表</h1>
            {uploadedFileName && (
              <span className="text-sm text-green-600">
                <i className="fa-solid fa-check-circle mr-1"></i>
                {uploadedFileName}
              </span>
            )}
          </div>
        </div>

        {/* 日期选择 */}
        <div className="flex gap-2 flex-wrap">
          {dates.map(date => {
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
      </div>

      {/* 主体内容 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 左侧：影院列表 */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-700">影院列表</h3>
          </div>
          <div className="py-2">
            {scheduleData.cinemas.map(cinema => (
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
          </div>
        </div>

        {/* 右侧：影厅和排片 */}
        <div className="flex-1 overflow-auto p-4">
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

          {/* 排片表格 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-700 min-w-[100px]">
                      影厅
                    </th>
                    {timeSlots.map(slot => (
                      <th
                        key={slot}
                        className="border border-gray-300 px-3 py-3 text-center font-bold text-gray-700 min-w-[140px]"
                      >
                        {slot}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <tr
                      key={`${row.date}-${row.cinema}-${row.hall}-${idx}`}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="border border-gray-300 px-4 py-3 font-medium text-gray-800 bg-gray-50">
                        {row.hall}
                      </td>
                      {timeSlots.map(slot => {
                        const show = row.shows[slot];
                        return (
                          <td
                            key={slot}
                            className={cn(
                              "border border-gray-300 px-2 py-2 text-center align-top",
                              show ? "bg-green-50" : ""
                            )}
                          >
                            {show ? (
                              <div className="text-sm">
                                <div className="font-medium text-gray-800 truncate" title={show.name}>
                                  {show.name}
                                </div>
                                <div className="text-xs text-gray-500">{show.duration}</div>
                                <div className="text-xs text-gray-400">{show.country}</div>
                                <div className="text-xs text-orange-600 font-medium">
                                  {show.price}
                                </div>
                                {show.hasMeetup && (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">
                                    观众见面会
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="mt-4 text-sm text-gray-500 flex items-center gap-4">
            <span>共 {scheduleData.cinemas.length} 家影院</span>
            <span>共 {scheduleData.halls.length} 个影厅</span>
            <span>当前日期 {filteredRows.length} 场排片</span>
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
