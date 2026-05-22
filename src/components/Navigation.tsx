import React from 'react';
import { NavLink } from "react-router-dom";

export default function Navigation() {
  return (
    <nav className="w-60 bg-[#1E2A4A] p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#D4AF37]">SIFF排班助手</h1>
        <p className="text-sm text-gray-400">2025上海国际电影节</p>
      </div>
      
      <ul className="space-y-2 flex-1">
        <li>
          <NavLink 
            to="/" 
            className={({isActive}) => `block px-4 py-2 rounded ${isActive ? 'bg-[#2B3A67] text-white' : 'text-gray-300 hover:bg-[#2B3A67]/50'}`}
          >
            <i className="fa-solid fa-gauge mr-2"></i>
            仪表盘
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/schedule" 
            className={({isActive}) => `block px-4 py-2 rounded ${isActive ? 'bg-[#2B3A67] text-white' : 'text-gray-300 hover:bg-[#2B3A67]/50'}`}
          >
            <i className="fa-solid fa-calendar-days mr-2"></i>
            排班编辑
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/subtitler" 
            className={({isActive}) => `block px-4 py-2 rounded ${isActive ? 'bg-[#2B3A67] text-white' : 'text-gray-300 hover:bg-[#2B3A67]/50'}`}
          >
            <i className="fa-solid fa-users mr-2"></i>
            字幕员表
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/schedule-table" 
            className={({isActive}) => `block px-4 py-2 rounded ${isActive ? 'bg-[#2B3A67] text-white' : 'text-gray-300 hover:bg-[#2B3A67]/50'}`}
          >
            <i className="fa-solid fa-film mr-2"></i>
            电影排片
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/schedule-overview" 
            className={({isActive}) => `block px-4 py-2 rounded ${isActive ? 'bg-[#2B3A67] text-white' : 'text-gray-300 hover:bg-[#2B3A67]/50'}`}
          >
            <i className="fa-solid fa-clipboard-list mr-2"></i>
            排班总表
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/settings" 
            className={({isActive}) => `block px-4 py-2 rounded ${isActive ? 'bg-[#2B3A67] text-white' : 'text-gray-300 hover:bg-[#2B3A67]/50'}`}
          >
            <i className="fa-solid fa-gear mr-2"></i>
            设置
          </NavLink>
        </li>
      </ul>
      
      <div className="mt-auto pt-4 border-t border-gray-700">
        <div className="text-gray-400 text-sm">当前版本: v1.0.0</div>
      </div>
    </nav>
  );
}