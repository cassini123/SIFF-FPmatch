import * as XLSX from 'xlsx';
import { ScheduleTable } from '@/contexts/ScheduleContext';
import { ParsedScheduleTable } from '@/contexts/ScheduleTableContext';
import { getCinemaDistrict } from '@/lib/scheduleConstants';
import { getWeekDay } from '@/lib/parseScheduleTable';
import { ExportPreviewPayload, ExportPreviewSheet } from '@/lib/exportPreviewTypes';

function buildDailySheet(
  date: string,
  scheduleTable: ScheduleTable
): ExportPreviewSheet {
  const dateCells = scheduleTable.cells.filter(c => c.date === date);
  const weekDay = getWeekDay(date);

  const knownCinemas: typeof dateCells = [];
  const unknownCinemas: typeof dateCells = [];

  dateCells.forEach(cell => {
    if (getCinemaDistrict(cell.cinema)) {
      knownCinemas.push(cell);
    } else {
      unknownCinemas.push(cell);
    }
  });

  const sortByCinema = (a: (typeof dateCells)[0], b: (typeof dateCells)[0]) =>
    a.cinema.localeCompare(b.cinema);
  knownCinemas.sort(sortByCinema);
  unknownCinemas.sort(sortByCinema);

  const sortedCells = [...knownCinemas, ...unknownCinemas];
  const rows: string[][] = [
    ['影院', '影厅', '日期', '星期', '时间', '电影', '字幕员1', '字幕员2'],
  ];
  const mutedRowIndices: number[] = [];

  const cinemaHallMap = new Map<string, typeof dateCells>();
  sortedCells.forEach(cell => {
    const key = `${cell.cinema}|${cell.hall}`;
    if (!cinemaHallMap.has(key)) {
      cinemaHallMap.set(key, []);
    }
    cinemaHallMap.get(key)!.push(cell);
  });

  cinemaHallMap.forEach(cells => {
    cells.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    const isUnknown = !getCinemaDistrict(cells[0].cinema);

    cells.forEach(cell => {
      const key = `${cell.date}|${cell.cinema}|${cell.hall}|${cell.timeSlot}`;
      const assignment = scheduleTable.assignments[key];
      rows.push([
        cell.cinema,
        cell.hall,
        date,
        weekDay,
        cell.timeSlot,
        cell.movieName,
        assignment?.subtitler1 || '',
        assignment?.subtitler2 || '',
      ]);
      if (isUnknown) {
        mutedRowIndices.push(rows.length - 2);
      }
    });
  });

  return {
    name: date.replace(/-/g, ''),
    rows,
    mutedRowIndices: mutedRowIndices.length > 0 ? mutedRowIndices : undefined,
  };
}

function writeWorkbookFromPreview(fileName: string, sheets: ExportPreviewSheet[]): void {
  const wb = XLSX.utils.book_new();

  sheets.forEach(sheet => {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    ws['!cols'] = [
      { wch: 15 },
      { wch: 8 },
      { wch: 12 },
      { wch: 6 },
      { wch: 8 },
      { wch: 20 },
      { wch: 10 },
      { wch: 10 },
    ];

    if (sheet.mutedRowIndices?.length) {
      sheet.mutedRowIndices.forEach(dataRowIdx => {
        const excelRow = dataRowIdx + 1;
        for (let c = 0; c < 8; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: excelRow, c });
          if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
          ws[cellRef].s = {
            fill: { fgColor: { rgb: '808080' } },
            font: { color: { rgb: 'FFFFFF' } },
          };
        }
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  XLSX.writeFile(wb, fileName);
}

export function getDailyScheduleExportFileName(): string {
  return `排班总表_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
}

export function buildDailyScheduleExportPreview(
  scheduleTable: ScheduleTable,
  _scheduleData: ParsedScheduleTable
): ExportPreviewPayload {
  const allDates = [...new Set(scheduleTable.cells.map(c => c.date))].sort();
  const sheets = allDates.map(date => buildDailySheet(date, scheduleTable));
  const fileName = getDailyScheduleExportFileName();

  return {
    title: '排班总表导出预览',
    fileName,
    sheets,
    download: () => writeWorkbookFromPreview(fileName, sheets),
  };
}
