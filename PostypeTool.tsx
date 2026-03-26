import React, { useState, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  Sparkles, Wand2, Copy, Check, Video, Type, 
  Languages, Trash2, RefreshCw, AlertCircle 
} from 'lucide-react';

export default function PostypeConverter() {
  const [aiKey, setAiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('等待输入...');
  const [isLoading, setIsLoading] = useState(false);
  const [nameMap, setNameMap] = useState("민규:玟奎\n원우:圆佑");

  // --- 核心逻辑：本地预处理 (清理 Postype 杂质) ---
  const preProcess = (raw: string) => {
    let text = raw;
    // 1. 识别 Postype 的视频组件并标记 (防止被 AI 弄丢)
    text = text.replace(/https?:\/\/www\.bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/ig, '\n[bvid:$1]\n');
    // 2. 清理连续换行
    text = text.replace(/\n{3,}/g, '\n\n');
    // 3. 基础格式修正
    text = text.replace(/^[—\-_*]{3,}$/gm, '---');
    return text;
  };

  // --- 核心逻辑：带自动重试的 AI 翻译 ---
  const translateWithRetry = async (retryCount = 0): Promise<string> => {
    const genAI = new GoogleGenerativeAI(aiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      任务：翻译 Postype 同人文章并保留特定格式。
      译名对照：\n${nameMap}
      
      规则：
      1. 将韩文翻译为自然流畅的中文。
      2. 保留所有 [bvid:xxx] 标签。
      3. 识别对话：左侧对话用 [bubble:L]，右侧用 [bubble:R]。
      4. 心理描写/引用使用 [quote] 标签。
      5. 严格保留原文的 **加粗** 和 *斜体*。
      
      请直接输出处理后的正文，不要有任何 Markdown 包裹符或废话。
      原文：\n${preProcess(input)}
    `;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text().replace(/```[\s\S]*?```/g, (m) => m.replace(/```(\w+)?/g, '')).trim();
    } catch (err: any) {
      if (err.message.includes('429') && retryCount < 2) {
        setStatus(`触发频率限制，2秒后自动重试 (第${retryCount + 1}次)...`);
        await new Promise(res => setTimeout(res, 2000));
        return translateWithRetry(retryCount + 1);
      }
      throw err;
    }
  };

  const handleStart = async () => {
    if (!aiKey) return alert("请填入 Gemini Key");
    if (!input) return alert("内容为空");
    setIsLoading(true);
    setStatus("正在处理中，请稍后...");
    try {
      const result = await translateWithRetry();
      setOutput(result);
      setStatus("处理成功！");
    } catch (err: any) {
      setStatus(`报错了: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setStatus("已复制到剪贴板");
    setTimeout(() => setStatus(""), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-end border-b dark:border-white/10 pb-4">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-2">
              <RefreshCw className={isLoading ? "animate-spin" : ""} /> 
              Postype 自动搬运工
            </h1>
            <p className="text-xs opacity-50 uppercase tracking-widest mt-1">Automatic Content Transformer</p>
          </div>
          <div className="flex gap-3">
            <input 
              type="password" 
              value={aiKey} 
              onChange={e => {setAiKey(e.target.value); localStorage.setItem('gemini_key', e.target.value)}}
              className="bg-white dark:bg-white/5 border dark:border-white/10 px-4 py-2 rounded-xl text-xs outline-none focus:ring-2 ring-blue-500"
              placeholder="粘贴你的 Gemini Key"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left: Input */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 font-bold text-blue-500"><Type size={16}/> 原文 (直接粘贴)</label>
              <textarea 
                value={nameMap} 
                onChange={e => setNameMap(e.target.value)}
                className="w-48 h-10 text-[10px] p-2 rounded-lg border dark:bg-black/40 outline-none"
                placeholder="译名映射..."
              />
            </div>
            <textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full h-[600px] p-4 rounded-2xl border dark:border-white/10 bg-white dark:bg-black/20 outline-none font-serif leading-relaxed text-sm focus:border-blue-500 transition-all"
              placeholder="把 Postype 的文章全文（包含乱码也没关系）贴在这里..."
            />
          </div>

          {/* Right: Output */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 font-bold text-emerald-500"><Languages size={16}/> 译文 (带标签排版)</label>
              <div className="flex gap-2">
                <button 
                  onClick={handleStart} 
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-xs font-black transition-all disabled:opacity-50"
                >
                  {isLoading ? "处理中..." : <><Sparkles size={14}/> 开始自动搬运</>}
                </button>
                <button 
                  onClick={copyToClipboard}
                  className="p-2 bg-slate-200 dark:bg-white/10 rounded-full hover:scale-110 transition-all"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
            <div className="relative">
              <textarea 
                value={output}
                readOnly
                className="w-full h-[600px] p-4 rounded-2xl border dark:border-white/10 bg-slate-100 dark:bg-white/5 outline-none font-serif leading-relaxed text-sm"
                placeholder="处理后的内容会出现在这里..."
              />
              {isLoading && (
                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-xs font-bold">{status}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Status */}
        {status && !isLoading && (
          <div className="flex items-center gap-2 text-xs font-mono opacity-60 bg-white dark:bg-white/5 p-3 rounded-xl border border-dashed border-black/10">
            <AlertCircle size={14} /> {status}
          </div>
        )}
      </div>
    </div>
  );
}
