import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import FileUpload from "@/components/FileUpload";
import ProcessSteps from "@/components/ProcessSteps";
import { useSubtitler } from "@/contexts/SubtitlerContext";
import { useScheduleTable } from "@/contexts/ScheduleTableContext";
import { parseSubtitlerExcelFromFile } from "@/lib/parseSubtitlerExcel";
import { parseScheduleTableFromFile } from "@/lib/parseScheduleTable";

export default function Dashboard() {
  const [steps] = useState([
    { name: "数据准备", status: "doing" },
    { name: "人员分配", status: "todo" },
    { name: "排班确认", status: "todo" },
    { name: "结果导出", status: "todo" }
  ]);

  const { setSubtitlerData, uploadedFileName, setUploadedFileName } = useSubtitler();
  const { setScheduleData, uploadedFileName: scheduleFileName, setUploadedFileName: setScheduleFileName } = useScheduleTable();
  const navigate = useNavigate();

  const handleSubtitlerUpload = useCallback(async (file: File) => {
    const loadingId = toast.loading("正在解析字幕员数据...");
    try {
      const data = await parseSubtitlerExcelFromFile(file);
      toast.dismiss(loadingId);
      if (!data.rows.length) {
        throw new Error('解析结果为空，请确认上传的是字幕员时间表（表头含 18日-9:00 或 姓名）');
      }
      setSubtitlerData(data);
      setUploadedFileName(file.name);
      toast.success(`字幕员数据上传成功！共 ${data.rows.length} 名字幕员`);
      
      // 询问是否跳转到字幕员表
      setTimeout(() => {
        const shouldNavigate = window.confirm("字幕员数据已上传！是否跳转到字幕员表查看？");
        if (shouldNavigate) {
          navigate('/subtitler');
        }
      }, 500);
    } catch (error) {
      toast.dismiss(loadingId);
      console.error('解析字幕员数据失败:', error);
      const message = error instanceof Error ? error.message : "解析字幕员数据失败，请检查文件格式";
      toast.error(message);
    }
  }, [setSubtitlerData, setUploadedFileName, navigate]);

  const handleScheduleUpload = useCallback(async (file: File) => {
    const loadingId = toast.loading("正在解析电影排片表...");
    try {
      const data = await parseScheduleTableFromFile(file);
      toast.dismiss(loadingId);
      setScheduleData(data);
      setScheduleFileName(file.name);
      // 新排片表会由排班总页根据 scheduleData 重建
      toast.success(`电影排片表上传成功！共 ${data.cinemas.length} 家影院，${data.dates.length} 天排片`);
      
      // 询问是否跳转到电影排片表
      setTimeout(() => {
        const shouldNavigate = window.confirm("电影排片表已上传！是否跳转到电影排片查看？");
        if (shouldNavigate) {
          navigate('/schedule-table');
        }
      }, 500);
    } catch (error) {
      toast.dismiss(loadingId);
      console.error('解析排片表失败:', error);
      const message = error instanceof Error ? error.message : "解析排片表失败，请检查文件格式";
      toast.error(message);
    }
  }, [setScheduleData, setScheduleFileName, navigate]);

  const downloadTemplate = () => {
    toast.info("模板下载功能开发中...");
  };

  return (
    <div className="flex h-screen bg-[#2B3A67] text-white">
      <Navigation />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* 数据导入卡片 */}
            <div className="bg-white rounded-lg p-6 shadow-lg text-gray-800">
              <h2 className="text-xl font-bold mb-4">数据导入</h2>
              <div className="mb-4 p-4 bg-gray-50 rounded">
                <h3 className="font-medium mb-2">数据输入方式说明</h3>
                <p className="text-sm mb-2">1. <strong>字幕员数据</strong>：上传包含字幕员姓名、可用时间段、负责区域、搭档信息的Excel表</p>
                <p className="text-sm mb-2">2. <strong>电影排片表</strong>：上传包含电影节期间各影院排片信息的Excel表</p>
                <p className="text-sm">支持Excel/CSV格式，下载标准模板请点击下方按钮</p>
              </div>
              <FileUpload 
                onSubtitlerUpload={handleSubtitlerUpload}
                onScheduleUpload={handleScheduleUpload}
                subtitlerFileName={uploadedFileName}
                scheduleFileName={scheduleFileName}
              />
              
              <div className="mt-4 flex gap-4">
                <button 
                  onClick={downloadTemplate}
                  className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-medium py-2 px-4 rounded transition-colors"
                >
                  <i className="fa-solid fa-download mr-2"></i>
                  下载字幕员模板
                </button>
                <button 
                  onClick={downloadTemplate}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors"
                >
                  <i className="fa-solid fa-download mr-2"></i>
                  下载排片表模板
                </button>
              </div>
            </div>
            
            {/* 流程导航卡片 */}
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-bold mb-4 text-gray-800">排班流程</h2>
              <ProcessSteps steps={steps} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
