import { PartnerPairLog } from '@/lib/autoSchedule';

interface PartnerAssignmentLogPanelProps {
  partnerLogs: PartnerPairLog[];
  partnerWarnings: string[];
  onClose: () => void;
}

export default function PartnerAssignmentLogPanel({
  partnerLogs,
  partnerWarnings,
  onClose,
}: PartnerAssignmentLogPanelProps) {
  const totalAssignments = partnerLogs.reduce((sum, log) => sum + log.entries.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 p-4 sm:p-6">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-lg font-bold text-gray-800">搭档排班日志</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              共 {partnerLogs.length} 对搭档 · {totalAssignments} 场同组分配
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 shrink-0 p-1"
            aria-label="关闭"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {partnerWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
              <div className="font-medium">搭档关系提示</div>
              {partnerWarnings.map(w => (
                <div key={w} className="text-xs">{w}</div>
              ))}
            </div>
          )}

          {partnerLogs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              暂无搭档同组排班记录。请先在排班总表执行自动排班。
            </p>
          ) : (
            partnerLogs.map(log => (
              <div
                key={`${log.person1}|${log.person2}`}
                className="rounded-lg border border-gray-200 overflow-hidden"
              >
                <div className="bg-[#2B3A67] text-white px-3 py-2 font-medium text-sm flex items-center gap-2">
                  <i className="fa-solid fa-user-group text-[#D4AF37]" />
                  {log.person1} + {log.person2}
                  <span className="ml-auto text-xs text-white/70">{log.entries.length} 场</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {log.entries.map((entry, idx) => (
                    <li key={`${entry.date}-${entry.timeSlot}-${idx}`} className="px-3 py-2 text-sm">
                      <div className="font-medium text-gray-800">
                        {entry.movieCode && (
                          <span className="text-[#2B3A67] mr-1">[{entry.movieCode}]</span>
                        )}
                        {entry.movieName || '（未命名影片）'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {entry.date} · {entry.timeSlot} · {entry.cinema} · {entry.hall}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export const PARTNER_LOG_STORAGE_KEY = 'partner_assignment_log_v1';

export function loadPartnerAssignmentLog(): {
  partnerLogs: PartnerPairLog[];
  partnerWarnings: string[];
} | null {
  try {
    const raw = localStorage.getItem(PARTNER_LOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.partnerLogs)) return null;
    return {
      partnerLogs: parsed.partnerLogs,
      partnerWarnings: parsed.partnerWarnings ?? [],
    };
  } catch {
    return null;
  }
}

export function savePartnerAssignmentLog(
  partnerLogs: PartnerPairLog[],
  partnerWarnings: string[]
): void {
  try {
    localStorage.setItem(
      PARTNER_LOG_STORAGE_KEY,
      JSON.stringify({ partnerLogs, partnerWarnings, savedAt: Date.now() })
    );
  } catch (e) {
    console.error('保存搭档日志失败:', e);
  }
}
