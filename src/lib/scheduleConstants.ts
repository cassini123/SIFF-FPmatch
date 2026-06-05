// ============================================
// 字幕员时间 与 影片时间 对应规则
// ============================================
export const TIME_MAPPING: Record<string, string[]> = {
  '10:30': ['10:00', '10:30'],
  '13:00': ['12:00', '12:30', '13:00', '13:30'],
  '15:00': ['14:30', '15:00', '15:30'],
  '18:00': ['18:00', '18:30'],
  '20:40': ['20:40', '21:00'],
};

/** 映射逻辑档位 → 字幕员 Excel 表头实际列名（列名不一致时；2026 问卷与 TIME_MAPPING 键一致，无需转换） */
export const SUBTITLER_SCHEDULE_SLOT: Record<string, string> = {};

// 字幕员问卷时间段（2026 前五天：5 档；完整问卷含 9:00、23:00）
export const SUBTITLER_TIME_SLOTS = ['9:00', '10:30', '13:00', '15:00', '18:00', '20:40', '23:00'];

// ============================================
// 影院所属行政区映射（2026 排片表全称）
// ============================================
export const CINEMA_DISTRICTS: Record<string, string> = {
  // 嘉定区
  '嘉定影剧院': '嘉定区',

  // 宝山区
  '星轶STARX影剧院（上海宝山日月光店）': '宝山区',

  // 闵行区
  '上海百丽宫影城（万象城店）': '闵行区',
  '世纪友谊影城（LUXE南方商城店）': '闵行区',

  // 杨浦区
  'SFC上影影城（国华广场店）': '杨浦区',
  '沪东工人文化宫东宫影剧院': '杨浦区',

  // 普陀区
  '曹杨影城': '普陀区',

  // 虹口区
  'CGV影城（白玉兰广场IMAX店）': '虹口区',

  // 浦东新区
  'MOViE MOViE影城（前滩太古里店）': '浦东新区',
  'SFC上影影城（丁香路LUXE店）': '浦东新区',
  'SFC上影百联影城（八佰伴IMAX店）': '浦东新区',
  'SFC永华电影荟（世纪汇店）': '浦东新区',
  '上海百丽宫影城（陆家嘴中心店）': '浦东新区',

  // 长宁区
  '上海影城SHO': '长宁区',
  '天山电影院-虹桥艺术中心旗舰店': '长宁区',
  '上海百丽宫影城（长宁来福士店）': '长宁区',

  // 静安区
  '上海艺海剧院': '静安区',
  '上海美琪大戏院': '静安区',
  '久事·上海商城剧院': '静安区',
  '上海市沪北电影院': '静安区',
  '寰映影城（大融城店）': '静安区',
  '佰映三克映画': '静安区',
  '上海百美汇影城（静安嘉里中心店）': '静安区',

  // 徐汇区
  '天山电影院-宛平剧院影城': '徐汇区',
  'CMG融媒影城': '徐汇区',
  'SFC上影影城（港汇永华IMAX激光店）': '徐汇区',
  'SFC动漫主题影院（美罗城店）': '徐汇区',
  '上海百丽宫影城（环贸iapm店）': '徐汇区',
  '朵云轩杜比全景声影城': '徐汇区',

  // 黄浦区
  '上海大光明电影院': '黄浦区',
  '和平影都': '黄浦区',
  '黄浦剧场': '黄浦区',
  '兰心大戏院': '黄浦区',
  '上海科技影城': '黄浦区',
  '国泰电影院': '黄浦区',
  'UME影城（上海新天地店）': '黄浦区',
  '博悦汇影城(BFC外滩金融中心店)': '黄浦区',
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
  noCrossCinemaPerDay: boolean; // 同日禁止跨影院（可跨影厅）
  preferMoreTimeSlots: boolean; // 优先使用时间块多的字幕员
  preferFewerTimeSlots: boolean; // 优先使用时间块少的字幕员（与 preferMoreTimeSlots 互斥）
}

export const DEFAULT_CONSTRAINTS: ScheduleConstraints = {
  maxPerDay: 2,              // 不超过2场/天
  maxTotal: 5,               // 不超过5场总计
  exclusiveTimeSlot: true,   // 同一时间段只能在一个影院
  noCrossCinemaPerDay: false, // 默认关闭，可在设置中开启
  preferMoreTimeSlots: true, // 优先使用时间块多的
  preferFewerTimeSlots: false,
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
  // 「浦东新区」含两个「区」字，不能用 replace('区','')（会得到「浦东新」）
  if (fullName === '浦东新区') return '浦东';
  return fullName.replace(/区$/, '');
}
