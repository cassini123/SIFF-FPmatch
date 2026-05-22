import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ScheduleAssignment, ScheduleTable } from '@/contexts/ScheduleContext';
import {
  autoScheduleWithReport,
  AutoScheduleReport,
  formatSkipReason,
} from '@/lib/autoSchedule';
import { ParsedSchedule } from '@/lib/parseSubtitlerExcel';

export function useAutoSchedule(
  scheduleTable: ScheduleTable | null,
  subtitlerData: ParsedSchedule | null,
  updateAssignment: (
    key: string,
    assignment: ScheduleAssignment,
    options?: { source?: 'auto' | 'manual'; skipHistory?: boolean }
  ) => void
) {
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [lastReport, setLastReport] = useState<AutoScheduleReport | null>(null);

  const runAutoSchedule = useCallback(() => {
    if (!scheduleTable || !subtitlerData) {
      toast.error('缺少排班数据或字幕员数据');
      return;
    }

    setIsAutoScheduling(true);
    const loadingToast = toast.loading('正在执行自动排班...');

    setTimeout(() => {
      try {
        const manualAssignments = new Map<string, ScheduleAssignment>();
        Object.entries(scheduleTable.assignments).forEach(([key, assignment]) => {
          if (assignment.subtitler1 || assignment.subtitler2) {
            manualAssignments.set(key, assignment);
          }
        });

        const { assignments: result, report } = autoScheduleWithReport(
          scheduleTable,
          subtitlerData,
          manualAssignments
        );

        result.forEach((assignment, key) => {
          updateAssignment(key, assignment, { source: 'auto', skipHistory: true });
        });

        setLastReport(report);
        toast.dismiss(loadingToast);

        const incomplete = report.total - report.assigned;
        if (incomplete > 0) {
          const topReasons = summarizeFailures(report);
          toast.warning(
            `自动排班完成：${report.assigned} / ${report.total} 场已配齐。${incomplete} 场未配齐。${topReasons}`,
            { duration: 12000 }
          );
        } else {
          toast.success(`自动排班完成！已分配 ${report.assigned} / ${report.total} 场`);
        }
      } catch (error) {
        console.error('自动排班出错:', error);
        toast.dismiss(loadingToast);
        toast.error('自动排班执行出错');
      } finally {
        setIsAutoScheduling(false);
      }
    }, 100);
  }, [scheduleTable, subtitlerData, updateAssignment]);

  return { isAutoScheduling, lastReport, runAutoSchedule, clearReport: () => setLastReport(null) };
}

function summarizeFailures(report: AutoScheduleReport): string {
  if (report.failures.length === 0) return '';
  const counts = new Map<string, number>();
  report.failures.forEach(f => {
    const label = formatSkipReason(f.reason);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const parts = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, n]) => `${label} ${n} 场`);
  return `主要原因：${parts.join('；')}`;
}
