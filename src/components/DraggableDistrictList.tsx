import { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface District {
  id: string;
  name: string;
}

interface SortableDistrictItemProps {
  id: string;
  district: District;
  index: number;
}

// 单个可拖拽项
function SortableDistrictItem({ id, district, index }: SortableDistrictItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg mb-2
        ${isDragging ? 'shadow-lg ring-2 ring-[#D4AF37]' : 'hover:shadow-md'}
        transition-shadow cursor-move
      `}
    >
      {/* 拖拽手柄 */}
      <div 
        className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <i className="fa-solid fa-grip-vertical"></i>
      </div>
      
      {/* 序号 */}
      <div className="w-10 h-10 rounded-full bg-[#2B3A67] text-white flex items-center justify-center font-bold text-sm">
        {index + 1}
      </div>
      
      {/* 行政区名称 */}
      <div className="flex-1">
        <span className="font-medium text-gray-800">{district.name}</span>
      </div>
    </div>
  );
}

interface DraggableDistrictListProps {
  districts: District[];
  onChange: (districts: District[]) => void;
}

// 行政区可拖拽列表组件
export default function DraggableDistrictList({ districts, onChange }: DraggableDistrictListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = districts.findIndex((d) => d.id === active.id);
      const newIndex = districts.findIndex((d) => d.id === over.id);
      const newDistricts = arrayMove(districts, oldIndex, newIndex);
      onChange(newDistricts);
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          拖动项目可调整行政区优先级，顺序越靠前优先级越高
        </p>
        <button
          onClick={() => {
            // 重置为默认顺序
            const defaultDistricts = [
              { id: '1', name: '嘉定' },
              { id: '2', name: '宝山' },
              { id: '3', name: '闵行' },
              { id: '4', name: '杨浦' },
              { id: '5', name: '普陀' },
              { id: '6', name: '虹口' },
              { id: '7', name: '浦东' },
              { id: '8', name: '长宁' },
              { id: '9', name: '静安' },
              { id: '10', name: '徐汇' },
              { id: '11', name: '黄浦' },
            ];
            onChange(defaultDistricts);
          }}
          className="text-sm text-[#D4AF37] hover:text-[#D4AF37]/80"
        >
          <i className="fa-solid fa-rotate-left mr-1"></i>
          重置顺序
        </button>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={districts.map(d => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {districts.map((district, index) => (
              <SortableDistrictItem
                key={district.id}
                id={district.id}
                district={district}
                index={index}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// 默认行政区列表
export const DEFAULT_DISTRICTS = [
  { id: '1', name: '嘉定' },
  { id: '2', name: '宝山' },
  { id: '3', name: '闵行' },
  { id: '4', name: '杨浦' },
  { id: '5', name: '普陀' },
  { id: '6', name: '虹口' },
  { id: '7', name: '浦东' },
  { id: '8', name: '长宁' },
  { id: '9', name: '静安' },
  { id: '10', name: '徐汇' },
  { id: '11', name: '黄浦' },
];
