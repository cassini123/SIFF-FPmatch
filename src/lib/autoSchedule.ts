import { 
  ScheduleCell,
  ScheduleAssignment,
  ScheduleTable,
} from '@/contexts/ScheduleContext';
import { 
  ParsedSchedule,
  SubtitlerRow,
} from '@/lib/parseSubtitlerExcel';
import { 
  TIME_MAPPING,
  ScheduleConstraints,
  getCinemaDistrict,
  toShortDistrictName,
} from '@/lib/scheduleConstants';

// 标准化时间格式（移除前导零）用于匹配
function normalizeTime(time: string): string {
  return time.replace(/^0(\d)/, '$1');
}

// 根据影片时间获取对应的字幕员时间段
function getSubtitlerTimeSlot(movieTimeSlot: string): string | null {
  const normalizedMovieTime = normalizeTime(movieTimeSlot);
  for (const [subtitlerSlot, movieSlots] of Object.entries(TIME_MAPPING)) {
    const normalizedMovieSlots = movieSlots.map(t => normalizeTime(t));
    if (normalizedMovieSlots.includes(normalizedMovieTime)) {
      return subtitlerSlot;
    }
  }
  return null;
}

// 将电影排片日期格式转换为字幕员表日期格式
// 输入: "2024-06-18" 输出: "18日"
function convertToSubtitlerDate(dateStr: string): string {
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

// 从LocalStorage加载设置
function loadConstraints(): ScheduleConstraints {
  try {
    const saved = localStorage.getItem('settings_constraints');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('加载约束失败:', e);
  }
  return {
    maxPerDay: 2,
    maxTotal: 5,
    exclusiveTimeSlot: true,
    preferMoreTimeSlots: true,
  };
}

function loadDistrictPriority(): string[] {
  try {
    const saved = localStorage.getItem('settings_districts');
    if (saved) {
      const districts = JSON.parse(saved);
      return districts.map((d: { name: string }) => d.name);
    }
  } catch (e) {
    console.error('加载行政区优先级失败:', e);
  }
  return ['嘉定', '宝山', '闵行', '杨浦', '普陀', '虹口', '浦东', '长宁', '静安', '徐汇', '黄浦'];
}

// 字幕员当前状态
interface SubtitlerStatus {
  row: SubtitlerRow;
  dailyCount: Record<string, number>; // 每天已排场次
  totalCount: number; // 总场次
  usedSlots: Set<string>; // 已使用的时间段 (格式: date|timeSlot)
  manualAssignedSlots: Set<string>; // 手动分配的时段
}

// 影院-影厅-时间 唯一标识
function getUniqueSlot(date: string, cinema: string, hall: string, timeSlot: string): string {
  return `${date}|${cinema}|${hall}|${timeSlot}`;
}

// 检查字幕员在指定时间是否可用
function isSubtitlerAvailable(
  status: SubtitlerStatus,
  date: string,
  subtitlerTimeSlot: string,
  _constraints: ScheduleConstraints
): boolean {
  // 检查每日限制
  if (_constraints.maxPerDay > 0 && (status.dailyCount[date] || 0) >= _constraints.maxPerDay) {
    return false;
  }

  // 检查总场次限制
  if (_constraints.maxTotal > 0 && status.totalCount >= _constraints.maxTotal) {
    return false;
  }

  // 检查同一时间段是否已在其他地方使用（互斥规则）
  const slotKey = `${date}|${subtitlerTimeSlot}`;
  if (status.usedSlots.has(slotKey)) {
    return false;
  }

  // 检查字幕员表中该时间段是否有空（绿色格子 = null 表示空闲）
  const subtitlerSlots = status.row.schedule[date];
  if (!subtitlerSlots || subtitlerSlots[subtitlerTimeSlot] !== null) {
    return false;
  }

  // 检查是否已被手动分配（红色）
  if (status.manualAssignedSlots.has(slotKey)) {
    return false;
  }

  return true;
}

// 检查字幕员搭档是否可用
function isPartnerAvailable(
  partner: SubtitlerRow,
  date: string,
  subtitlerTimeSlot: string,
  constraints: ScheduleConstraints,
  statusMap: Map<string, SubtitlerStatus>
): boolean {
  const partnerStatus = statusMap.get(partner.name);
  if (!partnerStatus) return false;

  // 检查搭档是否有空（null 表示空闲）
  const subtitlerSlots = partner.schedule[date];
  if (!subtitlerSlots || subtitlerSlots[subtitlerTimeSlot] !== null) {
    return false;
  }

  // 检查搭档是否被使用
  const slotKey = `${date}|${subtitlerTimeSlot}`;
  if (partnerStatus.usedSlots.has(slotKey)) {
    return false;
  }

  return true;
}

export type AutoScheduleSkipReason =
  | 'time_unmapped'
  | 'cinema_unknown'
  | 'no_district_staff'
  | 'slot_unavailable'
  | 'only_one_available';

export interface AutoScheduleFailure {
  key: string;
  label: string;
  reason: AutoScheduleSkipReason;
  detail: string;
}

export interface AutoScheduleReport {
  assigned: number;
  total: number;
  failures: AutoScheduleFailure[];
}

const SKIP_REASON_LABELS: Record<AutoScheduleSkipReason, string> = {
  time_unmapped: '影片时间无法映射到字幕员时段',
  cinema_unknown: '影院未识别所属行政区',
  no_district_staff: '该区域无负责字幕员或全员不可用',
  slot_unavailable: '该时段无空闲字幕员',
  only_one_available: '仅找到一名可用字幕员（缺搭档）',
};

function cellLabel(cell: ScheduleCell): string {
  return `${cell.date} ${cell.cinema} ${cell.hall} ${cell.timeSlot}《${cell.movieName}》`;
}

// 为单个电影分配字幕员
function assignSubtitleForMovie(
  cell: ScheduleCell,
  subtitlerStatuses: Map<string, SubtitlerStatus>,
  constraints: ScheduleConstraints
): { assignment: ScheduleAssignment; success: boolean; reason?: AutoScheduleSkipReason; detail?: string } {
  const { date: movieDate, cinema, hall, timeSlot: movieTimeSlot } = cell;
  const slotKey = getUniqueSlot(movieDate, cinema, hall, movieTimeSlot);
  
  // 将影片时间转换为字幕员时间
  const subtitlerTimeSlot = getSubtitlerTimeSlot(movieTimeSlot);
  if (!subtitlerTimeSlot) {
    console.warn(`无法将影片时间 ${movieTimeSlot} 转换为字幕员时间`);
    return {
      assignment: { subtitler1: null, subtitler2: null, subtitler1Id: null, subtitler2Id: null },
      success: false,
      reason: 'time_unmapped',
      detail: `影片时间 ${movieTimeSlot} 不在映射表中`,
    };
  }
  
  // 将影片日期转换为字幕员表日期格式
  const subtitlerDate = convertToSubtitlerDate(movieDate);
  
  // 获取该影院所属区域
  const districtFull = getCinemaDistrict(cinema);
  if (!districtFull) {
    console.warn(`无法找到影院 ${cinema} 所属区域`);
    return {
      assignment: { subtitler1: null, subtitler2: null, subtitler1Id: null, subtitler2Id: null },
      success: false,
      reason: 'cinema_unknown',
      detail: `影院「${cinema}」未在区域映射表中`,
    };
  }
  const districtShort = toShortDistrictName(districtFull);

  // 找出在该区域有空的所有字幕员
  const availableSubtitlers: { status: SubtitlerStatus; timeSlotCount: number }[] = [];
  
  subtitlerStatuses.forEach((status) => {
    // 检查字幕员是否负责这个区域
    const districtValue = status.row.districts[districtShort];
    if (!districtValue) return; // 不负责此区域

    // 检查该时间段是否可用（使用字幕员时间和字幕员日期）
    if (!isSubtitlerAvailable(status, subtitlerDate, subtitlerTimeSlot, constraints)) {
      console.log(`[DEBUG] 字幕员 ${status.row.name} 在 ${subtitlerDate} ${subtitlerTimeSlot} 不可用`);
      return;
    }

    // 计算该字幕员当天的时间块数量
    const daySchedule = status.row.schedule[subtitlerDate];
    const availableDates = Object.keys(status.row.schedule);
    const timeSlotCount = daySchedule 
      ? Object.values(daySchedule).filter(v => v !== null).length 
      : 0;
    
    console.log(`[DEBUG] 字幕员 ${status.row.name}: 日期 ${subtitlerDate} 的 schedule 存在=${!!daySchedule}, 可用时间段=${timeSlotCount}, 所有日期=${availableDates.join(',')}`);

    availableSubtitlers.push({ status, timeSlotCount });
  });

  // 按优先级排序
  if (constraints.preferMoreTimeSlots) {
    // 优先使用时间块多的（实际是剩余可用时间块少的优先）
    availableSubtitlers.sort((a, b) => a.timeSlotCount - b.timeSlotCount);
  } else {
    // 随机排序
    availableSubtitlers.sort(() => Math.random() - 0.5);
  }

  // 分配字幕员1
  let subtitler1: SubtitlerRow | null = null;
  let subtitler2: SubtitlerRow | null = null;

  if (availableSubtitlers.length > 0) {
    const selected = availableSubtitlers[0];
    subtitler1 = selected.status.row;
    
    // 标记该字幕员已使用
    const slotKeyUsed = `${subtitlerDate}|${subtitlerTimeSlot}`;
    selected.status.usedSlots.add(slotKeyUsed);
    selected.status.dailyCount[subtitlerDate] = (selected.status.dailyCount[subtitlerDate] || 0) + 1;
    selected.status.totalCount += 1;

    // 检查搭档
    if (subtitler1?.partner) {
      // 找到搭档的原始数据
      const partnerStatus = Array.from(subtitlerStatuses.values()).find(s => s.row.name === subtitler1.partner);
      if (partnerStatus && isPartnerAvailable(partnerStatus.row, subtitlerDate, subtitlerTimeSlot, constraints, subtitlerStatuses)) {
        subtitler2 = partnerStatus.row;
        // 标记搭档已使用
        const partnerSlotKey = `${subtitlerDate}|${subtitlerTimeSlot}`;
        partnerStatus.usedSlots.add(partnerSlotKey);
        partnerStatus.dailyCount[subtitlerDate] = (partnerStatus.dailyCount[subtitlerDate] || 0) + 1;
        partnerStatus.totalCount += 1;
      }
    }

    // 如果没有搭档，尝试找另一个可用的字幕员
    if (!subtitler2 && availableSubtitlers.length > 1) {
      for (let i = 1; i < availableSubtitlers.length; i++) {
        const second = availableSubtitlers[i];
        const secondSlotKey = `${subtitlerDate}|${subtitlerTimeSlot}`;
        
        if (!second.status.usedSlots.has(secondSlotKey)) {
          subtitler2 = second.status.row;
          second.status.usedSlots.add(secondSlotKey);
          second.status.dailyCount[subtitlerDate] = (second.status.dailyCount[subtitlerDate] || 0) + 1;
          second.status.totalCount += 1;
          break;
        }
      }
    }
  }

  const success = subtitler1 !== null && subtitler2 !== null;

  if (!success) {
    let reason: AutoScheduleSkipReason = 'slot_unavailable';
    let detail = '该时段没有满足约束的空闲字幕员';
    if (availableSubtitlers.length === 0) {
      const hasDistrictStaff = Array.from(subtitlerStatuses.values()).some(
        s => !!s.row.districts[districtShort]
      );
      reason = hasDistrictStaff ? 'slot_unavailable' : 'no_district_staff';
      detail = hasDistrictStaff
        ? `${subtitlerDate} ${subtitlerTimeSlot} 无可用字幕员（已满/被占用/时间表无空）`
        : `「${districtShort}」区域没有负责的字幕员`;
    } else if (subtitler1 && !subtitler2) {
      reason = 'only_one_available';
      detail = `仅 ${subtitler1.name} 可用，搭档或第二字幕员不可用`;
    }
    return {
      assignment: {
        subtitler1: subtitler1?.name || null,
        subtitler2: subtitler2?.name || null,
        subtitler1Id: subtitler1?.id || null,
        subtitler2Id: subtitler2?.id || null,
      },
      success: false,
      reason,
      detail,
    };
  }

  return {
    assignment: {
      subtitler1: subtitler1?.name || null,
      subtitler2: subtitler2?.name || null,
      subtitler1Id: subtitler1?.id || null,
      subtitler2Id: subtitler2?.id || null,
    },
    success,
  };
}

// 计算单个影院的方案评分
function calculateCinemaScore(
  cells: ScheduleCell[],
  assignments: Map<string, ScheduleAssignment>
): { changeCount: number; changePersonCount: number } {
  // 按时间和影厅分组统计
  const personHalls: Record<string, { hall: string; date: string; timeSlot: string }[]> = {};
  
  cells.forEach(cell => {
    const key = getUniqueSlot(cell.date, cell.cinema, cell.hall, cell.timeSlot);
    const assignment = assignments.get(key);
    
    if (assignment?.subtitler1) {
      if (!personHalls[assignment.subtitler1]) {
        personHalls[assignment.subtitler1] = [];
      }
      personHalls[assignment.subtitler1].push({
        hall: cell.hall,
        date: cell.date,
        timeSlot: cell.timeSlot
      });
    }
    
    if (assignment?.subtitler2) {
      if (!personHalls[assignment.subtitler2]) {
        personHalls[assignment.subtitler2] = [];
      }
      personHalls[assignment.subtitler2].push({
        hall: cell.hall,
        date: cell.date,
        timeSlot: cell.timeSlot
      });
    }
  });

  let totalChangeCount = 0;
  let totalChangePersonCount = 0;

  // 对每个人计算换厅次数
  Object.values(personHalls).forEach(sessions => {
    sessions.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.timeSlot.localeCompare(b.timeSlot);
    });

    let lastHall = '';
    let personChangeCount = 0;
    sessions.forEach(session => {
      if (lastHall && lastHall !== session.hall) {
        personChangeCount++;
      }
      lastHall = session.hall;
    });

    totalChangeCount += personChangeCount;
    if (personChangeCount > 0) {
      totalChangePersonCount++;
    }
  });

  return { changeCount: totalChangeCount, changePersonCount: totalChangePersonCount };
}

export function formatSkipReason(reason: AutoScheduleSkipReason): string {
  return SKIP_REASON_LABELS[reason];
}

// 主自动排班函数
export function autoSchedule(
  scheduleTable: ScheduleTable,
  subtitlerData: ParsedSchedule | null,
  manualAssignments: Map<string, ScheduleAssignment>
): Map<string, ScheduleAssignment> {
  return autoScheduleWithReport(scheduleTable, subtitlerData, manualAssignments).assignments;
}

export function autoScheduleWithReport(
  scheduleTable: ScheduleTable,
  subtitlerData: ParsedSchedule | null,
  manualAssignments: Map<string, ScheduleAssignment>
): { assignments: Map<string, ScheduleAssignment>; report: AutoScheduleReport } {
  const constraints = loadConstraints();
  const districtPriority = loadDistrictPriority();
  const result = new Map<string, ScheduleAssignment>();
  const failures: AutoScheduleFailure[] = [];

  // 复制手动分配的排班
  manualAssignments.forEach((assignment, key) => {
    result.set(key, assignment);
  });

  if (!subtitlerData || subtitlerData.rows.length === 0) {
    console.warn('没有字幕员数据');
    return {
      assignments: result,
      report: { assigned: 0, total: scheduleTable.cells.length, failures: [] },
    };
  }

  console.log(`[DEBUG] 字幕员数据: ${subtitlerData.rows.length} 人, 日期: ${subtitlerData.dates.join(', ')}`);
  
  // 初始化字幕员状态
  const subtitlerStatuses = new Map<string, SubtitlerStatus>();
  subtitlerData.rows.forEach(row => {
    subtitlerStatuses.set(row.name, {
      row,
      dailyCount: {},
      totalCount: 0,
      usedSlots: new Set(),
      manualAssignedSlots: new Set(),
    });
  });
  
  // 检查20日是否有字幕员数据
  const hasDate20 = subtitlerData.dates.some(d => d.includes('20日') || d.includes('20'));
  console.log(`[DEBUG] 字幕员表中是否有20日数据: ${hasDate20}`);

  // 记录手动分配的时段
  manualAssignments.forEach((assignment, key) => {
    const [date, cinema, hall, movieTimeSlot] = key.split('|');
    // 将影片日期转换为字幕员表日期格式
    const subtitlerDate = convertToSubtitlerDate(date);
    // 将影片时间转换为字幕员时间
    const subtitlerTimeSlot = getSubtitlerTimeSlot(movieTimeSlot);
    const slotKey = `${subtitlerDate}|${subtitlerTimeSlot || movieTimeSlot}`;
    
    if (assignment.subtitler1) {
      const status = subtitlerStatuses.get(assignment.subtitler1);
      if (status) {
        status.usedSlots.add(slotKey);
        status.manualAssignedSlots.add(slotKey);
        status.dailyCount[subtitlerDate] = (status.dailyCount[subtitlerDate] || 0) + 1;
        status.totalCount += 1;
      }
    }
    if (assignment.subtitler2) {
      const status = subtitlerStatuses.get(assignment.subtitler2);
      if (status) {
        status.usedSlots.add(slotKey);
        status.manualAssignedSlots.add(slotKey);
        status.dailyCount[subtitlerDate] = (status.dailyCount[subtitlerDate] || 0) + 1;
        status.totalCount += 1;
      }
    }
  });

  // 按行政区优先级分组cells
  const cellsByDistrict = new Map<string, ScheduleCell[]>();
  let unmatchedCinemas = new Set<string>();
  scheduleTable.cells.forEach(cell => {
    const districtFull = getCinemaDistrict(cell.cinema);
    console.log(`[DEBUG] 影院: "${cell.cinema}" -> 区域: ${districtFull}, 日期: ${cell.date}`);
    if (districtFull) {
      const districtShort = toShortDistrictName(districtFull);
      if (!cellsByDistrict.has(districtShort)) {
        cellsByDistrict.set(districtShort, []);
      }
      cellsByDistrict.get(districtShort)!.push(cell);
    } else {
      unmatchedCinemas.add(cell.cinema);
    }
  });
  if (unmatchedCinemas.size > 0) {
    console.warn(`[DEBUG] 未匹配到区域的影院:`, Array.from(unmatchedCinemas));
  }
  
  console.log(`[DEBUG] 各区域场次数:`, 
    Array.from(cellsByDistrict.entries()).map(([d, cells]) => `${d}: ${cells.length}`).join(', '));

  // 按优先级处理每个行政区
  districtPriority.forEach(district => {
    const districtCells = cellsByDistrict.get(district);
    if (!districtCells || districtCells.length === 0) return;

    // 按影院分组
    const cellsByCinema = new Map<string, ScheduleCell[]>();
    districtCells.forEach(cell => {
      if (!cellsByCinema.has(cell.cinema)) {
        cellsByCinema.set(cell.cinema, []);
      }
      cellsByCinema.get(cell.cinema)!.push(cell);
    });

    // 为每个影院分配字幕员
    cellsByCinema.forEach((cinemaCells, cinema) => {
      cinemaCells.forEach(cell => {
        const key = getUniqueSlot(cell.date, cell.cinema, cell.hall, cell.timeSlot);
        
        // 跳过已手动分配的
        if (result.has(key)) return;

        const { assignment, success, reason, detail } = assignSubtitleForMovie(
          cell,
          subtitlerStatuses,
          constraints
        );

        result.set(key, assignment);

        if (!success && reason) {
          failures.push({
            key,
            label: cellLabel(cell),
            reason,
            detail: detail || formatSkipReason(reason),
          });
        }

        // 如果分配成功，也标记搭档已使用
        if (success && assignment.subtitler2) {
          const partnerStatus = subtitlerStatuses.get(assignment.subtitler2);
          if (partnerStatus) {
            // 标记搭档已使用（使用字幕员时间和字幕员日期）
            const slotDate = convertToSubtitlerDate(cell.date);
            const slotTime = getSubtitlerTimeSlot(cell.timeSlot) || cell.timeSlot;
            partnerStatus.usedSlots.add(`${slotDate}|${slotTime}`);
            partnerStatus.dailyCount[slotDate] = (partnerStatus.dailyCount[slotDate] || 0) + 1;
            partnerStatus.totalCount += 1;
          }
        }
      });
    });
  });

  const assigned = Array.from(result.values()).filter(
    a => a.subtitler1 && a.subtitler2
  ).length;

  return {
    assignments: result,
    report: {
      assigned,
      total: scheduleTable.cells.length,
      failures,
    },
  };
}

// 检查是否所有电影都已分配
export function checkAllAssigned(
  scheduleTable: ScheduleTable,
  assignments: Map<string, ScheduleAssignment>
): { total: number; assigned: number; unassigned: string[] } {
  let assigned = 0;
  const unassigned: string[] = [];

  scheduleTable.cells.forEach(cell => {
    const key = getUniqueSlot(cell.date, cell.cinema, cell.hall, cell.timeSlot);
    const assignment = assignments.get(key);

    if (assignment && assignment.subtitler1 && assignment.subtitler2) {
      assigned++;
    } else {
      unassigned.push(`${cell.date} ${cell.cinema} ${cell.hall} ${cell.timeSlot}`);
    }
  });

  return {
    total: scheduleTable.cells.length,
    assigned,
    unassigned
  };
}
