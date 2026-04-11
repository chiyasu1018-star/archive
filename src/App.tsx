/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronUp, Moon, Sun, ShieldAlert, Heart, BookOpen } from 'lucide-react';
import Admin from './Admin';
import { Analytics } from '@vercel/analytics/react';
import { renderStoryArticleBody } from './storyContent'; 

// --- CONFIGURATION ---
const GITHUB_OWNER = "chiyasu1018-star"; 
const GITHUB_REPO = "archive";       
const CACHE_KEY = "github_commit_cache";
const CACHE_EXPIRY = 3600000; 

// 实时数据源链接
const LIVE_INDEX_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/public/stories/index.json`;

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
}

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
  /** 移动端文章页：点击中央区域切换顶栏与底部操作区 */
  const [readingChromeVisible, setReadingChromeVisible] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );
  const readingChromeToggleAt = useRef(0);

  const ITEMS_PER_PAGE = 8; 
  const [currentPage, setCurrentPage] = useState(1);
  const API_BASE = '/stories/';

  const fetchRealTimestamps = async (baseStories: Story[]) => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) return data;
      }
      const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?path=stories&per_page=100`);
      if (!response.ok) throw new Error("API Limit");
      const updatedStories = await Promise.all(baseStories.map(async (story) => {
        const filesToTrack = story.chapters ? story.chapters.map(c => c.fileName) : [story.fileName];
        let latestTime = 0; let latestChapterName = "";
        for (const file of filesToTrack) {
          if (!file) continue;
          const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?path=stories/${file}&per_page=1`);
          const data = await res.json();
          if (data && data.length > 0) {
            const time = new Date(data[0].commit.committer.date).getTime();
            if (time > latestTime) { latestTime = time; latestChapterName = story.chapters?.find(c => c.fileName === file)?.title || ""; }
          }
        }
        return { ...story, lastGitUpdate: latestTime || new Date(story.date).getTime(), latestChapterTitle: latestChapterName };
      }));
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: updatedStories, timestamp: Date.now() }));
      return updatedStories;
    } catch (error) { return baseStories; }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) setIsDarkMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobileViewport(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isReadingArticle = Boolean(currentStory?.content && !showChapterList && !reading);
  const isImmersiveReading = isMobileViewport && isReadingArticle;

  useEffect(() => {
    if (isReadingArticle) setReadingChromeVisible(false);
  }, [isReadingArticle, currentStory?.id, currentStory?.content, showChapterList, reading]);

  useEffect(() => {
    fetch(`${LIVE_INDEX_URL}?v=${Date.now()}`)
      .then(res => res.json())
      .then(async (data) => { 
        const enrichedData = await fetchRealTimestamps(data);
        const sorted = enrichedData.sort((a: Story, b: Story) => (b.lastGitUpdate || 0) - (a.lastGitUpdate || 0));
        setStories(sorted); 
        setTimeout(() => setLoading(false), 800); 
      })
      .catch(() => setLoading(false));
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

  const toggleReadingChromeFromCenter = (clientX: number, clientY: number) => {
    if (!isImmersiveReading) return;
    const x = clientX / window.innerWidth;
    const y = clientY / window.innerHeight;
    if (x < 0.3 || x > 0.7 || y < 0.3 || y > 0.7) return;
    const now = Date.now();
    if (now - readingChromeToggleAt.current < 320) return;
    readingChromeToggleAt.current = now;
    setReadingChromeVisible((v) => !v);
  };

  const onReadingContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isImmersiveReading) return;
    const t = e.target as HTMLElement;
    if (t.closest('a, button, iframe, input, textarea, select, [data-no-chrome-toggle]')) return;
    toggleReadingChromeFromCenter(e.clientX, e.clientY);
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
                  <p className={`mb-12 text-xs leading-relaxed tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-black/60'}`}>本站存档内容包含部分分级作品（R18），仅供成年人浏览。<br/>继续访问即代表您已年满 18 周岁。</p>
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
            
            <motion.header
              className={`fixed top-0 left-0 right-0 z-50 px-5 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4 flex justify-between items-center backdrop-blur-sm border-b ${isDarkMode ? 'bg-black/60 border-white/10' : 'bg-white/30 border-black/5'}`}
              initial={false}
              animate={
                isImmersiveReading
                  ? { y: readingChromeVisible ? 0 : '-100%', opacity: readingChromeVisible ? 1 : 0 }
                  : { y: 0, opacity: 1 }
              }
              transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.85 }}
              style={{ pointerEvents: isImmersiveReading && !readingChromeVisible ? 'none' : 'auto' }}
            >
              <div className="flex items-center gap-4">
                {currentStory ? (
                  <button type="button" onClick={handleBack} className={`flex min-h-[44px] min-w-[44px] items-center gap-2 text-xs uppercase tracking-widest font-sans font-black transition-opacity ${isDarkMode ? 'text-white/80 hover:text-white' : 'opacity-60 hover:opacity-100 text-black'}`}>
                    <ChevronLeft size={16} /> {showChapterList ? 'Home' : 'Back'}
                  </button>
                ) : ( <h1 className={`text-sm uppercase tracking-widest font-sans font-black opacity-30 ${isDarkMode ? 'text-white' : 'text-black'}`}>HW / ARCHIVE</h1> )}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'text-yellow-400 hover:bg-white/10' : 'text-slate-700 hover:bg-black/5'}`}>
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                {currentStory?.content && (
                  <div className={`flex gap-1 ml-2 font-sans font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    <button type="button" onClick={() => setFontSize(f => Math.max(f-2, 14))} className="min-h-[44px] min-w-[44px] text-xs">A-</button>
                    <button type="button" onClick={() => setFontSize(f => Math.min(f+2, 28))} className="min-h-[44px] min-w-[44px] text-lg">A+</button>
                  </div>
                )}
              </div>
            </motion.header>
            <main
              className={`max-w-4xl mx-auto flex-grow w-full px-5 sm:px-6 md:px-8 transition-[padding] duration-300 ease-out ${
                isImmersiveReading && readingChromeVisible
                  ? 'pt-24 pb-44 max-md:pb-[min(18rem,calc(env(safe-area-inset-bottom)+15rem))]'
                  : isImmersiveReading && !readingChromeVisible
                    ? 'pt-[max(0.5rem,env(safe-area-inset-top))] pb-24'
                    : 'pt-24 pb-20'
              }`}
            >
              <AnimatePresence mode="wait">
                {!currentStory ? (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <header className="text-center py-12"><h1 className={`text-3xl font-black tracking-[0.2em] mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>花汪档案馆</h1></header>
                    <section className="max-w-[700px] mx-auto">
                      {currentItems.map(s => {
                        const isNew = s.lastGitUpdate && (Date.now() - s.lastGitUpdate < 48 * 60 * 60 * 1000);
                        return (
                          <motion.button key={s.id} whileHover={{ x: 5 }} onClick={() => handleStoryClick(s)} className={`w-full grid grid-cols-[1fr_auto] py-8 border-b transition-colors text-left ${isDarkMode ? 'border-white/10 hover:border-white/30 text-white' : 'border-black/5 hover:border-black/20 text-[#333]'}`}>
                            <div className="flex justify-between items-baseline w-full">
                              <div className="flex items-baseline gap-3"><h3 className="text-xl font-black mb-1 font-serif italic">{s.title}</h3>{s.chapters && <BookOpen size={14} className="opacity-30" />}</div>
                              {isNew && (<div className="flex items-center gap-2 pr-2"><span className="text-[8px] font-black tracking-widest opacity-30 uppercase font-sans">New</span><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span></div>)}
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
                  <motion.div
                    key="content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-[700px] mx-auto text-center touch-manipulation"
                    onClick={onReadingContentClick}
                  >
                    <header className={`mb-12 max-md:mb-10 border-b pb-10 max-md:pb-8 font-sans ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
                      <h2 className={`text-3xl max-md:text-[1.65rem] font-serif font-black italic mb-6 max-md:mb-5 leading-snug max-md:leading-snug ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentStory.title}{currentStory.currentChapterTitle && (<span className="block text-lg max-md:text-base opacity-60 mt-3 max-md:mt-2 font-serif font-medium">— {currentStory.currentChapterTitle}</span>)}</h2>
                      <div className={`text-[11px] uppercase tracking-[0.2em] opacity-50 dark:opacity-70 space-y-1 font-black ${isDarkMode ? 'text-slate-300' : 'text-black'}`}><p>作者: {currentStory.author}</p><p>字数: {reading ? '...' : (currentStory.wordCount?.toLocaleString() || '...')}</p></div>
                      <a href={currentStory.sourceLink} target="_blank" rel="noopener noreferrer" className={`inline-block mt-8 text-[13px] font-black tracking-[0.2em] underline underline-offset-8 decoration-1 transition-opacity ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-[#607d8b] hover:text-[#455a64]'}`}>原链接 SOURCE →</a>
                    </header>
                    {reading ? (<div className={`py-20 text-center opacity-20 tracking-widest text-xs uppercase animate-pulse ${isDarkMode ? 'text-white' : 'text-black'}`}>Loading Content...</div>) : (
                      <>
                        <article
                          style={{
                            fontSize: `${fontSize}px`,
                            lineHeight: isMobileViewport ? 2.05 : 1.9,
                          }}
                          className={`text-justify mb-20 max-md:mb-14 font-serif max-md:tracking-[0.02em] ${isDarkMode ? 'text-slate-200' : 'text-[#333]'}`}
                        >
                          {renderStoryArticleBody(currentStory.content || '', isDarkMode)}
                        </article>

                        {currentStory.chapters && currentStory.chapters.length > 1 && (
                          <div className={`${isImmersiveReading ? 'hidden md:flex' : 'flex'} justify-between items-center py-12 border-t mt-16 gap-4 ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
                            {(() => {
                              const chapters = currentStory.chapters!;
                              const currentIndex = chapters.findIndex(c => c.title === currentStory.currentChapterTitle);
                              return (
                                <>
                                  <div className="flex-1 text-left">
                                    {currentIndex > 0 && (
                                      <button type="button" data-no-chrome-toggle onClick={() => loadFullStory(currentStory, chapters[currentIndex - 1].fileName, chapters[currentIndex - 1].title)} className={`group flex min-h-[48px] flex-col gap-2 transition-all text-left ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/30 hover:text-black'}`}>
                                        <span className="text-[9px] uppercase tracking-[0.2em] font-sans font-black flex items-center gap-1"><ChevronLeft size={12} /> Previous / 上一章</span>
                                        <span className="text-sm font-serif italic font-bold">{chapters[currentIndex - 1].title}</span>
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex-1 text-right">
                                    {currentIndex < chapters.length - 1 && (
                                      <button type="button" data-no-chrome-toggle onClick={() => loadFullStory(currentStory, chapters[currentIndex + 1].fileName, chapters[currentIndex + 1].title)} className={`group flex min-h-[48px] flex-col items-end gap-2 transition-all ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/30 hover:text-black'}`}>
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
                    <div className={`${isImmersiveReading ? 'hidden md:flex' : 'flex'} flex-col sm:flex-row items-center justify-between gap-6 py-12 border-t border-dashed ${isDarkMode ? 'border-white/20' : 'border-black/10'}`}>
                      <p className={`text-center text-sm max-md:text-xs font-black tracking-widest max-md:leading-relaxed ${isDarkMode ? 'text-white/60' : 'text-black/40'}`}>如果喜欢这篇文章，请务必去支持一下原作者。</p>
                      <button type="button" data-no-chrome-toggle onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`flex min-h-[48px] items-center justify-center gap-2 px-8 max-md:w-full max-md:max-w-sm rounded-full text-[10px] font-black tracking-[0.2em] uppercase transition-all border ${isDarkMode ? 'border-white/30 hover:bg-white hover:text-black text-white' : 'border-black/10 hover:bg-black hover:text-white text-black'}`}>Top / 回到顶部 <ChevronUp size={14} /></button>
                    </div>
                    {isImmersiveReading && !reading && (
                      <motion.div
                        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
                        initial={false}
                        animate={{ y: readingChromeVisible ? 0 : '115%' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 36, mass: 0.9 }}
                        style={{ pointerEvents: readingChromeVisible ? 'auto' : 'none' }}
                      >
                        <div
                          className={`mx-auto max-w-[700px] space-y-3 border-t px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] shadow-[0_-16px_48px_-12px_rgba(0,0,0,0.18)] dark:shadow-[0_-16px_48px_-12px_rgba(0,0,0,0.45)] ${isDarkMode ? 'border-white/15 bg-[#0a0a0a]/92 backdrop-blur-xl' : 'border-black/10 bg-[#f5f5f5]/92 backdrop-blur-xl'}`}
                          data-no-chrome-toggle
                        >
                          {currentStory.chapters && currentStory.chapters.length > 1 && (() => {
                            const chapters = currentStory.chapters;
                            const currentIndex = chapters.findIndex(c => c.title === currentStory.currentChapterTitle);
                            return (
                              <div className="flex flex-col gap-2.5">
                                {currentIndex > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => loadFullStory(currentStory, chapters[currentIndex - 1].fileName, chapters[currentIndex - 1].title)}
                                    className={`min-h-[54px] w-full rounded-xl border px-4 py-3 text-left transition-colors active:scale-[0.99] ${isDarkMode ? 'border-white/15 bg-white/5 hover:bg-white/10' : 'border-black/10 bg-white/80 hover:bg-white'}`}
                                  >
                                    <span className="text-[10px] font-sans font-black uppercase tracking-widest opacity-50 flex items-center gap-1"><ChevronLeft size={14} /> 上一章</span>
                                    <span className={`mt-1 block text-base font-serif font-bold leading-snug ${isDarkMode ? 'text-white' : 'text-black'}`}>{chapters[currentIndex - 1].title}</span>
                                  </button>
                                )}
                                {currentIndex < chapters.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => loadFullStory(currentStory, chapters[currentIndex + 1].fileName, chapters[currentIndex + 1].title)}
                                    className={`min-h-[54px] w-full rounded-xl border px-4 py-3 text-left transition-colors active:scale-[0.99] ${isDarkMode ? 'border-white/15 bg-white/5 hover:bg-white/10' : 'border-black/10 bg-white/80 hover:bg-white'}`}
                                  >
                                    <span className="text-[10px] font-sans font-black uppercase tracking-widest opacity-50 flex items-center gap-1">下一章 <ChevronLeft size={14} className="rotate-180" /></span>
                                    <span className={`mt-1 block text-base font-serif font-bold leading-snug ${isDarkMode ? 'text-white' : 'text-black'}`}>{chapters[currentIndex + 1].title}</span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                          <div className={`flex flex-col gap-3 border-t border-dashed pt-3 ${isDarkMode ? 'border-white/15' : 'border-black/10'}`}>
                            <p className={`text-center text-xs font-black tracking-widest leading-relaxed ${isDarkMode ? 'text-white/55' : 'text-black/45'}`}>如果喜欢这篇文章，请务必去支持一下原作者。</p>
                            <button
                              type="button"
                              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                              className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[11px] font-black tracking-[0.2em] uppercase transition-all border ${isDarkMode ? 'border-white/25 bg-white/5 text-white hover:bg-white hover:text-black' : 'border-black/15 bg-white text-black hover:bg-black hover:text-white'}`}
                            >
                              Top / 回到顶部 <ChevronUp size={16} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
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
