/**
 * 验证问卷格子语义：填时间=有空，空白=没空
 * 运行: pnpm dlx tsx scripts/verify-slot-availability.ts
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  isSubtitlerSlotMarkedAvailable,
  convertToSubtitlerDate,
} from '../src/lib/scheduleHelpers.ts';
import { parseSubtitlerExcelFromFile } from '../src/lib/parseSubtitlerExcel.ts';
import { parseScheduleTableFromFile } from '../src/lib/parseScheduleTable.ts';
import { buildScheduleTableFromParsedData } from '../src/lib/buildScheduleViewData.ts';
import { autoScheduleWithReport } from '../src/lib/autoSchedule.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fileFromPath(path: string, name: string): File {
  const buf = readFileSync(path);
  return new File([buf], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// autoSchedule 读取 localStorage
const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => {
    storage.set(k, v);
  },
  removeItem: (k: string) => {
    storage.delete(k);
  },
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
};

async function main() {
  const subtitlerFile = fileFromPath(
    resolve(root, 'assets/2026前五天问卷清洗版.xlsx'),
    '2026前五天问卷清洗版.xlsx'
  );
  const scheduleFile = fileFromPath(
    resolve(root, 'assets/26排片表清洗版.xlsx'),
    '26排片表清洗版.xlsx'
  );

  const subtitlerData = await parseSubtitlerExcelFromFile(subtitlerFile);
  const scheduleData = await parseScheduleTableFromFile(scheduleFile);
  const scheduleTable = buildScheduleTableFromParsedData(scheduleData);

  const chenMeng = subtitlerData.rows.find(r => r.name === '陈梦');
  const caiHuihao = subtitlerData.rows.find(r => r.name === '蔡惠好');

  if (!chenMeng || !caiHuihao) {
    throw new Error('未找到陈梦或蔡惠好');
  }

  const day12 = '12日';
  const slots = Object.keys(chenMeng.schedule[day12] ?? {});

  console.log('--- 单元：陈梦 12日 可用性 ---');
  for (const slot of slots) {
    const avail = isSubtitlerSlotMarkedAvailable(chenMeng.schedule[day12], slot);
    console.log(`  ${slot}: ${avail ? '有空' : '没空'}`);
  }

  console.log('--- 单元：蔡惠好 12日 可用性 ---');
  for (const slot of slots) {
    const avail = isSubtitlerSlotMarkedAvailable(caiHuihao.schedule[day12], slot);
    console.log(`  ${slot}: ${avail ? '有空' : '没空'}`);
  }

  const { assignments, report } = autoScheduleWithReport(
    scheduleTable,
    subtitlerData,
    new Map()
  );

  function countAssignments(name: string, datePrefix?: string) {
    let count = 0;
    const details: string[] = [];
    for (const cell of scheduleTable.cells) {
      const key = `${cell.date}|${cell.cinema}|${cell.hall}|${cell.timeSlot}`;
      const a = assignments.get(key);
      if (!a) continue;
      const onDate =
        !datePrefix ||
        convertToSubtitlerDate(cell.date) === datePrefix ||
        cell.date.includes(datePrefix.replace('日', ''));
      if (!onDate) continue;
      if (a.subtitler1 === name || a.subtitler2 === name) {
        count++;
        details.push(`${cell.date} ${cell.timeSlot} ${cell.cinema}`);
      }
    }
    return { count, details };
  }

  const chen12 = countAssignments('陈梦', '12日');
  const caiAll = countAssignments('蔡惠好');

  console.log('\n--- 自动排班结果 ---');
  console.log(`总场次: ${report.total}, 成功分配: ${report.assigned}, 失败: ${report.failures.length}`);
  console.log(`陈梦 12日 排班场次: ${chen12.count}`);
  if (chen12.details.length) console.log('  ', chen12.details.join('\n   '));
  console.log(`蔡惠好 全部排班场次: ${caiAll.count}`);

  let ok = true;
  if (chen12.count !== 0) {
    console.error('FAIL: 陈梦 12日 不应被排班');
    ok = false;
  }
  if (caiAll.count === 0) {
    console.error('FAIL: 蔡惠好 应有排班');
    ok = false;
  }
  if (!slots.every(s => !isSubtitlerSlotMarkedAvailable(chenMeng.schedule[day12], s))) {
    console.error('FAIL: 陈梦 12日 应全部不可用');
    ok = false;
  }
  if (!isSubtitlerSlotMarkedAvailable(caiHuihao.schedule[day12], '13:00')) {
    console.error('FAIL: 蔡惠好 12日 13:00 应可用');
    ok = false;
  }

  if (ok) {
    console.log('\nPASS: 问卷语义与排班结果符合预期');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
