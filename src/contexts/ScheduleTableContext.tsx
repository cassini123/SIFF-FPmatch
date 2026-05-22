import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 电影场次数据结构
export interface MovieShow {
  code: string;       // 电影代码
  name: string;       // 电影名称（中英文）
  duration: string;   // 时长
  country: string;    // 国家
  price: string;      // 价格
  hasMeetup: boolean; // 是否有观众见面会
  raw: string;        // 原始数据
}

export interface ScheduleRow {
  date: string;       // 日期 2024-06-15
  week: string;       // 周几 五、六、日...
  cinema: string;     // 影院
  hall: string;       // 影厅
  shows: {
    [timeSlot: string]: MovieShow | null;  // 各时间段的排片
  };
}

export interface ParsedScheduleTable {
  dates: string[];         // 所有日期
  cinemas: string[];       // 所有影院
  halls: string[];         // 所有影厅
  timeSlots: string[];     // 所有时间段
  rows: ScheduleRow[];     // 所有排片数据
}

// LocalStorage key
const STORAGE_KEY = 'schedule_table_data_v2';
const FILE_NAME_KEY = 'schedule_table_file_name';

interface ScheduleTableContextType {
  scheduleData: ParsedScheduleTable | null;
  setScheduleData: (data: ParsedScheduleTable | null) => void;
  uploadedFileName: string | null;
  setUploadedFileName: (name: string | null) => void;
}

const ScheduleTableContext = createContext<ScheduleTableContextType | undefined>(undefined);

export function ScheduleTableProvider({ children }: { children: ReactNode }) {
  const [scheduleData, setScheduleDataState] = useState<ParsedScheduleTable | null>(null);
  const [uploadedFileName, setUploadedFileNameState] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 从localStorage恢复数据
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      const savedFileName = localStorage.getItem(FILE_NAME_KEY);
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed?.rows?.length) {
          setScheduleDataState(parsed);
        }
      }
      if (savedFileName) {
        setUploadedFileNameState(savedFileName);
      }
    } catch (e) {
      console.error('恢复排片表数据失败:', e);
    }
    setIsInitialized(true);
  }, []);

  const setScheduleData = (data: ParsedScheduleTable | null) => {
    setScheduleDataState(data);
    try {
      if (data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('保存排片表数据失败:', e);
    }
  };

  const setUploadedFileName = (name: string | null) => {
    setUploadedFileNameState(name);
    try {
      if (name) {
        localStorage.setItem(FILE_NAME_KEY, name);
      } else {
        localStorage.removeItem(FILE_NAME_KEY);
      }
    } catch (e) {
      console.error('保存排片文件名失败:', e);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2B3A67] text-white text-sm">
        加载排片数据…
      </div>
    );
  }

  return (
    <ScheduleTableContext.Provider 
      value={{ 
        scheduleData, 
        setScheduleData, 
        uploadedFileName, 
        setUploadedFileName 
      }}
    >
      {children}
    </ScheduleTableContext.Provider>
  );
}

export function useScheduleTable() {
  const context = useContext(ScheduleTableContext);
  if (context === undefined) {
    throw new Error('useScheduleTable must be used within a ScheduleTableProvider');
  }
  return context;
}
