import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";

interface FileUploadProps {
  onSubtitlerUpload: (file: File) => void;
  onScheduleUpload: (file: File) => void;
  subtitlerFileName: string | null;
  scheduleFileName: string | null;
}

export default function FileUpload({ 
  onSubtitlerUpload, 
  onScheduleUpload,
  subtitlerFileName,
  scheduleFileName 
}: FileUploadProps) {
  const [activeTab, setActiveTab] = useState<'subtitler' | 'schedule'>('subtitler');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (activeTab === 'subtitler') {
        onSubtitlerUpload(file);
      } else {
        onScheduleUpload(file);
      }
    }
  }, [activeTab, onSubtitlerUpload, onScheduleUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/octet-stream': ['.xlsx', '.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    validator: (file) => {
      const name = file.name.toLowerCase();
      if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
        return null;
      }
      return { code: 'file-invalid-type', message: '请上传 .xlsx、.xls 或 .csv 文件' };
    }
  });

  return (
    <div className="space-y-4">
      {/* 标签切换 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('subtitler')}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors -mb-[1px]",
            activeTab === 'subtitler'
              ? "border-[#D4AF37] text-[#D4AF37]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <i className="fa-solid fa-users mr-2"></i>
          字幕员数据
          {subtitlerFileName && (
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              已上传
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors -mb-[1px]",
            activeTab === 'schedule'
              ? "border-[#D4AF37] text-[#D4AF37]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <i className="fa-solid fa-film mr-2"></i>
          电影排片表
          {scheduleFileName && (
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              已上传
            </span>
          )}
        </button>
      </div>

      {/* 上传区域 */}
      <div 
        {...getRootProps()} 
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-gray-300 hover:border-gray-400"
        )}
      >
        <input {...getInputProps()} />
        <i className="fa-solid fa-file-import text-4xl mb-2 text-[#2B3A67]"></i>
        <p className="mb-1">
          {isDragActive ? "释放文件进行上传" : "拖拽Excel/CSV文件到此处或点击选择"}
        </p>
        <p className="text-sm text-gray-500">
          {activeTab === 'subtitler' 
            ? "请上传字幕员时间表（包含姓名、区域、时间段等）" 
            : "请上传电影排片表（包含日期、场次、影院等信息）"}
        </p>
      </div>

      {/* 已上传文件状态 */}
      <div className="flex gap-4">
        <div className={cn(
          "flex-1 p-3 rounded-lg border",
          subtitlerFileName ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className={cn(
                "fa-solid mr-2",
                subtitlerFileName ? "fa-check-circle text-green-600" : "fa-users text-gray-400"
              )}></i>
              <span className="text-sm text-gray-600">字幕员数据</span>
            </div>
            {subtitlerFileName ? (
              <span className="text-xs text-green-600 truncate max-w-[150px]" title={subtitlerFileName}>
                {subtitlerFileName}
              </span>
            ) : (
              <span className="text-xs text-gray-400">未上传</span>
            )}
          </div>
        </div>
        
        <div className={cn(
          "flex-1 p-3 rounded-lg border",
          scheduleFileName ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className={cn(
                "fa-solid mr-2",
                scheduleFileName ? "fa-check-circle text-green-600" : "fa-film text-gray-400"
              )}></i>
              <span className="text-sm text-gray-600">电影排片表</span>
            </div>
            {scheduleFileName ? (
              <span className="text-xs text-green-600 truncate max-w-[150px]" title={scheduleFileName}>
                {scheduleFileName}
              </span>
            ) : (
              <span className="text-xs text-gray-400">未上传</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
