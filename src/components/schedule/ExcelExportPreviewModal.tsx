import { useMemo, useState } from 'react';
import { ExportPreviewPayload } from '@/lib/exportPreviewTypes';
import { cn } from '@/lib/utils';

interface ExcelExportPreviewModalProps {
  preview: ExportPreviewPayload;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ExcelExportPreviewModal({
  preview,
  onClose,
  onConfirm,
}: ExcelExportPreviewModalProps) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  const activeSheet = preview.sheets[activeSheetIndex] ?? preview.sheets[0];
  const headerRow = activeSheet?.rows[0] ?? [];
  const dataRows = activeSheet?.rows.slice(1) ?? [];

  const mutedRows = useMemo(
    () => new Set(activeSheet?.mutedRowIndices ?? []),
    [activeSheet]
  );

  const totalRows = preview.sheets.reduce((sum, sheet) => sum + Math.max(0, sheet.rows.length - 1), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{preview.title}</h3>
            <p className="text-sm text-gray-500 mt-1">
              文件名：{preview.fileName} · 共 {preview.sheets.length} 个工作表 · {totalRows} 行数据
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

        {preview.sheets.length > 1 && (
          <div className="flex gap-2 px-5 py-3 border-b border-gray-100 overflow-x-auto shrink-0">
            {preview.sheets.map((sheet, index) => (
              <button
                key={sheet.name}
                type="button"
                onClick={() => setActiveSheetIndex(index)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors',
                  activeSheetIndex === index
                    ? 'bg-[#2B3A67] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {sheet.name}
                <span className="ml-1 text-xs opacity-80">
                  ({Math.max(0, sheet.rows.length - 1)})
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto p-5 min-h-0">
          <div className="border border-gray-200 rounded-lg overflow-auto max-h-[calc(90vh-220px)]">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100">
                <tr>
                  {headerRow.map((cell, colIdx) => (
                    <th
                      key={`${colIdx}-${cell}`}
                      className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(headerRow.length, 1)}
                      className="border border-gray-300 px-4 py-8 text-center text-gray-500"
                    >
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  dataRows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={cn(
                        mutedRows.has(rowIdx) ? 'bg-gray-500 text-white' : 'bg-white text-gray-800'
                      )}
                    >
                      {headerRow.map((_, colIdx) => (
                        <td
                          key={colIdx}
                          className="border border-gray-300 px-3 py-2 whitespace-nowrap max-w-[240px] truncate"
                          title={row[colIdx] ?? ''}
                        >
                          {row[colIdx] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            <i className="fa-solid fa-file-export mr-1" />
            确认导出
          </button>
        </div>
      </div>
    </div>
  );
}
