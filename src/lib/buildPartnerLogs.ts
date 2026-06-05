import { ScheduleTable } from '@/contexts/ScheduleContext';
import { PartnerPairLog } from '@/lib/autoSchedule';
import { SubtitlerRow } from '@/lib/parseSubtitlerExcel';
import { ManualPartnerOverrides, buildBidirectionalPartnerMap } from '@/lib/partnerOverrides';
import { getSlotKey } from '@/lib/scheduleConstants';

function getPartnerPairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/** 仅统计字幕员表中双向绑定的搭档，及其同场排班场次 */
export function buildPartnerLogsFromSchedule(
  scheduleTable: ScheduleTable | null,
  rows: SubtitlerRow[],
  manualPartnerOverrides: ManualPartnerOverrides = {}
): PartnerPairLog[] {
  const { partnerOf } = buildBidirectionalPartnerMap(rows, manualPartnerOverrides);
  if (partnerOf.size === 0) return [];

  const logs = new Map<string, PartnerPairLog>();
  const seenPairs = new Set<string>();

  partnerOf.forEach((partner, person) => {
    const pairKey = getPartnerPairKey(person, partner);
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);
    const [p1, p2] = [person, partner].sort();
    logs.set(pairKey, { person1: p1, person2: p2, entries: [] });
  });

  if (!scheduleTable) {
    return Array.from(logs.values()).sort((a, b) =>
      a.person1.localeCompare(b.person1, 'zh-CN')
    );
  }

  scheduleTable.cells.forEach(cell => {
    if (!cell.movieName) return;

    const key = getSlotKey(cell.date, cell.cinema, cell.hall, cell.timeSlot);
    const assignment = scheduleTable.assignments[key];
    if (!assignment?.subtitler1 || !assignment?.subtitler2) return;

    const { subtitler1, subtitler2 } = assignment;
    if (partnerOf.get(subtitler1) !== subtitler2) return;

    const pairKey = getPartnerPairKey(subtitler1, subtitler2);
    const log = logs.get(pairKey);
    if (!log) return;

    log.entries.push({
      date: cell.date,
      cinema: cell.cinema,
      hall: cell.hall,
      timeSlot: cell.timeSlot,
      movieCode: cell.movieCode,
      movieName: cell.movieName,
    });
  });

  return Array.from(logs.values()).sort((a, b) =>
    a.person1.localeCompare(b.person1, 'zh-CN')
  );
}
