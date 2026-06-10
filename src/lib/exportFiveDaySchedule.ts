import * as XLSX from 'xlsx';
import { ParsedScheduleTable } from '@/contexts/ScheduleTableContext';
import { ScheduleTable } from '@/contexts/ScheduleContext';
import { ParsedSchedule } from '@/lib/parseSubtitlerExcel';
import { getCinemaDistrict, getSlotKey } from '@/lib/scheduleConstants';
import { formatSubtitlerNamesForExport } from '@/lib/scheduleHelpers';

function sortScheduleRows(rows: ParsedScheduleTable['rows']): ParsedScheduleTable['rows'] {
  const known: ParsedScheduleTable['rows'] = [];
  const unknown: ParsedScheduleTable['rows'] = [];

  rows.forEach(row => {
    if (getCinemaDistrict(row.cinema)) {
      known.push(row);
    } else {
      unknown.push(row);
    }
  });

  const byDateCinemaHall = (a: ParsedScheduleTable['rows'][0], b: ParsedScheduleTable['rows'][0]) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const cinemaCmp = a.cinema.localeCompare(b.cinema);
    if (cinemaCmp !== 0) return cinemaCmp;
    return a.hall.localeCompare(b.hall);
  };

  known.sort(byDateCinemaHall);
  unknown.sort(byDateCinemaHall);
  return [...known, ...unknown];
}

export function buildFiveDayConsolidatedSheetData(
  scheduleData: ParsedScheduleTable,
  scheduleTable: ScheduleTable,
  subtitlerData: ParsedSchedule | null
): string[][] {
  const { timeSlots } = scheduleData;
  const headerRow: string[] = ['日期', '周', '影院', '影厅'];
  for (const timeSlot of timeSlots) {
    headerRow.push(timeSlot, '字幕员1', '字幕员2');
  }

  const dataRows = sortScheduleRows(scheduleData.rows).map(row => {
    const line: string[] = [row.date, row.week, row.cinema, row.hall];
    for (const timeSlot of timeSlots) {
      const show = row.shows[timeSlot];
      const movieCell = show
        ? show.raw || `${show.code ? `[${show.code}] ` : ''}${show.name}`
        : '';
      const key = getSlotKey(row.date, row.cinema, row.hall, timeSlot);
      const assignment = scheduleTable.assignments[key];
      const { subtitler1, subtitler2 } = assignment
        ? formatSubtitlerNamesForExport(assignment, subtitlerData)
        : { subtitler1: '', subtitler2: '' };
      line.push(movieCell, subtitler1, subtitler2);
    }
    return line;
  });

  return [headerRow, ...dataRows];
}

export function exportFiveDayConsolidatedExcel(
  scheduleData: ParsedScheduleTable,
  scheduleTable: ScheduleTable,
  subtitlerData: ParsedSchedule | null
): string {
  const sheetData = buildFiveDayConsolidatedSheetData(scheduleData, scheduleTable, subtitlerData);
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  const colWidths: XLSX.ColInfo[] = [
    { wch: 12 },
    { wch: 6 },
    { wch: 28 },
    { wch: 10 },
  ];
  for (let i = 0; i < scheduleData.timeSlots.length; i++) {
    colWidths.push({ wch: 8 }, { wch: 10 }, { wch: 10 });
  }
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '五日合表');

  const fileName = `五日合表_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
