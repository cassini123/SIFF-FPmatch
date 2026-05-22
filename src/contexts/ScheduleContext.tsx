import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ScheduleMode } from '@/lib/scheduleConstants';

// 排班单元格数据
export interface ScheduleCell {
  date: string;
  cinema: string;
  hall: string;
  timeSlot: string;
  movieName: string;
  assignment: ScheduleAssignment;
  isComplete: boolean; // 是否两个字幕员都已分配
}

// 排班单元格数据
export interface ScheduleAssignment {
  subtitler1: string | null; // 字幕员1姓名
  subtitler2: string | null; // 字幕员2姓名
  subtitler1Id: string | null;
  subtitler2Id: string | null;
}

// 排班总表数据
export interface ScheduleTable {
  cells: ScheduleCell[]; // 所有排班单元格
  assignments: {
    [key: string]: ScheduleAssignment; // key = date|cinema|hall|timeSlot
  };
}

// Context类型
interface ScheduleContextType {
  scheduleTable: ScheduleTable | null;
  mode: ScheduleMode;
  setMode: (mode: ScheduleMode) => void;
  updateAssignment: (key: string, assignment: ScheduleAssignment) => void;
  getAssignment: (key: string) => ScheduleAssignment;
  clearAllAssignments: () => void;
  setScheduleTable: (table: ScheduleTable | null) => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

// LocalStorage key
const SCHEDULE_KEY = 'schedule_table_assignments_v2';
const MODE_KEY = 'schedule_mode';

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [scheduleTable, setScheduleTableState] = useState<ScheduleTable | null>(null);
  const [mode, setModeState] = useState<ScheduleMode>('manual');
  const [isInitialized, setIsInitialized] = useState(false);

  // 从localStorage恢复数据
  useEffect(() => {
    try {
      const savedSchedule = localStorage.getItem(SCHEDULE_KEY);
      const savedMode = localStorage.getItem(MODE_KEY);
      
      if (savedSchedule) {
        setScheduleTableState(JSON.parse(savedSchedule));
      }
      if (savedMode) {
        setModeState(savedMode as ScheduleMode);
      }
    } catch (e) {
      console.error('恢复排班数据失败:', e);
    }
    setIsInitialized(true);
  }, []);

  // 保存到localStorage
  const saveToStorage = useCallback(() => {
    try {
      if (scheduleTable) {
        localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduleTable));
      } else {
        localStorage.removeItem(SCHEDULE_KEY);
      }
      localStorage.setItem(MODE_KEY, mode);
    } catch (e) {
      console.error('保存排班数据失败:', e);
    }
  }, [scheduleTable, mode]);

  // 每次数据变化时保存
  useEffect(() => {
    if (isInitialized) {
      saveToStorage();
    }
  }, [scheduleTable, mode, saveToStorage, isInitialized]);

  const setScheduleTable = (table: ScheduleTable | null) => {
    setScheduleTableState(table);
  };

  const setMode = (newMode: ScheduleMode) => {
    setModeState(newMode);
  };

  const updateAssignment = useCallback((key: string, assignment: ScheduleAssignment) => {
    setScheduleTableState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        assignments: {
          ...prev.assignments,
          [key]: assignment
        }
      };
    });
  }, []);

  const getAssignment = useCallback((key: string): ScheduleAssignment => {
    if (!scheduleTable) {
      return { subtitler1: null, subtitler2: null, subtitler1Id: null, subtitler2Id: null };
    }
    return scheduleTable.assignments[key] || { 
      subtitler1: null, 
      subtitler2: null, 
      subtitler1Id: null, 
      subtitler2Id: null 
    };
  }, [scheduleTable]);

  const clearAllAssignments = useCallback(() => {
    setScheduleTableState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        assignments: {}
      };
    });
  }, []);

  if (!isInitialized) {
    return null;
  }

  return (
    <ScheduleContext.Provider 
      value={{ 
        scheduleTable, 
        mode,
        setMode,
        updateAssignment, 
        getAssignment,
        clearAllAssignments,
        setScheduleTable
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}
