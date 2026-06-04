import {
  TIME_MAPPING,
  SUBTITLER_SCHEDULE_SLOT,
  getSlotKey,
} from '@/lib/scheduleConstants';
import { ParsedSchedule } from '@/lib/parseSubtitlerExcel';
import {
  ScheduleAssignment,
  ScheduleCell,
  ScheduleTable,
} from '@/contexts/ScheduleContext';

export function normalizeTime(time: string): string {
  return time.replace(/^0(\d)/, '$1');
}

function timeToMinutes(time: string): number {
  const match = normalizeTime(time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return -1;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function resolveSubtitlerScheduleSlot(slot: string): string {
  return SUBTITLER_SCHEDULE_SLOT[slot] ?? slot;
}

export function getSubtitlerTimeSlot(movieTimeSlot: string): string | null {
  const normalizedMovieTime = normalizeTime(movieTimeSlot);

  for (const [subtitlerSlot, movieSlots] of Object.entries(TIME_MAPPING)) {
    const normalizedMovieSlots = movieSlots.map(t => normalizeTime(t));
    if (normalizedMovieSlots.includes(normalizedMovieTime)) {
      return resolveSubtitlerScheduleSlot(subtitlerSlot);
    }
  }

  const movieMinutes = timeToMinutes(movieTimeSlot);
  if (movieMinutes < 0) return null;

  const subtitlerSlots = Object.keys(TIME_MAPPING)
    .map(slot => ({ slot, minutes: timeToMinutes(slot) }))
    .filter(s => s.minutes >= 0)
    .sort((a, b) => a.minutes - b.minutes);

  if (subtitlerSlots.length === 0) return null;

  const earliest = subtitlerSlots[0];
  const latest = subtitlerSlots[subtitlerSlots.length - 1];

  // 规则 3：早于当天最早档 → 最早档；晚于最晚档 → 最晚档
  if (movieMinutes < earliest.minutes) {
    return resolveSubtitlerScheduleSlot(earliest.slot);
  }
  if (movieMinutes > latest.minutes) {
    return resolveSubtitlerScheduleSlot(latest.slot);
  }

  // 规则 2：取不晚于影片时间的最近一个字幕员档
  let previousSlot: string | null = null;
  for (const { slot, minutes } of subtitlerSlots) {
    if (minutes <= movieMinutes) {
      previousSlot = slot;
    } else {
      break;
    }
  }

  return previousSlot
    ? resolveSubtitlerScheduleSlot(previousSlot)
    : resolveSubtitlerScheduleSlot(earliest.slot);
}

/** 问卷格子：填了时间 = 有空；空白 = 没空（与字幕员表绿色格子一致） */
export function isSubtitlerSlotMarkedAvailable(
  daySchedule: { [timeSlot: string]: string | null } | undefined,
  timeSlot: string
): boolean {
  if (!daySchedule) return false;
  const value = daySchedule[timeSlot];
  return value != null && value !== '';
}

/** 统计某天问卷中标记为有空的时间段数量 */
export function countMarkedAvailableSlots(
  daySchedule: { [timeSlot: string]: string | null } | undefined
): number {
  if (!daySchedule) return 0;
  return Object.values(daySchedule).filter(v => v != null && v !== '').length;
}

export function convertToSubtitlerDate(dateStr: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/\d{4}-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[2]}日`;
  }
  if (dateStr.includes('日')) {
    return dateStr;
  }
  return dateStr;
}

export function getCellAssignment(
  scheduleTable: ScheduleTable,
  cell: Pick<ScheduleCell, 'date' | 'cinema' | 'hall' | 'timeSlot' | 'assignment'>
): ScheduleAssignment {
  const key = getSlotKey(cell.date, cell.cinema, cell.hall, cell.timeSlot);
  return scheduleTable.assignments[key] ?? cell.assignment;
}

function resolveSubtitlerName(
  name: string | null,
  id: string | null,
  subtitlerData: ParsedSchedule | null | undefined
): string {
  if (name) return name;
  if (!id || !subtitlerData) return '';
  return subtitlerData.rows.find(r => r.id === id)?.name ?? '';
}

export function formatSubtitlerNamesForExport(
  assignment: ScheduleAssignment,
  subtitlerData: ParsedSchedule | null | undefined
): { subtitler1: string; subtitler2: string } {
  return {
    subtitler1: resolveSubtitlerName(
      assignment.subtitler1,
      assignment.subtitler1Id,
      subtitlerData
    ),
    subtitler2: resolveSubtitlerName(
      assignment.subtitler2,
      assignment.subtitler2Id,
      subtitlerData
    ),
  };
}

export function getAvailableSubtitlers(
  subtitlerData: ParsedSchedule | null | undefined,
  subtitlerTimeSlot: string,
  assignedSubtitlers: string[],
  date: string
): { id: string; name: string }[] {
  if (!subtitlerData) return [];

  const subtitlerDate = convertToSubtitlerDate(date);

  return subtitlerData.rows
    .filter(row => {
      if (assignedSubtitlers.includes(row.name)) return false;
      const daySchedule = row.schedule[subtitlerDate];
      if (!daySchedule) return false;
      return isSubtitlerSlotMarkedAvailable(daySchedule, subtitlerTimeSlot);
    })
    .map(row => ({ id: row.id, name: row.name }));
}
