import * as XLSX from 'xlsx';
import { SUBTITLER_TIME_SLOTS } from '@/lib/scheduleConstants';

export interface SubtitlerRow {
  id: string;
  name: string;
  schedule: { [date: string]: { [timeSlot: string]: string | null } };
  districts: { [district: string]: string | null };
  partner: string | null;
}

export interface ParsedScheduleHeaders {
  dates: string[];
  timeSlots: string[];
  districts: string[];
}

export interface ParsedSchedule {
  rows: SubtitlerRow[];
  dates: string[];
  headers: ParsedScheduleHeaders;
}

export const DISTRICTS = ['嘉定', '宝山', '闵行', '杨浦', '普陀', '虹口', '浦东', '长宁', '静安', '徐汇', '黄浦'];

const HEADER_SCAN_ROWS = 20;

function normalizeSubtitlerTime(time: string): string {
  const t = time.replace(/：/g, ':').trim();
  if (t === '15:30' || t === '15:30:00') return '15:00';
  const match = t.match(/^0?(\d{1,2}):(\d{2})/);
  if (match) {
    return `${parseInt(match[1], 10)}:${match[2]}`;
  }
  return t;
}

/** 从表头单元格文本解析「日期 + 时间」，如 18日-9:00、6月18日 9:00 */
function parseDateTimeHeader(text: string): { date: string; time: string } | null {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  // 18日-9:00 / 18日 9:00 / 18日9:00
  let m = raw.match(/(\d{1,2})日[-–—~\s]*(\d{1,2})[:：](\d{2})/);
  if (m) {
    return { date: `${m[1]}日`, time: normalizeSubtitlerTime(`${m[2]}:${m[3]}`) };
  }

  // 6月18日-9:00
  m = raw.match(/(\d{1,2})月(\d{1,2})日[-–—~\s]*(\d{1,2})[:：](\d{2})/);
  if (m) {
    return { date: `${m[2]}日`, time: normalizeSubtitlerTime(`${m[3]}:${m[4]}`) };
  }

  // 仅时间列（配合独立日期行）
  m = raw.match(/^(\d{1,2})[:：](\d{2})$/);
  if (m) {
    return { date: '', time: normalizeSubtitlerTime(`${m[1]}:${m[2]}`) };
  }

  return null;
}

function getCellDisplay(worksheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return '';
  if (cell.w != null && String(cell.w).trim()) return String(cell.w).trim();
  if (cell.v == null) return '';
  return String(cell.v).trim();
}

function rowToStrings(
  worksheet: XLSX.WorkSheet,
  row: unknown[],
  rowIndex: number
): string[] {
  const maxCol = Math.max(row.length - 1, 0);
  const len = Math.max(maxCol + 1, 60);
  const out: string[] = [];
  for (let c = 0; c < len; c++) {
    const fromSheet = getCellDisplay(worksheet, rowIndex, c);
    const fromJson = row[c] != null ? String(row[c]).trim() : '';
    out[c] = fromSheet || fromJson;
  }
  return out;
}

function isLikelyPersonName(name: string): boolean {
  if (!name || name.length < 2) return false;
  if (/^\d+$/.test(name)) return false;
  if (/姓名|名字|编号|搭档|区域|影院|日期|影厅/.test(name)) return false;
  return /[\u4e00-\u9fa5]/.test(name);
}

function parseCombinedFormat(
  worksheet: XLSX.WorkSheet,
  rawData: unknown[][],
  headerRowIndex: number
): ParsedSchedule | null {
  const headerCells = rowToStrings(worksheet, rawData[headerRowIndex] || [], headerRowIndex);
  const combinedCols: { col: number; date: string; time: string }[] = [];

  headerCells.forEach((text, col) => {
    const parsed = parseDateTimeHeader(text);
    if (parsed && parsed.date) {
      combinedCols.push({ col, date: parsed.date, time: parsed.time });
    }
  });

  if (combinedCols.length < 3) {
    return null;
  }

  const dates = [...new Set(combinedCols.map(c => c.date))];
  const timeSlots = [
    ...new Set(combinedCols.map(c => c.time)),
  ].sort((a, b) => {
    const ia = SUBTITLER_TIME_SLOTS.indexOf(a);
    const ib = SUBTITLER_TIME_SLOTS.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  let nameCol = headerCells.findIndex(
    h => /姓名|名字/.test(h)
  );
  if (nameCol < 0) {
    nameCol = headerCells.findIndex(h => /^编号/.test(h) || h === '编号');
    if (nameCol >= 0) nameCol += 1;
  }
  if (nameCol < 0) {
    nameCol = detectNameColumnByData(worksheet, rawData, headerRowIndex);
  }

  let partnerCol = headerCells.findIndex(h => /搭档|伙伴/.test(h));

  const districtCols: { district: string; col: number }[] = [];
  headerCells.forEach((text, col) => {
    if (combinedCols.some(c => c.col === col)) return;
    for (const d of DISTRICTS) {
      if (text.includes(d) || text.includes(`${d}区`)) {
        districtCols.push({ district: d, col });
      }
    }
  });

  const districts = districtCols.map(d => d.district);
  const rows: SubtitlerRow[] = [];

  for (let rowIdx = headerRowIndex + 1; rowIdx < rawData.length; rowIdx++) {
    const row = rawData[rowIdx] || [];
    const name = getCellDisplay(worksheet, rowIdx, nameCol) ||
      String(row[nameCol] ?? '').trim();
    if (!isLikelyPersonName(name)) continue;

    const schedule: SubtitlerRow['schedule'] = {};
    for (const date of dates) {
      schedule[date] = {};
      for (const slot of timeSlots) {
        schedule[date][slot] = null;
      }
    }

    for (const { col, date, time } of combinedCols) {
      const raw =
        getCellDisplay(worksheet, rowIdx, col) || String(row[col] ?? '').trim();
      schedule[date][time] = parseOccupancy(raw);
    }

    const districtsMap: SubtitlerRow['districts'] = {};
    for (const d of DISTRICTS) districtsMap[d] = null;
    for (const { district, col } of districtCols) {
      const raw =
        getCellDisplay(worksheet, rowIdx, col) || String(row[col] ?? '').trim();
      districtsMap[district] = raw ? raw : null;
    }

    const partner =
      partnerCol >= 0
        ? getCellDisplay(worksheet, rowIdx, partnerCol) ||
          String(row[partnerCol] ?? '').trim() ||
          null
        : null;

    rows.push({
      id: String(getCellDisplay(worksheet, rowIdx, 0) || row[0] || rowIdx),
      name,
      schedule,
      districts: districtsMap,
      partner,
    });
  }

  if (rows.length === 0) return null;

  return {
    rows,
    dates,
    headers: { dates, timeSlots, districts },
  };
}

function detectNameColumnByData(
  worksheet: XLSX.WorkSheet,
  rawData: unknown[][],
  headerRowIndex: number
): number {
  const scores = new Map<number, number>();
  const end = Math.min(headerRowIndex + 30, rawData.length);

  for (let r = headerRowIndex + 1; r < end; r++) {
    for (let c = 0; c < 15; c++) {
      const v = getCellDisplay(worksheet, r, c);
      if (isLikelyPersonName(v)) {
        scores.set(c, (scores.get(c) || 0) + 1);
      }
    }
  }

  let best = 1;
  let bestScore = 0;
  scores.forEach((score, col) => {
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  });
  return best;
}

function findBestHeaderRow(
  worksheet: XLSX.WorkSheet,
  rawData: unknown[][]
): number {
  let bestRow = 0;
  let bestScore = 0;

  for (let r = 0; r < Math.min(HEADER_SCAN_ROWS, rawData.length); r++) {
    const cells = rowToStrings(worksheet, rawData[r] || [], r);
    let score = 0;
    for (const text of cells) {
      const p = parseDateTimeHeader(text);
      if (p?.date) score += 2;
      else if (p?.time) score += 1;
      if (/姓名|名字/.test(text)) score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

function parseOccupancy(raw: string): string | null {
  if (!raw) return null;
  const letter = raw.split(/[.\s]/)[0].trim();
  if (!letter || /^\d+$/.test(letter)) return null;
  return letter;
}

function parseLegacySubtitlerWorksheet(
  worksheet: XLSX.WorkSheet,
  range: XLSX.Range
): ParsedSchedule {
  let dateRow = -1;
  const dates: string[] = [];

  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + HEADER_SCAN_ROWS); R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const text = getCellDisplay(worksheet, R, C);
      const dateMatch = text.match(/(\d{1,2})日/);
      if (dateMatch && !/[:：]/.test(text)) {
        if (dateRow < 0) dateRow = R;
        if (dateRow === R) {
          dates.push(`${dateMatch[1]}日`);
        }
      }
    }
    if (dateRow >= 0 && R > dateRow) break;
  }

  if (dateRow < 0 || dates.length === 0) {
    return {
      rows: [],
      dates: [],
      headers: { dates: [], timeSlots: SUBTITLER_TIME_SLOTS, districts: [] },
    };
  }

  const headerRow = dateRow + 1;
  let nameColIdx = -1;
  let partnerColIdx = -1;
  const districtCols: { [key: string]: number } = {};
  const timeCols: { [date: string]: { [time: string]: number } } = {};

  for (let C = range.s.c; C <= range.e.c; C++) {
    const headerValue = getCellDisplay(worksheet, headerRow, C);
    if (/姓名|名字/.test(headerValue)) nameColIdx = C;
    else if (/搭档|伙伴/.test(headerValue)) partnerColIdx = C;
  }

  for (let C = range.s.c; C <= range.e.c; C++) {
    const dateText = getCellDisplay(worksheet, dateRow, C);
    const timeMatch = dateText.match(/(\d{1,2})[:：](\d{2})/);
    if (timeMatch) {
      const time = normalizeSubtitlerTime(`${timeMatch[1]}:${timeMatch[2]}`);
      for (const date of dates) {
        if (!timeCols[date]) timeCols[date] = {};
        timeCols[date][time] = C;
      }
    }
  }

  for (let r = dateRow - 1; r >= range.s.r; r--) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellValue = getCellDisplay(worksheet, r, C);
      for (const d of DISTRICTS) {
        if (
          (cellValue.includes(d) || d.includes(cellValue)) &&
          districtCols[d] === undefined
        ) {
          districtCols[d] = C;
        }
      }
    }
  }

  if (nameColIdx < 0) {
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];
    nameColIdx = detectNameColumnByData(worksheet, rawData, headerRow);
  }

  const timeSlots = SUBTITLER_TIME_SLOTS;
  const districts = Object.keys(districtCols);
  const rows: SubtitlerRow[] = [];

  for (let R = headerRow + 1; R <= range.e.r; R++) {
    const name = getCellDisplay(worksheet, R, nameColIdx);
    if (!isLikelyPersonName(name)) continue;

    const schedule: SubtitlerRow['schedule'] = {};
    for (const date of dates) {
      schedule[date] = {};
      for (const timeSlot of timeSlots) {
        const colIdx = timeCols[date]?.[timeSlot];
        if (colIdx !== undefined) {
          schedule[date][timeSlot] = parseOccupancy(
            getCellDisplay(worksheet, R, colIdx)
          );
        } else {
          schedule[date][timeSlot] = null;
        }
      }
    }

    const districtsMap: SubtitlerRow['districts'] = {};
    for (const district of DISTRICTS) {
      const colIdx = districtCols[district];
      districtsMap[district] =
        colIdx !== undefined
          ? getCellDisplay(worksheet, R, colIdx) || null
          : null;
    }

    rows.push({
      id: String(R),
      name,
      schedule,
      districts: districtsMap,
      partner:
        partnerColIdx >= 0
          ? getCellDisplay(worksheet, R, partnerColIdx) || null
          : null,
    });
  }

  return {
    rows,
    dates,
    headers: { dates, timeSlots, districts },
  };
}

function parseSubtitlerWorksheet(worksheet: XLSX.WorkSheet): ParsedSchedule {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  }) as unknown[][];

  if (rawData.length === 0) {
    return {
      rows: [],
      dates: [],
      headers: { dates: [], timeSlots: SUBTITLER_TIME_SLOTS, districts: [] },
    };
  }

  const headerRowIndex = findBestHeaderRow(worksheet, rawData);
  const combined = parseCombinedFormat(worksheet, rawData, headerRowIndex);
  if (combined && combined.rows.length > 0) {
    return combined;
  }

  // 若第 0 行不像表头，再试扫描到的最佳行以外的常见第 2 行
  if (headerRowIndex !== 0) {
    const retry = parseCombinedFormat(worksheet, rawData, 0);
    if (retry && retry.rows.length > 0) return retry;
  }

  const legacy = parseLegacySubtitlerWorksheet(worksheet, range);
  if (legacy.rows.length > 0) return legacy;

  return combined || legacy;
}

function looksLikeScheduleTable(rawData: unknown[][]): boolean {
  for (let r = 0; r < Math.min(3, rawData.length); r++) {
    const joined = (rawData[r] || []).map(c => String(c ?? '').trim()).join(' ');
    if (/日期/.test(joined) && /影院/.test(joined) && /影厅/.test(joined)) {
      return true;
    }
  }
  return false;
}

function parseWorkbook(workbook: XLSX.WorkBook): ParsedSchedule {
  let best: ParsedSchedule = {
    rows: [],
    dates: [],
    headers: { dates: [], timeSlots: SUBTITLER_TIME_SLOTS, districts: [] },
  };

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet || !worksheet['!ref']) continue;
    const rawPreview = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];
    if (looksLikeScheduleTable(rawPreview)) continue;
    const parsed = parseSubtitlerWorksheet(worksheet);
    if (parsed.rows.length > best.rows.length) {
      best = parsed;
    }
  }

  return best;
}

export async function parseSubtitlerExcelFromUrl(url: string): Promise<ParsedSchedule> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Excel file: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  return parseWorkbook(workbook);
}

export async function parseSubtitlerExcelFromFile(file: File): Promise<ParsedSchedule> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: false,
    raw: false,
  });
  const result = parseWorkbook(workbook);

  if (result.rows.length === 0) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const preview = sheet
      ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0]
      : [];
    const previewText = Array.isArray(preview)
      ? preview.slice(0, 8).map(c => String(c ?? '')).join(' | ')
      : '';
    throw new Error(
      `未能解析到字幕员数据。请在「字幕员数据」标签上传字幕员表（表头含 18日-9:00 或 姓名），勿上传排片表。当前首行：${previewText || '（空）'}`
    );
  }

  console.log(
    `[字幕员解析] ${result.rows.length} 人, ${result.dates.length} 天, 工作表数 ${workbook.SheetNames.length}`
  );
  return result;
}

export function getDateDisplay(dateStr: string): string {
  const match = dateStr.match(/(\d+)日/);
  if (match) return `${parseInt(match[1], 10)}日`;
  return dateStr;
}

export const TIME_SLOTS = SUBTITLER_TIME_SLOTS;
