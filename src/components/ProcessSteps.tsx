import React from 'react';
import { NavLink } from "react-router-dom";

interface Step {
  name: string;
  status: 'todo' | 'doing' | 'done';
}

interface ProcessStepsProps {
  steps: Step[];
}

export default function ProcessSteps({ steps }: ProcessStepsProps) {
  const progress = (steps.filter(s => s.status === 'done').length / steps.length) * 100;
  
  return (
    <div className="space-y-6">
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div 
          className="bg-[#D4AF37] h-4 rounded-full transition-all duration-500" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <NavLink
            key={index}
            to={step.status === 'done' || step.status === 'doing' ? 
                (index === 0 ? '/' : index === 1 ? '/schedule' : '#') : '#'}
            className={`flex flex-col items-center ${step.status === 'doing' ? 'text-[#D4AF37]' : step.status === 'done' ? 'text-green-600' : 'text-gray-400'}`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 
              ${step.status === 'doing' ? 'bg-[#D4AF37] text-white' : 
                step.status === 'done' ? 'bg-green-100' : 'bg-gray-200'}`}>
              {step.status === 'done' ? (
                <i className="fa-solid fa-check"></i>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span className="text-sm font-medium">{step.name}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}