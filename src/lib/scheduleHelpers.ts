import { TIME_MAPPING, getSlotKey } from '@/lib/scheduleConstants';
import { ParsedSchedule } from '@/lib/parseSubtitlerExcel';
import {
  ScheduleAssignment,
  ScheduleCell,
  ScheduleTable,
} from '@/contexts/ScheduleContext';

export function normalizeTime(time: string): string {
  return time.replace(/^0(\d)/, '$1');
}

export function getSubtitlerTimeSlot(movieTimeSlot: string): string | null {
  const normalizedMovieTime = normalizeTime(movieTimeSlot);
  for (const [subtitlerSlot, movieSlots] of Object.entries(TIME_MAPPING)) {
    const normalizedMovieSlots = movieSlots.map(t => normalizeTime(t));
    if (normalizedMovieSlots.includes(normalizedMovieTime)) {
      return subtitlerSlot;
    }
  }
  return null;
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
      return daySchedule[subtitlerTimeSlot] === null;
    })
    .map(row => ({ id: row.id, name: row.name }));
}
