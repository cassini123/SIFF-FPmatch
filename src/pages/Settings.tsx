import { useState, useEffect } from "react";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import DraggableDistrictList, { DEFAULT_DISTRICTS } from "@/components/DraggableDistrictList";
import { toast } from "sonner";
import { ScheduleConstraints, DEFAULT_CONSTRAINTS } from "@/lib/scheduleConstants";

// 语言验证schema
const languageSchema = z.object({
  name: z.string().min(1, "语言名称不能为空"),
  specialRules: z.string().min(1, "特殊规则不能为空")
});

// 行政区接口
interface District {
  id: string;
  name: string;
}

// 语言接口
interface Language {
  name: string;
  specialRules: string;
}

// LocalStorage keys
const DISTRICT_KEY = 'settings_districts';
const LANGUAGE_KEY = 'settings_languages';
const EXPORT_KEY = 'settings_export';
const CONSTRAINTS_KEY = 'settings_constraints';

// 从LocalStorage加载数据
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export default function Settings() {
  // 行政区优先级设置
  const [districts, setDistricts] = useState<District[]>(() => 
    loadFromStorage(DISTRICT_KEY, DEFAULT_DISTRICTS)
  );
  
  // 大前提条件设置
  const [constraints, setConstraints] = useState<ScheduleConstraints>(() =>
    loadFromStorage(CONSTRAINTS_KEY, DEFAULT_CONSTRAINTS)
  );
  
  // 语言管理
  const [languages, setLanguages] = useState<Language[]>(() =>
    loadFromStorage(LANGUAGE_KEY, [
      { name: "阿拉伯语", specialRules: "需提前3天通知" },
      { name: "俄语", specialRules: "需双人协作" }
    ])
  );
  
  // 导出设置
  const [exportSettings, setExportSettings] = useState(() =>
    loadFromStorage(EXPORT_KEY, {
      format: "excel" as const,
      includeHeader: true
    })
  );
  
  const [isSaving, setIsSaving] = useState(false);
  const [openSections, setOpenSections] = useState({
    districts: true,
    constraints: true,
    languages: true,
    export: true
  });

  // 保存到LocalStorage
  const saveToStorage = () => {
    try {
      localStorage.setItem(DISTRICT_KEY, JSON.stringify(districts));
      localStorage.setItem(LANGUAGE_KEY, JSON.stringify(languages));
      localStorage.setItem(EXPORT_KEY, JSON.stringify(exportSettings));
      localStorage.setItem(CONSTRAINTS_KEY, JSON.stringify(constraints));
    } catch (e) {
      console.error('保存设置失败:', e);
    }
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleLanguageChange = (index: number, field: keyof Language, value: string) => {
    const newLanguages = [...languages];
    newLanguages[index] = { ...newLanguages[index], [field]: value };
    setLanguages(newLanguages);
  };

  const handleExportSettingChange = (field: keyof typeof exportSettings, value: any) => {
    setExportSettings({
      ...exportSettings,
      [field]: value
    });
  };

  const handleConstraintChange = (field: keyof ScheduleConstraints, value: any) => {
    setConstraints(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateLanguages = () => {
    try {
      languages.forEach(language => languageSchema.parse(language));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return false;
    }
  };

  const validateConstraints = () => {
    if (constraints.maxPerDay < 1 || constraints.maxPerDay > 10) {
      toast.error("每天排班限制应在1-10之间");
      return false;
    }
    if (constraints.maxTotal < 1 || constraints.maxTotal > 50) {
      toast.error("总场次限制应在1-50之间");
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validateLanguages() || !validateConstraints()) return;
    
    setIsSaving(true);
    setTimeout(() => {
      saveToStorage();
      setIsSaving(false);
      toast.success("设置已保存");
    }, 800);
  };

  const handleResetDistricts = () => {
    setDistricts(DEFAULT_DISTRICTS);
    toast.success("行政区顺序已重置");
  };

  const handleResetConstraints = () => {
    setConstraints(DEFAULT_CONSTRAINTS);
    toast.success("大前提条件已重置");
  };

  return (
    <div className="flex h-screen bg-[#2B3A67] text-white">
      <Navigation />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* 行政区优先级设置 */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <button 
                className="w-full p-4 text-left font-bold text-gray-800 flex justify-between items-center hover:bg-gray-50"
                onClick={() => toggleSection("districts")}
              >
                <div className="flex items-center">
                  <i className="fa-solid fa-map-location-dot mr-2 text-[#D4AF37]"></i>
                  <span>行政区优先级设置</span>
                </div>
                <i className={`fa-solid fa-chevron-${openSections.districts ? "up" : "down"} text-gray-400`}></i>
              </button>
              
              <AnimatePresence>
                {openSections.districts && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 border-t border-gray-200">
                      <DraggableDistrictList
                        districts={districts}
                        onChange={setDistricts}
                      />
                      <p className="mt-3 text-xs text-gray-400">
                        提示：优先级设置将影响字幕员分配时的区域匹配顺序
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 大前提条件设置 */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <button 
                className="w-full p-4 text-left font-bold text-gray-800 flex justify-between items-center hover:bg-gray-50"
                onClick={() => toggleSection("constraints")}
              >
                <div className="flex items-center">
                  <i className="fa-solid fa-sliders mr-2 text-[#D4AF37]"></i>
                  <span>排班大前提条件（全局规则）</span>
                </div>
                <i className={`fa-solid fa-chevron-${openSections.constraints ? "up" : "down"} text-gray-400`}></i>
              </button>
              
              <AnimatePresence>
                {openSections.constraints && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 border-t border-gray-200 space-y-4">
                      {/* 每个字幕员每天排班限制 */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <label className="font-medium text-gray-700">
                            每个字幕员每天排班限制
                          </label>
                          <p className="text-sm text-gray-500 mt-1">
                            设定每个字幕员同一天内最多可安排的场次
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={constraints.maxPerDay}
                            onChange={(e) => handleConstraintChange('maxPerDay', parseInt(e.target.value) || 1)}
                            className="w-20 p-2 border border-gray-300 rounded text-center text-gray-800"
                          />
                          <span className="text-gray-600">场/天</span>
                        </div>
                      </div>

                      {/* 每个字幕员总场次限制 */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <label className="font-medium text-gray-700">
                            每个字幕员总场次限制
                          </label>
                          <p className="text-sm text-gray-500 mt-1">
                            设定每个字幕员在整个排片期间最多可安排的场次
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={constraints.maxTotal}
                            onChange={(e) => handleConstraintChange('maxTotal', parseInt(e.target.value) || 1)}
                            className="w-20 p-2 border border-gray-300 rounded text-center text-gray-800"
                          />
                          <span className="text-gray-600">场/总</span>
                        </div>
                      </div>

                      {/* 同一时间段互斥 */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <label className="font-medium text-gray-700">
                            同一时间段字幕员互斥
                          </label>
                          <p className="text-sm text-gray-500 mt-1">
                            开启后，同一字幕员同一时间段只能出现在一个影院的一个厅
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={constraints.exclusiveTimeSlot}
                            onChange={(e) => handleConstraintChange('exclusiveTimeSlot', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#D4AF37] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                        </label>
                      </div>

                      {/* 优先使用时间块多的字幕员 */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <label className="font-medium text-gray-700">
                            优先使用时间块多的字幕员
                          </label>
                          <p className="text-sm text-gray-500 mt-1">
                            开启后，系统会优先安排时间块（绿色格子）更多的字幕员
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={constraints.preferMoreTimeSlots}
                            onChange={(e) => handleConstraintChange('preferMoreTimeSlots', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#D4AF37] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                        </label>
                      </div>

                      <button
                        onClick={handleResetConstraints}
                        className="text-sm text-[#D4AF37] hover:text-[#D4AF37]/80"
                      >
                        <i className="fa-solid fa-rotate-left mr-1"></i>
                        重置为默认值
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 小语种特殊规则管理 */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <button 
                className="w-full p-4 text-left font-bold text-gray-800 flex justify-between items-center hover:bg-gray-50"
                onClick={() => toggleSection("languages")}
              >
                <div className="flex items-center">
                  <i className="fa-solid fa-language mr-2 text-[#D4AF37]"></i>
                  <span>小语种特殊规则管理</span>
                </div>
                <i className={`fa-solid fa-chevron-${openSections.languages ? "up" : "down"} text-gray-400`}></i>
              </button>
              
              <AnimatePresence>
                {openSections.languages && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 border-t border-gray-200 space-y-4">
                      {languages.map((language, index) => (
                        <div key={index} className="flex items-center space-x-4">
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder="语言名称"
                              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent text-gray-800"
                              value={language.name}
                              onChange={(e) => handleLanguageChange(index, "name", e.target.value)}
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder="特殊规则"
                              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent text-gray-800"
                              value={language.specialRules}
                              onChange={(e) => handleLanguageChange(index, "specialRules", e.target.value)}
                            />
                          </div>
                          <button 
                            className="text-red-500 hover:text-red-700 p-2"
                            title="删除"
                            onClick={() => {
                              const newLanguages = [...languages];
                              newLanguages.splice(index, 1);
                              setLanguages(newLanguages);
                            }}
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      ))}
                      <button
                        className="text-[#2B3A67] hover:text-[#2B3A67]/80 font-medium"
                        onClick={() => {
                          setLanguages([
                            ...languages, 
                            { name: "", specialRules: "" }
                          ]);
                        }}
                      >
                        <i className="fa-solid fa-plus mr-2"></i>添加小语种
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 导出格式设置 */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <button 
                className="w-full p-4 text-left font-bold text-gray-800 flex justify-between items-center hover:bg-gray-50"
                onClick={() => toggleSection("export")}
              >
                <div className="flex items-center">
                  <i className="fa-solid fa-file-export mr-2 text-[#D4AF37]"></i>
                  <span>导出格式设置</span>
                </div>
                <i className={`fa-solid fa-chevron-${openSections.export ? "up" : "down"} text-gray-400`}></i>
              </button>
              
              <AnimatePresence>
                {openSections.export && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 border-t border-gray-200 space-y-4">
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="exportFormat"
                            checked={exportSettings.format === "excel"}
                            onChange={() => handleExportSettingChange("format", "excel")}
                            className="text-[#2B3A67]"
                          />
                          <span className="text-gray-700">Excel格式 (.xlsx)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="exportFormat"
                            checked={exportSettings.format === "csv"}
                            onChange={() => handleExportSettingChange("format", "csv")}
                            className="text-[#2B3A67]"
                          />
                          <span className="text-gray-700">CSV格式 (.csv)</span>
                        </label>
                      </div>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportSettings.includeHeader}
                          onChange={(e) => handleExportSettingChange("includeHeader", e.target.checked)}
                          className="text-[#2B3A67]"
                        />
                        <span className="text-gray-700">包含表头</span>
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 底部操作栏 */}
            <div className="bg-white rounded-lg p-4 shadow-lg flex justify-between items-center">
              <button
                onClick={handleResetDistricts}
                className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
              >
                <i className="fa-solid fa-rotate-left mr-2"></i>
                重置行政区
              </button>
              <div className="flex space-x-4">
                <button className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100">
                  取消
                </button>
                <button
                  className={`px-4 py-2 rounded text-white ${isSaving ? "bg-[#D4AF37]/70" : "bg-[#D4AF37] hover:bg-[#D4AF37]/90"}`}
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                      保存中...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk mr-2"></i>
                      保存设置
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
