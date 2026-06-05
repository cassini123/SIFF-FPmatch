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
  ScheduleConstraints,
  DEFAULT_CONSTRAINTS,
  getCinemaDistrict,
  toShortDistrictName,
} from '@/lib/scheduleConstants';
import {
  convertToSubtitlerDate,
  countMarkedAvailableSlots,
  getSubtitlerTimeSlot,
  isSubtitlerSlotMarkedAvailable,
} from '@/lib/scheduleHelpers';

// 从LocalStorage加载设置
function loadConstraints(): ScheduleConstraints {
  try {
    const saved = localStorage.getItem('settings_constraints');
    if (saved) {
      return { ...DEFAULT_CONSTRAINTS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('加载约束失败:', e);
  }
  return { ...DEFAULT_CONSTRAINTS };
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
  dailyCinema: Record<string, string>; // 每天已锁定的影院
  totalCount: number; // 总场次
  usedSlots: Set<string>; // 已使用的时间段 (格式: date|timeSlot)
  manualAssignedSlots: Set<string>; // 手动分配的时段
}

function lockDailyCinema(
  status: SubtitlerStatus,
  date: string,
  cinema: string,
  constraints: ScheduleConstraints
): void {
  if (!constraints.noCrossCinemaPerDay) return;
  if (!status.dailyCinema[date]) {
    status.dailyCinema[date] = cinema;
  }
}

function isSameDayCinemaAllowed(
  status: SubtitlerStatus,
  date: string,
  cinema: string,
  constraints: ScheduleConstraints
): boolean {
  if (!constraints.noCrossCinemaPerDay) return true;
  const lockedCinema = status.dailyCinema[date];
  return !lockedCinema || lockedCinema === cinema;
}

// 影院-影厅-时间 唯一标识
function getUniqueSlot(date: string, cinema: string, hall: string, timeSlot: string): string {
  return `${date}|${cinema}|${hall}|${timeSlot}`;
}

// 检查字幕员在指定时间是否可用
function isSubtitlerAvailable(
  status: SubtitlerStatus,
  date: string,
  cinema: string,
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

  // 同日禁止跨影院（允许跨影厅）
  if (!isSameDayCinemaAllowed(status, date, cinema, _constraints)) {
    return false;
  }

  // 检查同一时间段是否已在其他地方使用（互斥规则）
  const slotKey = `${date}|${subtitlerTimeSlot}`;
  if (_constraints.exclusiveTimeSlot && status.usedSlots.has(slotKey)) {
    return false;
  }

  // 检查问卷是否标记该时段有空（绿色格子 = 填了时间）
  const subtitlerSlots = status.row.schedule[date];
  if (!isSubtitlerSlotMarkedAvailable(subtitlerSlots, subtitlerTimeSlot)) {
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
  cinema: string,
  subtitlerTimeSlot: string,
  constraints: ScheduleConstraints,
  statusMap: Map<string, SubtitlerStatus>
): boolean {
  const partnerStatus = statusMap.get(partner.name);
  if (!partnerStatus) return false;

  // 检查搭档问卷是否标记该时段有空
  const subtitlerSlots = partner.schedule[date];
  if (!isSubtitlerSlotMarkedAvailable(subtitlerSlots, subtitlerTimeSlot)) {
    return false;
  }

  if (!isSameDayCinemaAllowed(partnerStatus, date, cinema, constraints)) {
    return false;
  }

  // 检查搭档是否被使用
  const slotKey = `${date}|${subtitlerTimeSlot}`;
  if (constraints.exclusiveTimeSlot && partnerStatus.usedSlots.has(slotKey)) {
    return false;
  }

  return true;
}

export type AutoScheduleSkipReason =
  | 'time_unmapped'
  | 'cinema_unknown'
  | 'no_district_staff'
  | 'slot_unavailable'
  | 'only_one_available'
  | 'partner_unavailable';

export interface AutoScheduleFailure {
  key: string;
  label: string;
  reason: AutoScheduleSkipReason;
  detail: string;
}

export interface PartnerAssignmentEntry {
  date: string;
  cinema: string;
  hall: string;
  timeSlot: string;
  movieCode: string;
  movieName: string;
}

export interface PartnerPairLog {
  person1: string;
  person2: string;
  entries: PartnerAssignmentEntry[];
}

export interface AutoScheduleReport {
  assigned: number;
  total: number;
  failures: AutoScheduleFailure[];
  partnerLogs: PartnerPairLog[];
  partnerWarnings: string[];
}

const SKIP_REASON_LABELS: Record<AutoScheduleSkipReason, string> = {
  time_unmapped: '影片时间无法映射到字幕员时段',
  cinema_unknown: '影院未识别所属行政区',
  no_district_staff: '该区域无负责字幕员或全员不可用',
  slot_unavailable: '该时段无空闲字幕员',
  only_one_available: '仅找到一名可用字幕员（缺搭档）',
  partner_unavailable: '搭档不可用或未双向绑定，无法拆组排班',
};

function cellLabel(cell: ScheduleCell): string {
  const codePrefix = cell.movieCode ? `[${cell.movieCode}] ` : '';
  return `${cell.date} ${cell.cinema} ${cell.hall} ${cell.timeSlot} ${codePrefix}《${cell.movieName}》`;
}

function buildBidirectionalPartnerMap(rows: SubtitlerRow[]): {
  partnerOf: Map<string, string>;
  warnings: string[];
} {
  const raw = new Map<string, string>();
  const warnings: string[] = [];

  rows.forEach(row => {
    if (row.partner?.trim()) {
      raw.set(row.name, row.partner.trim());
    }
  });

  const partnerOf = new Map<string, string>();
  raw.forEach((partner, name) => {
    if (raw.get(partner) === name) {
      partnerOf.set(name, partner);
    } else if (raw.has(partner)) {
      warnings.push(`「${name}」与「${partner}」的搭档关系不是双向绑定，排班时将视为无搭档`);
    }
  });

  return { partnerOf, warnings };
}

function getPartnerPairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

interface SubtitlerCandidate {
  status: SubtitlerStatus;
  timeSlotCount: number;
}

function sortCandidates(
  candidates: SubtitlerCandidate[],
  constraints: ScheduleConstraints
): void {
  if (constraints.preferMoreTimeSlots) {
    candidates.sort((a, b) => b.timeSlotCount - a.timeSlotCount);
    return;
  }
  if (constraints.preferFewerTimeSlots) {
    candidates.sort((a, b) => a.timeSlotCount - b.timeSlotCount);
    return;
  }
  candidates.sort(() => Math.random() - 0.5);
}

function markSubtitlerUsed(
  status: SubtitlerStatus,
  subtitlerDate: string,
  subtitlerTimeSlot: string,
  cinema: string,
  constraints: ScheduleConstraints
): void {
  const slotKeyUsed = `${subtitlerDate}|${subtitlerTimeSlot}`;
  status.usedSlots.add(slotKeyUsed);
  status.dailyCount[subtitlerDate] = (status.dailyCount[subtitlerDate] || 0) + 1;
  status.totalCount += 1;
  lockDailyCinema(status, subtitlerDate, cinema, constraints);
}

function appendPartnerLog(
  partnerLogs: Map<string, PartnerPairLog>,
  person1: string,
  person2: string,
  cell: ScheduleCell
): void {
  const pairKey = getPartnerPairKey(person1, person2);
  const [p1, p2] = [person1, person2].sort();
  const existing = partnerLogs.get(pairKey) ?? { person1: p1, person2: p2, entries: [] };
  existing.entries.push({
    date: cell.date,
    cinema: cell.cinema,
    hall: cell.hall,
    timeSlot: cell.timeSlot,
    movieCode: cell.movieCode,
    movieName: cell.movieName,
  });
  partnerLogs.set(pairKey, existing);
}

// 为单个电影分配字幕员
function assignSubtitleForMovie(
  cell: ScheduleCell,
  subtitlerStatuses: Map<string, SubtitlerStatus>,
  constraints: ScheduleConstraints,
  partnerOf: Map<string, string>,
  partnerLogs: Map<string, PartnerPairLog>
): { assignment: ScheduleAssignment; success: boolean; reason?: AutoScheduleSkipReason; detail?: string } {
  const { date: movieDate, cinema, timeSlot: movieTimeSlot } = cell;
  
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
  
  const subtitlerDate = convertToSubtitlerDate(movieDate);
  
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

  const availableSubtitlers: SubtitlerCandidate[] = [];
  
  subtitlerStatuses.forEach((status) => {
    const districtValue = status.row.districts[districtShort];
    if (!districtValue) return;

    if (!isSubtitlerAvailable(status, subtitlerDate, cinema, subtitlerTimeSlot, constraints)) {
      return;
    }

    const daySchedule = status.row.schedule[subtitlerDate];
    const timeSlotCount = countMarkedAvailableSlots(daySchedule);
    availableSubtitlers.push({ status, timeSlotCount });
  });

  const partnerName = (name: string) => partnerOf.get(name) ?? null;

  const isPartnerPairAvailable = (_a: SubtitlerCandidate, b: SubtitlerCandidate): boolean => {
    return (
      isPartnerAvailable(b.status.row, subtitlerDate, cinema, subtitlerTimeSlot, constraints, subtitlerStatuses) &&
      isSubtitlerAvailable(b.status, subtitlerDate, cinema, subtitlerTimeSlot, constraints)
    );
  };

  // 有双向搭档者：必须与搭档同场，搭档不可用则本人也不可作为首选
  const validCandidates = availableSubtitlers.filter(c => {
    const partner = partnerName(c.status.row.name);
    if (!partner) return true;
    const partnerStatus = subtitlerStatuses.get(partner);
    if (!partnerStatus) return false;
    const partnerCandidate: SubtitlerCandidate = {
      status: partnerStatus,
      timeSlotCount: countMarkedAvailableSlots(partnerStatus.row.schedule[subtitlerDate]),
    };
    return isPartnerPairAvailable(c, partnerCandidate);
  });

  const soloCandidates = validCandidates.filter(c => !partnerName(c.status.row.name));
  sortCandidates(soloCandidates, constraints);

  const partnerPairCandidates: { a: SubtitlerCandidate; b: SubtitlerCandidate; score: number }[] = [];
  const seenPairs = new Set<string>();

  validCandidates.forEach(c => {
    const partner = partnerName(c.status.row.name);
    if (!partner) return;
    const pairKey = getPartnerPairKey(c.status.row.name, partner);
    if (seenPairs.has(pairKey)) return;

    const partnerStatus = subtitlerStatuses.get(partner);
    if (!partnerStatus) return;

    const partnerCandidate: SubtitlerCandidate = {
      status: partnerStatus,
      timeSlotCount: countMarkedAvailableSlots(partnerStatus.row.schedule[subtitlerDate]),
    };

    if (!isPartnerPairAvailable(c, partnerCandidate)) return;

    seenPairs.add(pairKey);
    partnerPairCandidates.push({
      a: c,
      b: partnerCandidate,
      score: c.timeSlotCount + partnerCandidate.timeSlotCount,
    });
  });

  partnerPairCandidates.sort((x, y) => {
    if (constraints.preferMoreTimeSlots) return y.score - x.score;
    if (constraints.preferFewerTimeSlots) return x.score - y.score;
    return Math.random() - 0.5;
  });

  let subtitler1: SubtitlerRow | null = null;
  let subtitler2: SubtitlerRow | null = null;

  const commitPair = (first: SubtitlerCandidate, second: SubtitlerCandidate): { row1: SubtitlerRow; row2: SubtitlerRow } => {
    const row1 = first.status.row;
    const row2 = second.status.row;
    markSubtitlerUsed(first.status, subtitlerDate, subtitlerTimeSlot, cinema, constraints);
    markSubtitlerUsed(second.status, subtitlerDate, subtitlerTimeSlot, cinema, constraints);
    if (partnerName(row1.name) === row2.name) {
      appendPartnerLog(partnerLogs, row1.name, row2.name, cell);
    }
    return { row1, row2 };
  };

  if (partnerPairCandidates.length > 0) {
    const { a, b } = partnerPairCandidates[0];
    ({ row1: subtitler1, row2: subtitler2 } = commitPair(a, b));
  } else if (soloCandidates.length >= 2) {
    ({ row1: subtitler1, row2: subtitler2 } = commitPair(soloCandidates[0], soloCandidates[1]));
  } else if (soloCandidates.length === 1) {
    subtitler1 = soloCandidates[0].status.row;
    markSubtitlerUsed(soloCandidates[0].status, subtitlerDate, subtitlerTimeSlot, cinema, constraints);
  } else if (availableSubtitlers.length > 0) {
    const blocked = availableSubtitlers.filter(c => partnerName(c.status.row.name));
    if (blocked.length > 0) {
      const sample = blocked[0];
      const partner = partnerName(sample.status.row.name)!;
      return {
        assignment: {
          subtitler1: null,
          subtitler2: null,
          subtitler1Id: null,
          subtitler2Id: null,
        },
        success: false,
        reason: 'partner_unavailable',
        detail: `搭档 ${sample.status.row.name} 与 ${partner} 无法同场（一方不可用或未双向绑定）`,
      };
    }
  }

  if (subtitler1 && subtitler2) {
    return {
      assignment: {
        subtitler1: subtitler1.name,
        subtitler2: subtitler2.name,
        subtitler1Id: subtitler1.id,
        subtitler2Id: subtitler2.id,
      },
      success: true,
    };
  }

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
    detail = `仅 ${subtitler1.name} 可用，找不到第二名无搭档字幕员或搭档组`;
  } else if (availableSubtitlers.some(c => partnerName(c.status.row.name))) {
    reason = 'partner_unavailable';
    detail = '有搭档的字幕员必须与搭档同场，当前搭档组均不可用';
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
  if (constraints.preferMoreTimeSlots && constraints.preferFewerTimeSlots) {
    constraints.preferFewerTimeSlots = false;
  }
  const districtPriority = loadDistrictPriority();
  const result = new Map<string, ScheduleAssignment>();
  const failures: AutoScheduleFailure[] = [];
  const partnerLogs = new Map<string, PartnerPairLog>();
  let partnerWarnings: string[] = [];

  // 复制手动分配的排班
  manualAssignments.forEach((assignment, key) => {
    result.set(key, assignment);
  });

  if (!subtitlerData || subtitlerData.rows.length === 0) {
    console.warn('没有字幕员数据');
    return {
      assignments: result,
      report: { assigned: 0, total: scheduleTable.cells.length, failures: [], partnerLogs: [], partnerWarnings: [] },
    };
  }

  console.log(`[DEBUG] 字幕员数据: ${subtitlerData.rows.length} 人, 日期: ${subtitlerData.dates.join(', ')}`);
  
  // 初始化字幕员状态
  const subtitlerStatuses = new Map<string, SubtitlerStatus>();
  subtitlerData.rows.forEach(row => {
    subtitlerStatuses.set(row.name, {
      row,
      dailyCount: {},
      dailyCinema: {},
      totalCount: 0,
      usedSlots: new Set(),
      manualAssignedSlots: new Set(),
    });
  });
  
  const { partnerOf, warnings: partnerMapWarnings } = buildBidirectionalPartnerMap(subtitlerData.rows);
  partnerWarnings = partnerMapWarnings;

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
        lockDailyCinema(status, subtitlerDate, cinema, constraints);
      }
    }
    if (assignment.subtitler2) {
      const status = subtitlerStatuses.get(assignment.subtitler2);
      if (status) {
        status.usedSlots.add(slotKey);
        status.manualAssignedSlots.add(slotKey);
        status.dailyCount[subtitlerDate] = (status.dailyCount[subtitlerDate] || 0) + 1;
        status.totalCount += 1;
        lockDailyCinema(status, subtitlerDate, cinema, constraints);
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
          constraints,
          partnerOf,
          partnerLogs
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

      });
    });
  });

  // 未识别行政区的影院也要写入失败报告（否则静默丢失）
  scheduleTable.cells.forEach(cell => {
    if (getCinemaDistrict(cell.cinema)) return;
    const key = getUniqueSlot(cell.date, cell.cinema, cell.hall, cell.timeSlot);
    if (result.has(key)) return;

    const { assignment, success, reason, detail } = assignSubtitleForMovie(
      cell,
      subtitlerStatuses,
      constraints,
      partnerOf,
      partnerLogs
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
      partnerLogs: Array.from(partnerLogs.values()).sort((a, b) => a.person1.localeCompare(b.person1, 'zh-CN')),
      partnerWarnings,
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
