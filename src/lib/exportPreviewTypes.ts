export interface ExportPreviewSheet {
  name: string;
  rows: string[][];
  /** 数据行索引（不含表头，从 0 起）用于预览中标记未识别区域 */
  mutedRowIndices?: number[];
}

export interface ExportPreviewPayload {
  title: string;
  fileName: string;
  sheets: ExportPreviewSheet[];
  download: () => void;
}
