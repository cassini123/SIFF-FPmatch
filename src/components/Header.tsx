import React from 'react';
export default function Header() {
  return (
    <header className="h-16 bg-[#1E2A4A] flex items-center justify-between px-6 border-b border-gray-700">
      <div className="text-gray-300">
        <i className="fa-solid fa-bars mr-4"></i>
        <span>2025上海国际电影节 - 字幕员排班系统</span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-gray-300">
          <i className="fa-solid fa-circle-user mr-2"></i>
          <span>管理员</span>
        </div>
        <button className="text-gray-300 hover:text-white">
          <i className="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </header>
  );
}