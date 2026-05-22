import { ScheduleTable, ScheduleAssignment } from '@/contexts/ScheduleContext';
import { ParsedScheduleTable } from '@/contexts/ScheduleTableContext';
import { ParsedSchedule, SubtitlerRow } from '@/lib/parseSubtitlerExcel';
import { getSlotKey } from '@/lib/scheduleConstants';

export interface ScheduleViewItem {
  id: string;
  date: string;
  time: string;
  film: string;
  staff: string;
  status: 'available' | 'assigned' | 'conflict';
}

export interface StaffViewItem {
  id: string;
  name: string;
  district: string;
  languages: string[];
}

export function buildScheduleTableFromParsedData(
  scheduleData: ParsedScheduleTable
): ScheduleTable {
  const cells: ScheduleTable['cells'] = [];
  const assignments: ScheduleTable['assignments'] = {};

  scheduleData.rows.forEach(row => {
    const { date, cinema, hall, shows } = row;
    Object.entries(shows).forEach(([timeSlot, show]) => {
      if (!show) return;
      const key = getSlotKey(date, cinema, hall, timeSlot);
      cells.push({
        date,
        cinema,
        hall,
        timeSlot,
        movieName: show.name || '',
        assignment: {
          subtitler1: null,
          subtitler2: null,
          subtitler1Id: null,
          subtitler2Id: null,
        },
        isComplete: false,
      });
      assignments[key] = {
        subtitler1: null,
        subtitler2: null,
        subtitler1Id: null,
        subtitler2Id: null,
      };
    });
  });

  return { cells, assignments };
}

function getPrimaryDistrict(row: SubtitlerRow): string {
  const entry = Object.entries(row.districts).find(([, value]) => value);
  return entry ? `${entry[0]}区` : '未指定';
}

export function buildStaffViewData(subtitlerData: ParsedSchedule): StaffViewItem[] {
  return subtitlerData.rows.map(row => ({
    id: row.id,
    name: row.name,
    district: getPrimaryDistrict(row),
    languages: row.partner ? [`搭档: ${row.partner}`] : [],
  }));
}

export function buildScheduleViewData(
  scheduleTable: ScheduleTable
): ScheduleViewItem[] {
  const staffTimeUsage = new Map<string, string[]>();

  const items = scheduleTable.cells
    .filter(cell => cell.movieName)
    .map(cell => {
      const key = getSlotKey(cell.date, cell.cinema, cell.hall, cell.timeSlot);
      const assignment: ScheduleAssignment =
        scheduleTable.assignments[key] || cell.assignment;
      const staffId = assignment.subtitler1Id || '';

      if (staffId) {
        const timeKey = `${staffId}|${cell.date}|${cell.timeSlot}`;
        const slots = staffTimeUsage.get(timeKey) || [];
        slots.push(key);
        staffTimeUsage.set(timeKey, slots);
      }

      return {
        id: key,
        date: cell.date,
        time: cell.timeSlot,
        film: `${cell.movieName} · ${cell.cinema} ${cell.hall}`,
        staff: staffId,
        status: 'available' as const,
      };
    });

  const conflictIds = new Set<string>();
  staffTimeUsage.forEach(keys => {
    if (keys.length > 1) {
      keys.forEach(key => conflictIds.add(key));
    }
  });

  return items.map(item => ({
    ...item,
    status: conflictIds.has(item.id)
      ? 'conflict'
      : item.staff
        ? 'assigned'
        : 'available',
  }));
}
