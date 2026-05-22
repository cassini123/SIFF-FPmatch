import {
  AutoScheduleReport,
  formatSkipReason,
} from '@/lib/autoSchedule';

interface AutoScheduleReportPanelProps {
  report: AutoScheduleReport;
  onClose: () => void;
}

export default function AutoScheduleReportPanel({
  report,
  onClose,
}: AutoScheduleReportPanelProps) {
  const incomplete = report.total - report.assigned;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-gray-800">
      <div className="flex justify-between items-start gap-4 mb-3">
        <div>
          <h4 className="font-semibold text-[#2B3A67]">自动排班结果</h4>
          <p className="mt-1 text-gray-600">
            已配齐 <strong>{report.assigned}</strong> / {report.total} 场
            {incomplete > 0 && (
              <span className="text-amber-800"> · 未配齐 {incomplete} 场</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 shrink-0"
          aria-label="关闭报告"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      {report.failures.length > 0 ? (
        <div className="max-h-56 overflow-y-auto space-y-2">
          {report.failures.map(f => (
            <div
              key={f.key}
              className="rounded bg-white/80 px-3 py-2 border border-amber-100"
            >
              <div className="font-medium text-gray-800 truncate" title={f.label}>
                {f.label}
              </div>
              <div className="text-xs text-amber-900 mt-0.5">
                {formatSkipReason(f.reason)} — {f.detail}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">全部场次均已配齐两位字幕员。</p>
      )}
    </div>
  );
}
