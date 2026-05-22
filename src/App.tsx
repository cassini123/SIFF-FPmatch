import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Schedule from "@/pages/Schedule";
import Settings from "@/pages/Settings";
import SubtitlerSchedule from "@/pages/SubtitlerSchedule";
import ScheduleTable from "@/pages/ScheduleTable";
import ScheduleOverview from "@/pages/ScheduleOverview";
import { createContext, useState } from "react";
import { SubtitlerProvider } from "@/contexts/SubtitlerContext";
import { ScheduleTableProvider } from "@/contexts/ScheduleTableContext";
import { ScheduleProvider } from "@/contexts/ScheduleContext";

export const AuthContext = createContext({
  isAuthenticated: false,
  setIsAuthenticated: (value: boolean) => {},
  logout: () => {},
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, setIsAuthenticated, logout }}
    >
      <SubtitlerProvider>
        <ScheduleTableProvider>
          <ScheduleProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/subtitler" element={<SubtitlerSchedule />} />
              <Route path="/schedule-table" element={<ScheduleTable />} />
              <Route path="/schedule-overview" element={<ScheduleOverview />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </ScheduleProvider>
        </ScheduleTableProvider>
      </SubtitlerProvider>
    </AuthContext.Provider>
  );
}
