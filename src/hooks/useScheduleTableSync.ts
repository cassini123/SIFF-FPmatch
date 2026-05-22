import { useEffect } from 'react';
import { useScheduleTable } from '@/contexts/ScheduleTableContext';
import { useSchedule } from '@/contexts/ScheduleContext';

/** 排片表上传/更新时，将排班总表 cells 与解析结果同步（保留已有分配） */
export function useScheduleTableSync() {
  const { scheduleData } = useScheduleTable();
  const { syncFromParsedData } = useSchedule();

  useEffect(() => {
    if (scheduleData) {
      syncFromParsedData(scheduleData);
    }
  }, [scheduleData, syncFromParsedData]);
}
