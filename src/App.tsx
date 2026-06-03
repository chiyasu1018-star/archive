/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronUp, Moon, Sun, ShieldAlert, Heart, BookOpen, X, Clock } from 'lucide-react';
import Admin from './Admin';
import { Analytics } from '@vercel/analytics/react'; 

// --- CONFIGURATION ---
const GITHUB_OWNER = "chiyasu1018-star"; 
const GITHUB_REPO = "archive";       
const CACHE_KEY = "github_commit_cache";
const CACHE_EXPIRY = 3600000; 

const LIVE_INDEX_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/public/stories/index.json`;
const LIVE_LOGS_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/public/stories/logs.json`;

interface Chapter { title: string; fileName: string; autoWordCount?: number; lastModified?: number; }
interface Story { 
  id: string; 
  title: string; 
  author: string; 
  date: string; 
  fileName?: string; 
  chapters?: Chapter[]; 
  sourceLink: string; 
  wordCount?: number; 
  content?: string; 
  currentChapterTitle?: string;
  lastGitUpdate?: number; 
  latestChapterTitle?: string;
  isR18?: boolean;
}

interface UpdateLog {
  date: string;
  content: string;
}

export default function App() {
  const [stories, setStories] = useState<Story[]>([]);
  const [logs, setLogs] = useState<UpdateLog[]>([]); // 🌟 日志状态
  const [showLogs, setShowLogs] = useState(false);   // 🌟 弹窗状态
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [showChapterList, setShowChapterList] = useState(false); 
  const [fontSize, setFontSize] = useState(18); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasConfirmedAge, setHasConfirmedAge] = useState(false);
  const [isHonest, setIsHonest] = useState(false);

  const ITEMS_PER_PAGE = 8; 
  const [currentPage, setCurrentPage] = useState(1);
  const API_BASE = '/stories/';

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) setIsDarkMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    // 同时获取文章和日志
    Promise.all([
      fetch(`${LIVE_INDEX_URL}?v=${Date.now()}`).then(res => res.json()),
      fetch(`${LIVE_LOGS_URL}?v=${Date.now()}`).then(res => res.json()).catch(() => [])
    ]).then(([storyData, logsData]) => {
      setStories(storyData || []);
      setLogs(logsData || []);
      setTimeout(() => setLoading(false), 800); 
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') setIsAdmin(true);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  const totalPages = Math.ceil(stories.length / ITEMS_PER_PAGE);
  const currentItems = stories.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleConfirmAge = () => setHasConfirmedAge(true);

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
      setShowChapterList(false); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { alert("读取文章失败"); } finally { setReading(false); }
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
      .replace(/\*\*\s*(.*?)\s*\*\*/g, `<strong class="font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}">$1</strong>`)
      .replace(/\*\s*(.*?)\s*\*/g, '<em class="italic opacity-80">$1</em>');
  };

  if (isAdmin) return <Admin onBack={() => setIsAdmin(false)} />;
  if (loading) return <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#F5F5F5] text-black'}`}><div className="text-sm tracking-[0.5em] opacity-30 uppercase font-serif animate-pulse">INITIALIZING...</div></div>;

  return (
    <div className={`min-h-screen transition-colors duration-700 ${isDarkMode ? 'dark bg-[#0a0a0a] text-slate-200' : 'bg-[#F5F5F5] text-[#333333]'} font-serif selection:bg-blue-500/20 bg-noise`}>
      <AnimatePresence mode="wait">
       {!hasConfirmedAge ? (
          <motion.div key="age-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center">
            <AnimatePresence mode="wait">
              {!isHonest ? (
                <motion.div key="question" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="max-w-md w-full">
                  <ShieldAlert className={`mx-auto mb-8 opacity-20 ${isDarkMode ? 'text-white' : 'text-black'}`} size={48} />
                  <h1 className={`text-2xl font-bold tracking-[0.3em] mb-4 uppercase ${isDarkMode ? 'text-white' : 'text-black'}`}>Content Notice</h1>
                  <p className={`mb-12 text-xs leading-relaxed tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-black/60'}`}>本站存档内容包含部分分级作品（R18）仅供成年人浏览 <br/>继续访问即代表您已年满 18 周岁。</p>
                  <div className="flex flex-col gap-4 items-center">
                    <button onClick={handleConfirmAge} className={`w-48 py-3 border rounded-full text-[10px] font-black tracking-[0.3em] uppercase transition-all ${isDarkMode ? 'border-white/40 hover:bg-white hover:text-black bg-white/5' : 'border-black/20 hover:bg-black hover:text-white bg-black/5'}`}>I KNOW / 我已知晓</button>
                    <button onClick={() => setIsHonest(true)} className={`text-[10px] uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>LEAVE / 离开</button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="honest-msg" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
                  <Heart className="mx-auto mb-6 opacity-20 text-red-500" size={40} />
                  <h2 className={`text-lg font-bold tracking-[0.2em] mb-4 italic ${isDarkMode ? 'text-white' : 'text-black'}`}>期待下次相遇</h2>
                  <p className={`text-xs leading-relaxed opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-black'}`}>喵<br/>喵喵喵</p>
                  <button onClick={() => setIsHonest(false)} className={`mt-8 text-[10px] underline opacity-40 uppercase font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>Return</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="main-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col min-h-screen">
            
            <header className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-sm border-b ${isDarkMode ? 'bg-black/60 border-white/10' : 'bg-white/30 border-black/5'}`}>
              <div className="flex items-center gap-4">
                {currentStory ? (
                  <button onClick={handleBack} className={`flex items-center gap-2 text-xs uppercase tracking-widest font-sans font-black transition-opacity ${isDarkMode ? 'text-white/80 hover:text-white' : 'opacity-60 hover:opacity-100 text-black'}`}>
                    <ChevronLeft size={16} /> {showChapterList ? 'Home' : 'Back'}
                  </button>
                ) : ( 
                  <div className="flex items-center gap-4">
                    <h1 className={`text-sm uppercase tracking-widest font-sans font-black opacity-30 ${isDarkMode ? 'text-white' : 'text-black'}`}>HW / ARCHIVE</h1>
                    {/* 🌟 日志入口按钮 */}
                    <button onClick={() => setShowLogs(true)} className={`text-[10px] uppercase tracking-[0.2em] font-sans font-black px-2 py-1 rounded border transition-all ${isDarkMode ? 'border-white/10 text-white/40 hover:text-white hover:border-white/30' : 'border-black/5 text-black/40 hover:text-black hover:border-black/20'}`}>Logs</button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'text-yellow-400 hover:bg-white/10' : 'text-slate-700 hover:bg-black/5'}`}>
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                {currentStory?.content && (
                  <div className={`flex gap-1 ml-2 font-sans font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    <button onClick={() => setFontSize(f => Math.max(f-2, 14))} className="w-8 h-8 text-xs">A-</button>
                    <button onClick={() => setFontSize(f => Math.min(f+2, 28))} className="w-8 h-8 text-lg">A+</button>
                  </div>
                )}
              </div>
            </header>

            {/* 🌟 更新日志弹窗渲染 */}
            <AnimatePresence>
              {showLogs && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
                  <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className={`max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-white border-black/5 text-black'}`}>
                    <div className="p-6 border-b flex justify-between items-center dark:border-white/10">
                       <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2"><Clock size={14}/> 更新日志 </h2>
                       <button onClick={() => setShowLogs(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"><X size={18}/></button>
                    </div>
                    <div className="p-8 overflow-y-auto space-y-8 font-sans">
                      {logs.length > 0 ? logs.map((log, i) => (
                        <div key={i} className="space-y-2">
                           <div className="text-[10px] font-black opacity-30 tracking-widest">{log.date}</div>
                           <div className="text-sm leading-relaxed opacity-70 whitespace-pre-wrap">{log.content}</div>
                        </div>
                      )) : <div className="text-center py-20 opacity-20 text-xs tracking-widest uppercase">No Logs Yet</div>}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <main className="pt-24 pb-20 px-6 max-w-4xl mx-auto flex-grow w-full">
              <AnimatePresence mode="wait">
                {!currentStory ? (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <header className="text-center py-12"><h1 className={`text-3xl font-black tracking-[0.2em] mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>花汪档案馆</h1></header>
                    <section className="max-w-[700px] mx-auto">
                      {currentItems.map(s => {
                        return (
                          <motion.button key={s.id} whileHover={{ x: 5 }} onClick={() => handleStoryClick(s)} className={`w-full grid grid-cols-[1fr_auto] py-8 border-b transition-colors text-left ${isDarkMode ? 'border-white/10 hover:border-white/30 text-white' : 'border-black/5 hover:border-black/20 text-[#333]'}`}>
                            <div className="flex justify-between items-baseline w-full">
                              <div className="flex items-baseline gap-3"><h3 className="text-xl font-black mb-1 font-serif italic">{s.title}</h3>{s.chapters && <BookOpen size={14} className="opacity-30" />}</div>
                              {s.isR18 && (
                                <span className={`text-[9px] font-sans font-black tracking-[0.2em] px-1.5 py-0.5 rounded border leading-none shrink-0 ml-4 ${
                                  isDarkMode ? 'border-red-500/40 text-red-500 bg-red-500/5' : 'border-red-600/20 text-red-600 bg-red-600/5'
                                }`}>R18</span>
                              )}
                            </div>
                            <div className="col-span-full flex gap-4 text-[10px] opacity-50 dark:opacity-70 uppercase tracking-widest font-sans font-black"><span>{s.author}</span>{s.chapters && <span>{s.chapters.length} 章节</span>}</div>
                          </motion.button>
                        );
                      })}
                    </section>
                    {totalPages > 1 && (
                      <div className={`flex justify-center items-center gap-12 mt-20 py-10 border-t border-dashed ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
                        <button onClick={() => { setCurrentPage(p => Math.max(p - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === 1} className={`text-[10px] font-sans font-black tracking-[0.4em] uppercase transition-all ${currentPage === 1 ? 'opacity-10' : `opacity-60 hover:opacity-100 ${isDarkMode ? 'text-white' : 'text-black'}`}`}>← PREV</button>
                        <span className={`text-[10px] font-sans font-black opacity-30 ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentPage} / {totalPages}</span>
                        <button onClick={() => { setCurrentPage(p => Math.min(p + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === totalPages} className={`text-[10px] font-sans font-black tracking-[0.4em] uppercase transition-all ${currentPage === totalPages ? 'opacity-10' : `opacity-60 hover:opacity-100 ${isDarkMode ? 'text-white' : 'text-black'}`}`}>NEXT →</button>
                      </div>
                    )}
                  </motion.div>
                ) : showChapterList ? (
                  <motion.div key="chapters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[600px] mx-auto py-12 text-center">
                    <div className="mb-12"><h2 className={`text-2xl font-black font-serif italic ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentStory.title}</h2><p className={`text-xs opacity-40 tracking-widest uppercase font-sans font-black ${isDarkMode ? 'text-slate-400' : 'text-black'}`}>Directory / 目录</p></div>
                    <div className="grid gap-4">
                      {currentStory.chapters?.map((chapter, idx) => (
                        <button key={idx} onClick={() => loadFullStory(currentStory, chapter.fileName, chapter.title)} className={`p-6 border rounded-2xl text-left transition-all group flex justify-between items-center ${isDarkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-black/5 bg-white hover:bg-black/5'}`}>
                          <div><span className={`text-[10px] opacity-30 dark:opacity-50 block mb-1 font-sans font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-black'}`}>Chapter {idx + 1}</span><span className={`text-lg group-hover:pl-2 transition-all duration-300 font-serif font-black italic ${isDarkMode ? 'text-white' : 'text-black'}`}>{chapter.title}</span></div>
                          <div className={`text-[10px] opacity-30 dark:opacity-50 font-sans tracking-widest uppercase text-right font-black ${isDarkMode ? 'text-slate-400' : 'text-black'}`}>{chapter.autoWordCount ? `${chapter.autoWordCount.toLocaleString()} 字` : '...'}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[700px] mx-auto text-center">
                    <header className={`mb-16 border-b pb-12 font-sans ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
                      <h2 className={`text-4xl font-serif font-black italic mb-8 leading-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentStory.title}{currentStory.currentChapterTitle && (<span className="block text-xl opacity-60 mt-4 font-serif font-medium">— {currentStory.currentChapterTitle}</span>)}</h2>
                      <div className={`text-[11px] uppercase tracking-[0.2em] opacity-50 dark:opacity-70 space-y-1 font-black ${isDarkMode ? 'text-slate-300' : 'text-black'}`}><p>作者: {currentStory.author}</p><p>字数: {reading ? '...' : (currentStory.wordCount?.toLocaleString() || '...')}</p></div>
                      <a href={currentStory.sourceLink} target="_blank" rel="noopener noreferrer" className={`inline-block mt-8 text-[13px] font-black tracking-[0.2em] underline underline-offset-8 decoration-1 transition-opacity ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-[#607d8b] hover:text-[#455a64]'}`}>原链接 SOURCE →</a>
                    </header>
                    {reading ? (<div className={`py-20 text-center opacity-20 tracking-widest text-xs uppercase animate-pulse ${isDarkMode ? 'text-white' : 'text-black'}`}>Loading Content...</div>) : (
                      <>
                        <article style={{ fontSize: `${fontSize}px`, lineHeight: '1.9' }} className={`text-justify mb-24 font-serif ${isDarkMode ? 'text-slate-200' : 'text-[#333]'}`}>
                          {(() => {
                            const raw = currentStory.content || '';
                            const cleanRaw = raw.replace(/\r\n/g, '\n');
                            const blockRegex = /(\[\s*quote\s*\][\s\S]*?\[\s*\/quote\s*\]|\[\s*box\s*\][\s\S]*?\[\s*\/box\s*\]|\[\s*bubble:[LR]\s*\][\s\S]*?\[\s*\/bubble\s*\]|\[\s*bvid:[a-zA-Z0-9]+\s*\]|\[\s*youtube:[a-zA-Z0-9_-]+\s*\]|---)/g;
                            const parts = cleanRaw.split(blockRegex);
                            return parts.map((part, idx) => {
                              if (!part) return null;
                              const trimmedPart = part.trim();
                              if (/\[\s*quote\s*\]/.test(part)) {
                                const inner = part.replace(/\[\s*\/?quote\s*\]/g, '').trim();
                                return (<blockquote key={idx} className={`my-8 pl-5 border-l-4 italic py-6 rounded-r-xl ${isDarkMode ? 'border-slate-600 bg-white/5 text-slate-400' : 'border-slate-300 bg-slate-100/30 text-slate-500'}`}>{inner.split('\n').map((l, i) => l.trim() ? <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) }} /> : <div key={i} className="h-4" />)}</blockquote>);
                              }
                              if (/\[\s*box\s*\]/.test(part)) {
                                const inner = part.replace(/\[\s*\/?box\s*\]/g, '').trim();
                                return (<div key={idx} className={`my-10 p-8 border rounded-2xl text-sm leading-relaxed shadow-sm ${isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>{inner.split('\n').map((l, i) => l.trim() ? <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) }} /> : <div key={i} className="h-4" />)}</div>);
                              }
                              if (/\[\s*bubble:/.test(part)) {
                                const isRight = part.includes(':R');
                                const inner = part.replace(/\[\s*bubble:[LR]\s*\]/g, '').replace(/\[\s*\/bubble\s*\]/g, '').trim();
                                return (
                                  <div key={idx} className={`flex ${isRight ? 'justify-end' : 'justify-start'} -my-4 leading-none relative z-10`}>
                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm tracking-tight leading-normal my-1 ${isRight ? 'bg-[#607d8b] text-white rounded-tr-none' : (isDarkMode ? 'bg-white/10 text-slate-100' : 'bg-slate-200 text-slate-800')}`}>
                                      {inner.split('\n').map((l, i) => l.trim() ? <p key={i} className="mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) }} /> : <div key={i} className="h-1" />)}
                                    </div>
                                  </div>
                                );
                              }
                              if (/\[\s*bvid:/.test(part)) {
                                const bvid = part.match(/bvid:\s*([a-zA-Z0-9]+)/)?.[1];
                                return (<div key={idx} className="my-10 aspect-video w-full overflow-hidden rounded-2xl shadow-2xl bg-black ring-1 ring-white/10"><iframe src={`//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`} className="w-full h-full border-none" allowFullScreen loading="lazy" /></div>);
                              }
                              if (/\[\s*youtube:/.test(part)) {
                                const ytid = part.match(/youtube:\s*([a-zA-Z0-9_-]+)/)?.[1];
                                return (<div key={idx} className="my-10 aspect-video w-full overflow-hidden rounded-2xl shadow-2xl bg-black ring-1 ring-white/10"><iframe src={`https://www.youtube.com/embed/${ytid}`} className="w-full h-full border-none" allowFullScreen loading="lazy" /></div>);
                              }
                              if (trimmedPart === '---') return <hr key={idx} className={`my-16 border-t ${isDarkMode ? 'border-white/10' : 'border-black/10'}`} />;
                              return part.split('\n').map((line, lIdx) => {
                                if (line === '') return <div key={lIdx} className="h-8" />;
                                return <p key={`${idx}-${lIdx}`} className="mb-5 min-h-[1.5em]" dangerouslySetInnerHTML={{ __html: applyInlineStyles(line) }} />;
                              });
                            });
                          })()}
                        </article>

                        {currentStory.chapters && currentStory.chapters.length > 1 && (
                          <div className={`flex justify-between items-center py-12 border-t mt-16 gap-4 ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
                            {(() => {
                              const chapters = currentStory.chapters;
                              const currentIndex = chapters.findIndex(c => c.title === currentStory.currentChapterTitle);
                              return (
                                <>
                                  <div className="flex-1 text-left">
                                    {currentIndex > 0 && (
                                      <button onClick={() => loadFullStory(currentStory, chapters[currentIndex - 1].fileName, chapters[currentIndex - 1].title)} className={`group flex flex-col gap-2 transition-all text-left ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/30 hover:text-black'}`}>
                                        <span className="text-[9px] uppercase tracking-[0.2em] font-sans font-black flex items-center gap-1"><ChevronLeft size={12} /> Previous / 上一章</span>
                                        <span className="text-sm font-serif italic font-bold">{chapters[currentIndex - 1].title}</span>
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex-1 text-right">
                                    {currentIndex < chapters.length - 1 && (
                                      <button onClick={() => loadFullStory(currentStory, chapters[currentIndex + 1].fileName, chapters[currentIndex + 1].title)} className={`group flex flex-col items-end gap-2 transition-all ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/30 hover:text-black'}`}>
                                        <span className="text-[9px] uppercase tracking-[0.2em] font-sans font-black flex items-center gap-1">Next / 下一章 <ChevronLeft size={12} className="rotate-180" /></span>
                                        <span className="text-sm font-serif italic font-bold">{chapters[currentIndex + 1].title}</span>
                                      </button>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                    <div className={`flex flex-col sm:flex-row items-center justify-between gap-6 py-12 border-t border-dashed ${isDarkMode ? 'border-white/20' : 'border-black/10'}`}>
                       <p className={`text-sm font-black tracking-widest ${isDarkMode ? 'text-white/60' : 'text-black/40'}`}>如果喜欢这篇文章，请务必去支持一下原作者。</p>
                       <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-black tracking-[0.2em] uppercase transition-all border ${isDarkMode ? 'border-white/30 hover:bg-white hover:text-black text-white' : 'border-black/10 hover:bg-black hover:text-white text-black'}`}>Top / 回到顶部 <ChevronUp size={14} /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
            <footer className={`py-20 px-6 border-t text-center opacity-40 text-[10px] tracking-widest font-serif uppercase ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-black/5 text-black'}`}>
              <div className="max-w-[600px] mx-auto space-y-3 normal-case leading-relaxed mb-12 text-center font-black"><p>本站仅作为 Postype 平台 녘랜 (花汪) 同人文作品的翻译交流与存档使用，版权归原作者所有。</p><p>站内内容全是机翻，如有侵权请联系删除。</p><p className="font-bold">联系微博：<span>@恋花症-</span></p></div>
              <p onClick={(e) => { if (e.detail === 5) setIsAdmin(true); }} className="italic font-sans tracking-[0.2em] cursor-default select-none text-center">© 2026 HW ARCHIVE.</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
      <Analytics />
    </div>
  );
}
