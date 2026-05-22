import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ParsedSchedule } from '@/lib/parseSubtitlerExcel';

// 字幕员数据Context
interface SubtitlerContextType {
  subtitlerData: ParsedSchedule | null;
  setSubtitlerData: (data: ParsedSchedule | null) => void;
  uploadedFileName: string | null;
  setUploadedFileName: (name: string | null) => void;
}

const SubtitlerContext = createContext<SubtitlerContextType | undefined>(undefined);

// LocalStorage key
const STORAGE_KEY = 'subtitler_data_v2';
const FILE_NAME_KEY = 'subtitler_file_name';

export function SubtitlerProvider({ children }: { children: ReactNode }) {
  const [subtitlerData, setSubtitlerDataState] = useState<ParsedSchedule | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 从localStorage恢复数据
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      const savedFileName = localStorage.getItem(FILE_NAME_KEY);
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed?.rows?.length > 0) {
          setSubtitlerDataState(parsed);
        }
      }
      if (savedFileName) {
        setUploadedFileName(savedFileName);
      }
    } catch (e) {
      console.error('恢复字幕员数据失败:', e);
    }
    setIsInitialized(true);
  }, []);

  // 保存到localStorage
  const setSubtitlerData = (data: ParsedSchedule | null) => {
    setSubtitlerDataState(data);
    try {
      if (data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('保存字幕员数据失败:', e);
      if (typeof window !== 'undefined') {
        window.alert('字幕员数据保存到浏览器失败，刷新后可能丢失。请清理浏览器缓存后重试。');
      }
    }
  };

  const updateUploadedFileName = (name: string | null) => {
    setUploadedFileName(name);
    try {
      if (name) {
        localStorage.setItem(FILE_NAME_KEY, name);
      } else {
        localStorage.removeItem(FILE_NAME_KEY);
      }
    } catch (e) {
      console.error('保存文件名失败:', e);
    }
  };

  // 在初始化完成前不渲染children，避免闪烁
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2B3A67] text-white text-sm">
        加载字幕员数据…
      </div>
    );
  }

  return (
    <SubtitlerContext.Provider 
      value={{ 
        subtitlerData, 
        setSubtitlerData, 
        uploadedFileName, 
        setUploadedFileName: updateUploadedFileName 
      }}
    >
      {children}
    </SubtitlerContext.Provider>
  );
}

export function useSubtitler() {
  const context = useContext(SubtitlerContext);
  if (context === undefined) {
    throw new Error('useSubtitler must be used within a SubtitlerProvider');
  }
  return context;
}
