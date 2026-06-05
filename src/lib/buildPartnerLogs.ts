import { ScheduleTable } from '@/contexts/ScheduleContext';
import { PartnerPairLog } from '@/lib/autoSchedule';
import { getSlotKey } from '@/lib/scheduleConstants';

function getPartnerPairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function buildPartnerLogsFromSchedule(
  scheduleTable: ScheduleTable | null
): PartnerPairLog[] {
  if (!scheduleTable) return [];

  const logs = new Map<string, PartnerPairLog>();

  scheduleTable.cells.forEach(cell => {
    if (!cell.movieName) return;

    const key = getSlotKey(cell.date, cell.cinema, cell.hall, cell.timeSlot);
    const assignment = scheduleTable.assignments[key];
    if (!assignment?.subtitler1 || !assignment.subtitler2) return;

    const pairKey = getPartnerPairKey(assignment.subtitler1, assignment.subtitler2);
    const [p1, p2] = [assignment.subtitler1, assignment.subtitler2].sort();
    const existing = logs.get(pairKey) ?? { person1: p1, person2: p2, entries: [] };

    existing.entries.push({
      date: cell.date,
      cinema: cell.cinema,
      hall: cell.hall,
      timeSlot: cell.timeSlot,
      movieCode: cell.movieCode,
      movieName: cell.movieName,
    });

    logs.set(pairKey, existing);
  });

  return Array.from(logs.values()).sort((a, b) =>
    a.person1.localeCompare(b.person1, 'zh-CN')
  );
}
