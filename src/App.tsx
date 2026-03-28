/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, ChevronUp, Moon, Sun, ShieldAlert, Heart, BookOpen, X, Sparkles, scroll
} from 'lucide-react';

import Admin from './Admin';

interface Chapter { title: string; fileName: string; autoWordCount?: number; }
interface Story { id: string; title: string; author: string; date: string; fileName?: string; chapters?: Chapter[]; sourceLink: string; wordCount?: number; content?: string; currentChapterTitle?: string; }

export default function App() {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [showChapterList, setShowChapterList] = useState(false); 
  const [fontSize, setFontSize] = useState(18); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasConfirmedAge, setHasConfirmedAge] = useState(false);
  const [isHonest, setIsHonest] = useState(false);
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);

  const ITEMS_PER_PAGE = 8; 
  const [currentPage, setCurrentPage] = useState(1);
  const API_BASE = '/stories/';

  useEffect(() => {
    fetch(`${API_BASE}index.json?v=${Date.now()}`)
      .then(res => res.json())
      .then(data => { 
        setStories(data); 
        setTimeout(() => setLoading(false), 800); 
      })
      .catch(() => setLoading(false));
  }, []);

  const totalPages = Math.ceil(stories.length / ITEMS_PER_PAGE);
  const currentItems = stories.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const latestUpdates = stories.slice(0, 3);

  const handleConfirmAge = () => {
    setHasConfirmedAge(true);
    if (stories.length > 0) setShowUpdateNotice(true);
  };

  const handleStoryClick = async (story: Story) => {
    setCurrentStory(story);
    if (story.chapters && story.chapters.length > 0) {
      setShowChapterList(true);
      story.chapters.forEach(async (ch, idx) => {
        if (!ch.autoWordCount) {
          try {
            const res = await fetch(`${API_BASE}${ch.fileName}?v=${Date.now()}`);
            const text = await res.text();
            const count = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length;
            setStories(prev => prev.map(s => s.id === story.id ? {
              ...s, chapters: s.chapters?.map((c, i) => i === idx ? { ...c, autoWordCount: count } : c)
            } : s));
          } catch (e) {}
        }
      });
    } else { loadFullStory(story, story.fileName!); }
  };

  const loadFullStory = async (parentStory: Story, fileName: string, chapterTitle?: string) => {
    setReading(true);
    try {
      const response = await fetch(`${API_BASE}${fileName}?v=${Date.now()}`);
      const text = await response.text();
      const count = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length;
      setCurrentStory({ ...parentStory, content: text, wordCount: count, currentChapterTitle: chapterTitle });
      setShowChapterList(false); 
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { alert("读取失败"); } 
    finally { setReading(false); }
  };

  const handleBack = () => {
    if (currentStory?.content && currentStory.chapters) {
      setShowChapterList(true);
      setCurrentStory({ ...currentStory, content: undefined });
    } else { setCurrentStory(null); setShowChapterList(false); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyInlineStyles = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\*\*\s*(.*?)\s*\*\*/g, '<strong class="font-black text-slate-900 dark:text-white">$1</strong>')
      .replace(/\*\s*(.*?)\s*\*/g, '<em class="italic opacity-80">$1</em>');
  };

  if (isAdmin) return <Admin onBack={() => setIsAdmin(false)} />;
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#121212]"><div className="text-sm tracking-[0.5em] opacity-30 uppercase font-serif animate-pulse">INITIALIZING...</div></div>;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'dark bg-[#121212] text-[#E0E0E0]' : 'bg-[#F5F5F5] text-[#333333]'} font-serif selection:bg-black/5 bg-noise`}>
      <AnimatePresence mode="wait">
       {!hasConfirmedAge ? (
          <motion.div key="age-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center">
            <AnimatePresence mode="wait">
              {!isHonest ? (
                <motion.div key="question" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="max-w-md w-full">
                  <ShieldAlert className="mx-auto mb-8 opacity-20" size={48} />
                  <h1 className="text-2xl font-bold tracking-[0.3em] mb-4 uppercase">Content Notice</h1>
                  <p className="mb-12 text-xs leading-relaxed opacity-60 tracking-widest text-center">本站存档内容包含部分分级作品（R18），仅供成年人浏览。<br/>继续访问即代表您已年满 18 周岁。</p>
                  <div className="flex flex-col gap-4 items-center">
                    <button onClick={handleConfirmAge} className={`w-48 py-3 border rounded-full text-[10px] font-bold tracking-[0.3em] uppercase transition-all ${isDarkMode ? 'border-white/20 hover:bg-white hover:text-black' : 'border-black/20 hover:bg-black hover:text-white'}`}>I KNOW / 我已知晓</button>
                    <button onClick={() => setIsHonest(true)} className="text-[10px] uppercase tracking-[0.2em] opacity-30 hover:opacity-100 transition-opacity">LEAVE / 离开</button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="honest-msg" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full text-center">
                  <Heart className="mx-auto mb-6 opacity-20 text-red-500" size={40} />
                  <h2 className="text-lg font-bold tracking-[0.2em] mb-4 text-[#333] dark:text-white font-serif italic">期待下次相遇</h2>
                  <p className="text-xs leading-relaxed opacity-60 tracking-widest">喵<br/>喵喵喵</p>
                  <button onClick={() => setIsHonest(false)} className="mt-8 text-[10px] underline opacity-40 uppercase tracking-widest font-sans font-bold">Return</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="main-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col min-h-screen">
            
            {/* 🌟 高级感更新提示框 */}
            <AnimatePresence>
              {showUpdateNotice && !currentStory && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-black/40 backdrop-blur-md">
                  <motion.div 
                    initial={{ scale: 0.98, opacity: 0, y: 10 }} 
                    animate={{ scale: 1, opacity: 1, y: 0 }} 
                    exit={{ scale: 0.98, opacity: 0 }}
                    className="w-full max-w-[480px] relative"
                  >
                    {/* 质感外框 */}
                    <div className="bg-white/90 dark:bg-[#1a1a1a]/95 border border-white/20 dark:border-white/5 p-10 rounded-[2.5rem] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.5)] text-center relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-400/20 to-transparent" />
                      
                      <Sparkles className="mx-auto mb-6 text-slate-400 dark:text-slate-500 animate-pulse" size={20} />
                      
                      <h4 className="text-[10px] uppercase tracking-[0.5em] font-sans font-bold text-slate-400 mb-8">Newly Archived / 最近入库</h4>
                      
                      <div className="space-y-6">
                        {latestUpdates.map((story, i) => (
                          <div key={story.id} className="group/item">
                            <span className="text-[17px] font-serif italic font-black text-slate-800 dark:text-slate-100 tracking-tight leading-snug block mb-1 group-hover/item:text-blue-500 transition-colors">
                              {story.title}
                            </span>
                            <div className="flex items-center justify-center gap-3 text-[9px] font-sans font-bold uppercase tracking-[0.2em] opacity-30">
                              <span>{story.author}</span>
                              <span className="w-1 h-1 bg-current rounded-full" />
                              <span>{story.date?.replace(/-/g, '.')}</span>
                            </div>
                            {i < latestUpdates.length - 1 && <div className="w-8 h-[1px] bg-slate-200 dark:bg-white/5 mx-auto mt-6" />}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 灰色极简圆钮 (位于框下方) */}
                    <button 
                      onClick={() => setShowUpdateNotice(false)}
                      className="mt-10 mx-auto flex items-center justify-center w-12 h-12 bg-slate-800/10 dark:bg-white/10 hover:bg-slate-800/20 dark:hover:bg-white/20 text-slate-500 dark:text-slate-400 rounded-full transition-all active:scale-90 border border-white/10"
                    >
                      <X size={20} />
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <header className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-sm border-b ${isDarkMode ? 'bg-black/30 border-white/10' : 'bg-white/30 border-black/5'}`}>
              <div className="flex items-center gap-4">
                {currentStory ? (
                  <button onClick={handleBack} className={`flex items-center gap-2 text-xs uppercase tracking-widest font-sans font-bold transition-opacity ${isDarkMode ? 'text-white/60 hover:text-white' : 'opacity-60 hover:opacity-100'}`}>
                    <ChevronLeft size={16} /> {showChapterList ? 'Home' : 'Back'}
                  </button>
                ) : ( <h1 className="text-sm uppercase tracking-widest font-sans font-semibold opacity-30">HW / ARCHIVE</h1> )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'text-yellow-400 hover:bg-white/10' : 'text-slate-700 hover:bg-black/5'}`}>
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                {currentStory?.content && (
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
                    <header className="text-center py-12"><h1 className="text-3xl font-bold tracking-[0.2em] mb-4">花汪档案馆</h1></header>
                    <section className="max-w-[700px] mx-auto text-center">
                      {currentItems.map(s => (
                        <motion.button key={s.id} whileHover={{ x: 5 }} onClick={() => handleStoryClick(s)} className={`w-full grid grid-cols-[1fr_auto] py-8 border-b transition-colors text-left ${isDarkMode ? 'border-white/10 hover:border-white/30 text-white' : 'border-black/5 hover:border-black/20 text-[#333]'}`}>
                          <div className="flex items-baseline gap-3"><h3 className="text-xl font-medium mb-1 font-serif italic font-bold">{s.title}</h3>{s.chapters && <BookOpen size={14} className="opacity-30" />}</div>
                          <div className="col-span-full flex gap-4 text-[10px] opacity-40 uppercase tracking-widest font-sans font-bold"><span>{s.author}</span><span>{s.date?.replace(/-/g, '.')}</span>{s.chapters && <span>{s.chapters.length} 章节</span>}</div>
                        </motion.button>
                      ))}
                    </section>
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center gap-12 mt-20 py-10 border-t border-dashed border-black/5 dark:border-white/5">
                        <button onClick={() => { setCurrentPage(p => Math.max(p - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === 1} className={`text-[10px] font-sans font-bold tracking-[0.4em] uppercase transition-all ${currentPage === 1 ? 'opacity-10 cursor-not-allowed' : 'opacity-40 hover:opacity-100 hover:tracking-[0.6em]'}`}>← PREV</button>
                        <span className="text-[10px] font-sans font-bold opacity-20 tracking-[0.3em] uppercase">{currentPage} / {totalPages}</span>
                        <button onClick={() => { setCurrentPage(p => Math.min(p + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === totalPages} className={`text-[10px] font-sans font-bold tracking-[0.4em] uppercase transition-all ${currentPage === totalPages ? 'opacity-10 cursor-not-allowed' : 'opacity-40 hover:opacity-100 hover:tracking-[0.6em]'}`}>NEXT →</button>
                      </div>
                    )}
                  </motion.div>
                ) : showChapterList ? (
                  <motion.div key="chapters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[600px] mx-auto py-12">
                    <div className="mb-12 text-center"><h2 className="text-2xl font-bold font-serif italic">{currentStory.title}</h2><p className="text-xs opacity-40 tracking-widest uppercase font-sans font-bold">Directory / 目录</p></div>
                    <div className="grid gap-4">
                      {currentStory.chapters?.map((chapter, idx) => (
                        <button key={idx} onClick={() => loadFullStory(currentStory, chapter.fileName, chapter.title)} className={`p-6 border rounded-2xl text-left transition-all group flex justify-between items-center ${isDarkMode ? 'border-white/10 hover:bg-white/5' : 'border-black/5 hover:bg-black/5'}`}>
                          <div><span className="text-[10px] opacity-30 block mb-1 font-sans font-bold uppercase tracking-widest">Chapter {idx + 1}</span><span className="text-lg group-hover:pl-2 transition-all duration-300 font-serif font-bold italic">{chapter.title}</span></div>
                          <div className="text-[10px] opacity-30 font-sans tracking-widest uppercase text-right font-bold">{chapter.autoWordCount ? `${chapter.autoWordCount.toLocaleString()} W` : '...'}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[700px] mx-auto">
                    <header className="mb-16 border-b border-black/5 dark:border-white/5 pb-12">
                      <h2 className="text-4xl font-serif font-black italic mb-8 leading-tight">{currentStory.title}{currentStory.currentChapterTitle && (<span className="block text-xl opacity-50 mt-4 font-serif font-medium">— {currentStory.currentChapterTitle}</span>)}</h2>
                      <div className="text-[11px] uppercase tracking-[0.2em] opacity-40 space-y-1 font-sans font-bold"><p>作者: {currentStory.author}</p><p>时间: {currentStory.date?.replace(/-/g, '.')}</p><p>字数: {reading ? '...' : (currentStory.wordCount?.toLocaleString() || '...')}</p></div>
                      <a href={currentStory.sourceLink} target="_blank" rel="noopener noreferrer" className={`inline-block mt-8 text-[13px] font-bold tracking-[0.2em] underline underline-offset-8 decoration-1 transition-opacity ${isDarkMode ? 'text-[#90a4ae] hover:text-[#b0bec5]' : 'text-[#607d8b] hover:text-[#455a64]'}`}>原链接 SOURCE →</a>
                    </header>
                    {reading ? (<div className="py-20 text-center opacity-20 tracking-widest text-xs uppercase animate-pulse font-sans font-bold">Loading Content...</div>) : (
                      <article style={{ fontSize: `${fontSize}px`, lineHeight: '1.9' }} className="text-justify mb-24 font-serif">
                        {(() => {
                          const raw = currentStory.content || '';
                          const cleanRaw = raw.replace(/\r\n/g, '\n');
                          const blockRegex = /(\[quote\][\s\S]*?\[\/quote\]|\[box\][\s\S]*?\[\/box\]|\[bubble:[LR]\][\s\S]*?\[\/bubble\]|\[bvid:[a-zA-Z0-9]+\]|---)/g;
                          const parts = cleanRaw.split(blockRegex);
                          
                          return parts.map((part, idx) => {
                            if (!part) return null;
                            const trimmedPart = part.trim();

                            if (/\[quote\]/.test(part)) {
                              const inner = part.replace(/\[\/?quote\]/g, '').trim();
                              return (<blockquote key={idx} className="my-10 pl-6 border-l-2 border-slate-300 dark:border-slate-700 italic text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-white/5 py-8 rounded-r-3xl">{inner.split('\n').map((l, i) => l.trim() ? <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) }} /> : <div key={i} className="h-4" />)}</blockquote>);
                            }
                            if (/\[box\]/.test(part)) {
                              const inner = part.replace(/\[\/?box\]/g, '').trim();
                              return (<div key={idx} className="my-10 p-8 bg-slate-100/40 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-3xl text-sm leading-relaxed shadow-sm font-sans font-medium">{inner.split('\n').map((l, i) => l.trim() ? <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) }} /> : <div key={i} className="h-4" />)}</div>);
                            }
                            if (/\[bubble:/.test(part)) {
                              const isRight = part.includes(':R');
                              const inner = part.replace(/\[bubble:[LR]\]/g, '').replace(/\[\/bubble\]/g, '').trim();
                              return (<div key={idx} className={`flex ${isRight ? 'justify-end' : 'justify-start'} my-6`}><div className={`max-w-[85%] px-5 py-3 rounded-3xl text-[15px] shadow-sm tracking-tight leading-relaxed ${isRight ? 'bg-[#607d8b] text-white rounded-tr-none' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'}`}>{inner.split('\n').map((l, i) => l.trim() ? <p key={i} className="mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) }} /> : <div key={i} className="h-2" />)}</div></div>);
                            }
                            if (/\[bvid:/.test(part)) {
                              const bvid = part.match(/bvid:\s*([a-zA-Z0-9]+)/)?.[1];
                              return (<div key={idx} className="my-12 aspect-video w-full overflow-hidden rounded-[2.5rem] shadow-2xl bg-black ring-1 ring-white/10"><iframe src={`//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`} className="w-full h-full border-none" allowFullScreen loading="lazy" /></div>);
                            }
                            if (trimmedPart === '---') return <hr key={idx} className="my-20 border-t-2 border-black/5 dark:border-white/5 w-24 mx-auto" />;

                            return part.split('\n').map((line, lIdx) => {
                              if (line === '') return <div key={lIdx} className="h-10" />;
                              return <p key={`${idx}-${lIdx}`} className="mb-6 min-h-[1.5em] leading-[2]" dangerouslySetInnerHTML={{ __html: applyInlineStyles(line) }} />;
                            });
                          });
                        })()}
                      </article>
                    )}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-12 border-t border-dashed border-black/10 dark:border-white/10">
                       <p className="text-xs font-sans font-black uppercase tracking-[0.2em] opacity-30 italic">Support the original author if you like this story.</p>
                       <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 px-8 py-3 rounded-full text-[10px] font-sans font-black uppercase tracking-[0.3em] transition-all border border-black/10 dark:border-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black">Top / 回到顶部 <ChevronUp size={14} /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
            <footer className="py-24 px-6 border-t border-black/5 dark:border-white/10 text-center opacity-30 text-[9px] tracking-[0.4em] font-sans font-black uppercase">
              <div className="max-w-[600px] mx-auto space-y-4 normal-case leading-relaxed mb-16 tracking-widest font-serif italic">
                <p>本站仅作为 Postype 平台 녘랜 (花汪) 同人文作品的翻译交流与存档使用。</p>
                <p>所有版权归原作者所有，如有侵权请联系删除。</p>
              </div>
              <p onClick={(e) => { if (e.detail === 5) setIsAdmin(true); }} className="cursor-default select-none hover:opacity-100 transition-opacity">© 2026 HW ARCHIVE Studio.</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
