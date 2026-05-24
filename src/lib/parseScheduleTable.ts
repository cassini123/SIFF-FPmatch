import * as XLSX from 'xlsx';
import { 
  MovieShow, 
  ScheduleRow, 
  ParsedScheduleTable 
} from '@/contexts/ScheduleTableContext';

const FIXED_HEADERS = ['日期', '周', '影院', '影厅'] as const;

function formatScheduleDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slash = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (slash) {
    return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`;
  }
  return text;
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** 将表头单元格解析为 HH:MM 时间段 */
export function parseTimeSlotHeader(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
  // Excel 时间序列（0~1 表示一天内的时间）
    if (value >= 0 && value < 1) {
      const totalMinutes = Math.round(value * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    // Excel 日期序列号不应出现在时间列
    if (value >= 1) return null;
  }

  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }

  const text = String(value).trim().replace(/：/g, ':');
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  return null;
}

function timeSlotToMinutes(timeSlot: string): number {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function sortTimeSlots(timeSlots: string[]): string[] {
  return [...timeSlots].sort((a, b) => timeSlotToMinutes(a) - timeSlotToMinutes(b));
}

function findScheduleHeaderRow(rawData: unknown[][]): number {
  for (let rowIdx = 0; rowIdx < Math.min(10, rawData.length); rowIdx++) {
    const row = rawData[rowIdx] || [];
    const h0 = cellString(row[0]);
    const h2 = cellString(row[2]);
    const h3 = cellString(row[3]);
    if (h0.includes('日期') && h2.includes('影院') && h3.includes('影厅')) {
      return rowIdx;
    }
  }
  return -1;
}

function parseTimeSlotColumns(headerRow: unknown[]): { col: number; timeSlot: string }[] {
  const cols: { col: number; timeSlot: string }[] = [];
  for (let col = 4; col < headerRow.length; col++) {
    const timeSlot = parseTimeSlotHeader(headerRow[col]);
    if (timeSlot) {
      cols.push({ col, timeSlot });
    }
  }
  return cols;
}

function findScheduleWorksheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet?.['!ref']) continue;
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];
    if (findScheduleHeaderRow(rawData) >= 0) {
      return worksheet;
    }
  }

  const fallback = workbook.Sheets[workbook.SheetNames[0]];
  if (!fallback) {
    throw new Error('Excel 文件中没有可用的工作表');
  }
  return fallback;
}

// 解析电影场次数据
function parseMovieShow(raw: string): MovieShow | null {
  if (!raw || raw.trim() === '') {
    return null;
  }
  
  // 格式: 代码 + 电影名 + 时长 + 国家 + 票价 [+ 观众见面会]
  const parts = raw.split(' + ');
  if (parts.length < 6) {
    // 格式不正确，尝试简单解析
    return {
      code: '',
      name: raw,
      duration: '',
      country: '',
      price: '',
      hasMeetup: false,
      raw: raw
    };
  }
  
  const [code, nameAndDuration, country, price, ...rest] = parts;
  
  // 解析时长 "105分钟"
  const durationMatch = nameAndDuration.match(/(\d+)分钟/);
  const duration = durationMatch ? `${durationMatch[1]}分钟` : '';
  
  // 提取纯电影名
  const movieName = nameAndDuration.replace(/\d+分钟/, '').trim();
  
  // 检查是否有观众见面会
  const hasMeetup = rest.some(r => r.includes('观众见面会'));
  
  return {
    code,
    name: movieName,
    duration,
    country,
    price: price || '',
    hasMeetup,
    raw
  };
}

// 从URL解析排片表
export async function parseScheduleTableFromUrl(url: string): Promise<ParsedScheduleTable> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Excel file: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = findScheduleWorksheet(workbook);
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
    
    return parseScheduleData(rawData);
  } catch (error) {
    console.error('Error loading schedule table:', error);
    throw error;
  }
}

// 从File对象解析排片表
export async function parseScheduleTableFromFile(file: File): Promise<ParsedScheduleTable> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = findScheduleWorksheet(workbook);
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
    const parsed = parseScheduleData(rawData);
    if (parsed.rows.length === 0) {
      throw new Error('未能解析到排片数据，请检查表头（日期、周、影院、影厅）与数据行');
    }
    return parsed;
  } catch (error) {
    console.error('Error parsing schedule file:', error);
    throw error;
  }
}

// 解析排片数据
function parseScheduleData(rawData: string[][]): ParsedScheduleTable {
  const headerRowIdx = findScheduleHeaderRow(rawData);
  if (headerRowIdx < 0) {
    throw new Error(`未能识别排片表表头，请确认前四列为：${FIXED_HEADERS.join('、')}`);
  }

  const headerRow = rawData[headerRowIdx] || [];
  const timeColumns = parseTimeSlotColumns(headerRow);
  if (timeColumns.length === 0) {
    throw new Error('未能从表头读取时间段列，请确认「影厅」列之后为 HH:MM 格式的时间表头');
  }

  const timeSlots = sortTimeSlots(timeColumns.map(c => c.timeSlot));

  const rows: ScheduleRow[] = [];
  const datesSet = new Set<string>();
  const cinemasSet = new Set<string>();
  const hallsSet = new Set<string>();
  
  for (let rowIdx = headerRowIdx + 1; rowIdx < rawData.length; rowIdx++) {
    const row = rawData[rowIdx];
    
    // 跳过空行
    if (!row[0] || !row[2]) continue;
    
    const date = formatScheduleDate(row[0]);
    const week = cellString(row[1]);
    const cinema = cellString(row[2]);
    const hall = cellString(row[3]);
    
    if (!date || !cinema || !hall) continue;
    
    datesSet.add(date);
    cinemasSet.add(cinema);
    hallsSet.add(hall);
    
    const shows: { [timeSlot: string]: MovieShow | null } = {};
    for (const slot of timeSlots) {
      shows[slot] = null;
    }
    for (const { col, timeSlot } of timeColumns) {
      const rawValue = cellString(row[col]);
      shows[timeSlot] = parseMovieShow(rawValue);
    }
    
    rows.push({
      date,
      week,
      cinema,
      hall,
      shows
    });
  }
  
  return {
    dates: Array.from(datesSet).sort(),
    cinemas: Array.from(cinemasSet).sort(),
    halls: Array.from(hallsSet).sort(),
    timeSlots,
    rows
  };
}

// 格式化日期显示
export function formatDateDisplay(dateStr: string, week?: string): string {
  // dateStr格式: 2024-06-15
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  const weekDays: { [key: string]: string } = {
    '0': '周日',
    '1': '周一',
    '2': '周二',
    '3': '周三',
    '4': '周四',
    '5': '周五',
    '6': '周六'
  };
  
  const weekDay = week || weekDays[date.getDay().toString()] || '';
  
  return `${month}月${day}日 ${weekDay}`;
}

// 获取日期对应的星期
export function getWeekDay(dateStr: string): string {
  const date = new Date(dateStr);
  const weekDays: string[] = ['日', '一', '二', '三', '四', '五', '六'];
  return weekDays[date.getDay()];
}
