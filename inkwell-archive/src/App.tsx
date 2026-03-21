/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Moon, 
  Sun, 
  ShieldAlert,
  Heart
} from 'lucide-react';

interface Story {
  id: string;
  title: string;
  author: string;
  date: string;
  fileName: string;
  sourceLink: string;
  wordCount?: number;
  content?: string;
}

export default function App() {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [fontSize, setFontSize] = useState(18); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  
  const [hasConfirmedAge, setHasConfirmedAge] = useState(false);
  const [isHonest, setIsHonest] = useState(false);

  useEffect(() => {
    fetch('/stories/index.json')
      .then(res => res.json())
      .then(data => {
        setStories(data);
        setTimeout(() => setLoading(false), 1000);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadFullStory = async (story: Story) => {
    if (story.content) {
      setCurrentStory(story);
      return;
    }
    setReading(true);
    try {
      const response = await fetch(`/stories/${story.fileName}`);
      const text = await response.text();
      const count = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length;
      const updatedStory = { ...story, content: text, wordCount: count };
      setCurrentStory(updatedStory);
      setStories(prev => prev.map(s => s.id === story.id ? updatedStory : s));
    } catch (err) {
      alert("读取失败");
    } finally {
      setReading(false);
    }
  };

  // 1. 模糊加载界面
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#121212]">
      <motion.div initial={{ opacity: 0, filter: 'blur(10px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} className="text-center">
        <div className="text-sm tracking-[0.5em] opacity-30 uppercase font-serif">INITIALIZING...</div>
      </motion.div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'dark bg-[#121212] text-[#E0E0E0]' : 'bg-[#F5F5F5] text-[#333333]'} font-serif selection:bg-black/5 bg-noise`}>
      <AnimatePresence mode="wait">
        {!hasConfirmedAge ? (
          // 2. 年龄确认
          <motion.div key="age-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center">
            <AnimatePresence mode="wait">
              {!isHonest ? (
                <motion.div key="question" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="max-w-md w-full">
                  <ShieldAlert className="mx-auto mb-8 opacity-20" size={48} />
                  <h1 className="text-2xl font-bold tracking-[0.3em] mb-4 uppercase">Content Warning</h1>
                  <div className="space-y-4 mb-12 text-xs leading-relaxed opacity-60 tracking-widest">
                    <p>本站内容可能包含 R18 分级，仅供成年人浏览。</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-40 mt-2">您是否已年满 18 周岁？</p>
                  </div>
                  <div className="flex flex-col gap-4 items-center">
                    <button onClick={() => setHasConfirmedAge(true)} className={`w-48 py-3 border rounded-full text-[10px] font-bold tracking-[0.3em] uppercase transition-all ${isDarkMode ? 'border-white/20 hover:bg-white hover:text-black' : 'border-black/20 hover:bg-black hover:text-white'}`}>YES / 是</button>
                    <button onClick={() => setIsHonest(true)} className="text-[10px] uppercase tracking-[0.2em] opacity-30 hover:opacity-100 transition-opacity">NO / 不是</button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="honest-msg" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
                  <Heart className="mx-auto mb-6 opacity-20 text-red-500" size={40} />
                  <h2 className="text-lg font-bold tracking-[0.2em] mb-4">感谢你的诚实</h2>
                  <p className="text-xs leading-relaxed opacity-60 tracking-widest">档案馆的大门将为你保留。<br/>成年后再来吧。</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          // 3. 网站主体
          <motion.div key="main-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col min-h-screen">
            <header className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-sm border-b ${isDarkMode ? 'bg-black/30 border-white/10' : 'bg-white/30 border-black/5'}`}>
              <div className="flex items-center gap-4">
                {currentStory ? (
                  <button onClick={() => setCurrentStory(null)} className={`flex items-center gap-2 text-xs uppercase tracking-widest font-sans font-bold transition-opacity ${isDarkMode ? 'text-white/60 hover:text-white' : 'opacity-60 hover:opacity-100'}`}>
                    <ChevronLeft size={16} /> Back
                  </button>
                ) : (
                  <h1 className="text-sm uppercase tracking-widest font-sans font-semibold opacity-30">HW / ARCHIVE</h1>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'text-yellow-400 hover:bg-white/10' : 'text-slate-700 hover:bg-black/5'}`}>
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                {currentStory && (
                  <div className="flex gap-1 ml-2 font-sans font-bold">
                    <button onClick={() => setFontSize(f => Math.max(f-2, 14))} className="w-8 h-8 text-xs">A-</button>
                    <button onClick={() => setFontSize(f => Math.min(f+2, 28))} className="w-8 h-8 text-lg">A+</button>
                  </div>
                )}
              </div>
            </header>

            <main className="pt-24 pb-20 px-6 max-w-4xl mx-auto flex-grow w-full">
              <AnimatePresence mode="wait">
                {!currentStory ? (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <header className="text-center py-12">
                      <h1 className="text-3xl font-bold tracking-[0.2em] mb-4">花汪档案馆</h1>
                    </header>
                    <section className="max-w-[700px] mx-auto">
                      {stories.map(s => (
                        <motion.button key={s.id} whileHover={{ x: 5 }} onClick={() => loadFullStory(s)} className={`w-full grid grid-cols-[1fr_auto] py-8 border-b transition-colors text-left ${isDarkMode ? 'border-white/10 hover:border-white/30' : 'border-black/5 hover:border-black/20'}`}>
                          <h3 className="text-xl font-medium mb-1">{s.title}</h3>
                          <div className="col-span-full flex gap-4 text-[10px] opacity-40 uppercase tracking-widest font-sans">
                            <span>{s.author}</span>
                            <span>{s.date.replace(/-/g, '.')}</span>
                          </div>
                        </motion.button>
                      ))}
                    </section>
                  </motion.div>
                ) : (
                  <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[700px] mx-auto">
                    <header className="mb-16 border-b border-black/5 dark:border-white/5 pb-12">
                      <h2 className="text-4xl font-light mb-8 leading-tight">{currentStory.title}</h2>
                      <div className="text-[11px] uppercase tracking-[0.2em] opacity-50 space-y-1 font-sans font-bold">
                        <p>作者: {currentStory.author}</p>
                        <p>时间: {currentStory.date.replace(/-/g, '.')}</p>
                        <p>字数: {currentStory.wordCount?.toLocaleString() || '...'} (自动识别)</p>
                        <a href={currentStory.sourceLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 underline text-current">原链接 →</a>
                      </div>
                    </header>
                    <article style={{ fontSize: `${fontSize}px`, lineHeight: '1.9', whiteSpace: 'pre-wrap' }} className="text-justify">
                      {currentStory.content}
                    </article>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            <footer className="py-12 px-6 border-t border-black/5 dark:border-white/10 text-center opacity-40 text-[10px] tracking-widest font-serif uppercase">
              <div className="max-w-[600px] mx-auto space-y-3 normal-case leading-relaxed mb-6">
                <p>本站仅作为 Postype 平台 녘랜 (花汪) 同人文作品的翻译交流与存档使用，版权归原作者所有。</p>
                <p>站内内容仅供个人学习交流，如有侵权请联系删除，严禁二次转载或用于任何商业用途。</p>
                <p>如有疑问联系微博：@恋花症-</p>
              </div>
              <p className="mt-4 italic font-sans tracking-[0.2em]">© 2026 HW ARCHIVE. 版权所有。</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
