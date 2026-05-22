// ============================================
// 字幕员时间 与 影片时间 对应规则
// ============================================
export const TIME_MAPPING: Record<string, string[]> = {
  '9:00': ['8:30', '9:30'],
  '10:30': ['10:00', '10:30'],
  '13:00': ['13:00'],
  '14:00': ['13:00'], // 注意：14:00对应13:00影片时间
  '15:00': ['15:30'],
  '17:00': ['18:00'],
  '18:30': ['18:30'],
  '20:40': ['20:40'],
  '23:00': ['20:40'], // 注意：23:00对应20:40影片时间
};

// 字幕员时间段列表
export const SUBTITLER_TIME_SLOTS = ['9:00', '10:30', '13:00', '14:00', '15:00', '17:00', '18:30', '20:40', '23:00'];

// 影片时间段列表
export const MOVIE_TIME_SLOTS = ['08:30', '09:30', '10:00', '10:30', '13:00', '15:30', '18:00', '18:30', '20:40'];

// ============================================
// 影院所属行政区映射
// ============================================
export const CINEMA_DISTRICTS: Record<string, string> = {
  // 黄浦区
  '大光明': '黄浦区',
  '和平影都': '黄浦区',
  'UME': '黄浦区',
  '黄埔剧场': '黄浦区',
  '上海科技影城': '黄浦区',
  '兰心大剧院': '黄浦区',
  '国泰电影院': '黄浦区',
  
  // 虹口区
  'CGV影城': '虹口区',
  
  // 徐汇区
  'SFC上影美罗城': '徐汇区',
  '朵云轩': '徐汇区',
  '百丽宫环贸': '徐汇区',
  'SFC上影港汇永华': '徐汇区',
  '宛平剧院': '徐汇区',
  'CMG融媒影城': '徐汇区',
  
  // 长宁区
  '上海影城SHO': '长宁区',
  '天山电影院': '长宁区',
  '百丽宫影城长宁来福士': '长宁区',
  
  // 静安区
  '美琪大剧院': '静安区',
  '艺海剧院': '静安区',
  '沪北电影院': '静安区',
  '博纳UA梅龙镇': '静安区',
  '百美汇影城': '静安区',
  '寰映影城': '静安区',
  '百丽宫协信店': '静安区',
  '上海商城': '静安区',
  
  // 普陀区
  '曹杨影城': '普陀区',
  'AMG环球港': '普陀区',
  
  // 闵行区
  '红星电影世界吴中路': '闵行区',
  '百丽宫万象城': '闵行区',
  '世纪友谊影城': '闵行区',
  
  // 杨浦区
  'SFC上影国华广场': '杨浦区',
  
  // 宝山区
  'SFC上影新业坊店': '宝山区',
  
  // 嘉定区
  '嘉定影剧院': '嘉定区',
  
  // 浦东新区
  '橙天嘉禾影城': '浦东新区',
  '百丽宫陆家嘴': '浦东新区',
  'SFC上影丁香路': '浦东新区',
  'SFC上影啦啦宝都店': '浦东新区',
  '保利国际影城世博店': '浦东新区',
};

// 获取影院所属区域（支持模糊匹配）
export function getCinemaDistrict(cinemaName: string): string | null {
  // 1. 精确匹配
  if (CINEMA_DISTRICTS[cinemaName]) {
    return CINEMA_DISTRICTS[cinemaName];
  }
  
  // 2. 模糊匹配 - 包含关系
  for (const [key, district] of Object.entries(CINEMA_DISTRICTS)) {
    if (cinemaName.includes(key) || key.includes(cinemaName)) {
      return district;
    }
  }
  
  // 3. 打印调试信息
  console.warn(`无法找到影院 "${cinemaName}" 所属区域`);
  
  return null;
}

// 获取所有区域列表（不含"区"字）
export function getDistrictShortNames(): string[] {
  const districts = new Set(Object.values(CINEMA_DISTRICTS));
  return Array.from(districts).map(d => d.replace('区', ''));
}

// ============================================
// 大前提条件默认值
// ============================================
export interface ScheduleConstraints {
  maxPerDay: number;         // 每个字幕员每天排班限制
  maxTotal: number;          // 每个字幕员总场次限制
  exclusiveTimeSlot: boolean; // 同一时间段只能在一个影院
  preferMoreTimeSlots: boolean; // 优先使用时间块多的字幕员
}

export const DEFAULT_CONSTRAINTS: ScheduleConstraints = {
  maxPerDay: 2,              // 不超过2场/天
  maxTotal: 5,               // 不超过5场总计
  exclusiveTimeSlot: true,   // 同一时间段只能在一个影院
  preferMoreTimeSlots: true, // 优先使用时间块多的
};

// ============================================
// 排班状态类型
// ============================================
export interface ScheduleAssignment {
  subtitler1: string | null; // 字幕员1姓名
  subtitler2: string | null; // 字幕员2姓名
  subtitler1Id: string | null;
  subtitler2Id: string | null;
}

export type ScheduleMode = 'manual' | 'auto';

// ============================================
// 影院-影厅-时间段 唯一标识
// ============================================
export function getSlotKey(date: string, cinema: string, hall: string, timeSlot: string): string {
  return `${date}|${cinema}|${hall}|${timeSlot}`;
}

// ============================================
// 行政区中文名转全称
// ============================================
export function toFullDistrictName(shortName: string): string {
  if (shortName.includes('区')) return shortName;
  return `${shortName}区`;
}

// ============================================
// 行政区全称转简称
// ============================================
export function toShortDistrictName(fullName: string): string {
  return fullName.replace('区', '');
}
