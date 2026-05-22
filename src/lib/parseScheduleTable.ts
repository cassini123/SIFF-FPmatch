import * as XLSX from 'xlsx';
import { 
  MovieShow, 
  ScheduleRow, 
  ParsedScheduleTable 
} from '@/contexts/ScheduleTableContext';

// 时间段表头映射
const TIME_SLOTS = ['08:30', '09:30', '10:00', '10:30', '13:00', '15:30', '18:00', '18:30', '20:40'];

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
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
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
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
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
  const rows: ScheduleRow[] = [];
  const datesSet = new Set<string>();
  const cinemasSet = new Set<string>();
  const hallsSet = new Set<string>();
  
  // 跳过表头，从第2行开始
  for (let rowIdx = 1; rowIdx < rawData.length; rowIdx++) {
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
    
    // 解析各时间段的排片
    const shows: { [timeSlot: string]: MovieShow | null } = {};
    for (let i = 0; i < TIME_SLOTS.length; i++) {
      const timeSlot = TIME_SLOTS[i];
      const colIdx = i + 4; // 时间段从第5列开始（索引4）
      const rawValue = cellString(row[colIdx]);
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
    timeSlots: TIME_SLOTS,
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
