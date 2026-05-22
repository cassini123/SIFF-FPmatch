import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ScheduleMode, getSlotKey } from '@/lib/scheduleConstants';
import { ParsedScheduleTable } from '@/contexts/ScheduleTableContext';
import { syncScheduleTableWithParsedData } from '@/lib/buildScheduleViewData';

export interface ScheduleCell {
  date: string;
  cinema: string;
  hall: string;
  timeSlot: string;
  movieName: string;
  assignment: ScheduleAssignment;
  isComplete: boolean;
}

export interface ScheduleAssignment {
  subtitler1: string | null;
  subtitler2: string | null;
  subtitler1Id: string | null;
  subtitler2Id: string | null;
}

export type AssignmentSource = 'manual' | 'auto';

export interface ScheduleTable {
  cells: ScheduleCell[];
  assignments: {
    [key: string]: ScheduleAssignment;
  };
  assignmentSources?: Record<string, AssignmentSource>;
}

interface UndoEntry {
  key: string;
  previous: ScheduleAssignment;
  previousSource: AssignmentSource | undefined;
}

export interface UpdateAssignmentOptions {
  skipHistory?: boolean;
  source?: AssignmentSource;
}

interface ScheduleContextType {
  scheduleTable: ScheduleTable | null;
  mode: ScheduleMode;
  setMode: (mode: ScheduleMode) => void;
  updateAssignment: (
    key: string,
    assignment: ScheduleAssignment,
    options?: UpdateAssignmentOptions
  ) => void;
  getAssignment: (key: string) => ScheduleAssignment;
  getAssignmentSource: (key: string) => AssignmentSource | undefined;
  clearAllAssignments: () => void;
  setScheduleTable: (table: ScheduleTable | null) => void;
  syncFromParsedData: (scheduleData: ParsedScheduleTable) => void;
  undo: () => void;
  canUndo: boolean;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

const SCHEDULE_KEY = 'schedule_table_assignments_v2';
const MODE_KEY = 'schedule_mode';
const UNDO_KEY = 'schedule_undo_stack_v1';
const MAX_UNDO = 50;

const emptyAssignment = (): ScheduleAssignment => ({
  subtitler1: null,
  subtitler2: null,
  subtitler1Id: null,
  subtitler2Id: null,
});

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [scheduleTable, setScheduleTableState] = useState<ScheduleTable | null>(null);
  const [mode, setModeState] = useState<ScheduleMode>('manual');
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

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
      const savedUndo = localStorage.getItem(UNDO_KEY);
      if (savedUndo) {
        setUndoStack(JSON.parse(savedUndo));
      }
    } catch (e) {
      console.error('恢复排班数据失败:', e);
    }
    setIsInitialized(true);
  }, []);

  const saveToStorage = useCallback(() => {
    try {
      if (scheduleTable) {
        localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduleTable));
      } else {
        localStorage.removeItem(SCHEDULE_KEY);
      }
      localStorage.setItem(MODE_KEY, mode);
      localStorage.setItem(UNDO_KEY, JSON.stringify(undoStack));
    } catch (e) {
      console.error('保存排班数据失败:', e);
    }
  }, [scheduleTable, mode, undoStack]);

  useEffect(() => {
    if (isInitialized) {
      saveToStorage();
    }
  }, [scheduleTable, mode, saveToStorage, isInitialized]);

  const setScheduleTable = (table: ScheduleTable | null) => {
    setScheduleTableState(table);
  };

  const syncFromParsedData = useCallback((scheduleData: ParsedScheduleTable) => {
    setScheduleTableState(prev => syncScheduleTableWithParsedData(scheduleData, prev));
  }, []);

  const setMode = (newMode: ScheduleMode) => {
    setModeState(newMode);
  };

  const applyAssignment = useCallback((
    prev: ScheduleTable,
    key: string,
    assignment: ScheduleAssignment,
    source?: AssignmentSource
  ): ScheduleTable => {
    const isComplete = !!(assignment.subtitler1 && assignment.subtitler2);
    const hasAnyone = !!(assignment.subtitler1 || assignment.subtitler2);
    const nextSources = { ...(prev.assignmentSources ?? {}) };

    if (source && hasAnyone) {
      nextSources[key] = source;
    } else if (!hasAnyone) {
      delete nextSources[key];
    }

    return {
      ...prev,
      assignments: {
        ...prev.assignments,
        [key]: assignment,
      },
      assignmentSources: nextSources,
      cells: prev.cells.map(cell => {
        const cellKey = getSlotKey(cell.date, cell.cinema, cell.hall, cell.timeSlot);
        if (cellKey !== key) return cell;
        return { ...cell, assignment, isComplete };
      }),
    };
  }, []);

  const updateAssignment = useCallback((
    key: string,
    assignment: ScheduleAssignment,
    options?: UpdateAssignmentOptions
  ) => {
    setScheduleTableState(prev => {
      if (!prev) return prev;

      if (!options?.skipHistory) {
        const previous = prev.assignments[key] ?? emptyAssignment();
        const previousSource = prev.assignmentSources?.[key];
        const changed =
          previous.subtitler1 !== assignment.subtitler1 ||
          previous.subtitler2 !== assignment.subtitler2 ||
          previous.subtitler1Id !== assignment.subtitler1Id ||
          previous.subtitler2Id !== assignment.subtitler2Id;

        if (changed) {
          setUndoStack(stack => {
            const entry: UndoEntry = { key, previous, previousSource };
            const next = [...stack, entry];
            return next.length > MAX_UNDO ? next.slice(-MAX_UNDO) : next;
          });
        }
      }

      return applyAssignment(prev, key, assignment, options?.source);
    });
  }, [applyAssignment]);

  const getAssignmentSource = useCallback((key: string): AssignmentSource | undefined => {
    return scheduleTable?.assignmentSources?.[key];
  }, [scheduleTable]);

  const undo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      setScheduleTableState(prev => {
        if (!prev) return prev;
        const next = applyAssignment(prev, entry.key, entry.previous);
        const sources = { ...(prev.assignmentSources ?? {}) };
        if (entry.previousSource) {
          sources[entry.key] = entry.previousSource;
        } else {
          delete sources[entry.key];
        }
        return { ...next, assignmentSources: sources };
      });
      return stack.slice(0, -1);
    });
  }, [applyAssignment]);

  const getAssignment = useCallback((key: string): ScheduleAssignment => {
    const empty = emptyAssignment();
    if (!scheduleTable) return empty;
    if (scheduleTable.assignments[key]) {
      return scheduleTable.assignments[key];
    }
    const cell = scheduleTable.cells.find(
      c => getSlotKey(c.date, c.cinema, c.hall, c.timeSlot) === key
    );
    return cell?.assignment ?? empty;
  }, [scheduleTable]);

  const clearAllAssignments = useCallback(() => {
    const empty = emptyAssignment();
    setScheduleTableState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        assignments: {},
        assignmentSources: {},
        cells: prev.cells.map(cell => ({
          ...cell,
          assignment: empty,
          isComplete: false,
        })),
      };
    });
    setUndoStack([]);
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2B3A67] text-white text-sm">
        加载排班数据…
      </div>
    );
  }

  return (
    <ScheduleContext.Provider
      value={{
        scheduleTable,
        mode,
        setMode,
        updateAssignment,
        getAssignment,
        getAssignmentSource,
        clearAllAssignments,
        setScheduleTable,
        syncFromParsedData,
        undo,
        canUndo: undoStack.length > 0,
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
