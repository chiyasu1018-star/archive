/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronUp, Moon, Sun, ShieldAlert, Heart, BookOpen, X } from 'lucide-react';
import Admin from './Admin';

// --- CONFIGURATION: SET YOUR GITHUB DETAILS HERE ---
const GITHUB_OWNER = "YOUR_GITHUB_USERNAME"; // e.g., "chiyasu1018-star"
const GITHUB_REPO = "YOUR_REPO_NAME";       // e.g., "archive"
const CACHE_KEY = "github_commit_cache";
const CACHE_EXPIRY = 3600000; // 1 hour

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
  // New field for sorting
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
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);

  const ITEMS_PER_PAGE = 8; 
  const [currentPage, setCurrentPage] = useState(1);
  const API_BASE = '/stories/';

  // --- 🌟 GitHub API Logic (Automated Update Tracking) ---
  const fetchRealTimestamps = async (baseStories: Story[]) => {
    try {
      // 1. Check Session Storage Cache
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) return data;
      }

      // 2. Fetch recent commits for the /stories directory
      // This is efficient: 1 API call gives us history for all files in the folder
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?path=stories&per_page=100`
      );
      if (!response.ok) throw new Error("API Limit reached or Repo Private");
      const commits = await response.json();

      // 3. Map filenames to their latest commit date
      const fileUpdateMap: Record<string, number> = {};
      
      // We iterate backwards through commits to ensure we get the *latest* for each file
      for (const commit of commits.reverse()) {
        const commitDate = new Date(commit.commit.committer.date).getTime();
        // Since we can't see specific files in this endpoint easily without more calls,
        // we'll use a slightly more robust per-story check logic below if this simple version is insufficient.
        // However, for most archives, fetching specific file commits is safer:
      }

      // Optimization: Fetch commit for each story file (Promise.all)
      // To respect rate limits, we only do this if cache is empty
      const updatedStories = await Promise.all(baseStories.map(async (story) => {
        const filesToTrack = story.chapters 
          ? story.chapters.map(c => c.fileName) 
          : [story.fileName];
        
        let latestTime = 0;
        let latestChapterName = "";

        // Check the last commit for each file associated with the story
        for (const file of filesToTrack) {
          if (!file) continue;
          const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?path=stories/${file}&per_page=1`);
          const data = await res.json();
          if (data && data.length > 0) {
            const time = new Date(data[0].commit.committer.date).getTime();
            if (time > latestTime) {
              latestTime = time;
              if (story.chapters) {
                latestChapterName = story.chapters.find(c => c.fileName === file)?.title || "";
              }
            }
          }
        }

        return { 
          ...story, 
          lastGitUpdate: latestTime || new Date(story.date).getTime(),
          latestChapterTitle: latestChapterName 
        };
      }));

      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: updatedStories, timestamp: Date.now() }));
      return updatedStories;
    } catch (error) {
      console.error("Git Fetch Error:", error);
      return baseStories; // Fallback to original
    }
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
    fetch(`${API_BASE}index.json?v=${Date.now()}`)
      .then(res => res.json())
      .then(async (data) => { 
        // Logic Addition: Fetch Git Timestamps after loading index.json
        const enrichedData = await fetchRealTimestamps(data);
        // Sort stories: Newest Git update first
        const sorted = enrichedData.sort((a: Story, b: Story) => (b.lastGitUpdate || 0) - (a.lastGitUpdate || 0));
        setStories(sorted); 
        setTimeout(() => setLoading(false), 800); 
      })
      .catch(() => setLoading(false));
  }, []);

  const totalPages = Math.ceil(stories.length / ITEMS_PER_PAGE);
  const currentItems = stories.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleConfirmAge = () => {
    setHasConfirmedAge(true);
    // Logic Addition: Popup triggers here, showing top 3 sorted by Git
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
    } catch (err) { alert("读取文章失败"); } 
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
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#0a0a0a] transition-colors duration-500 text-black dark:text-white"><div className="text-sm tracking-[0.5em] opacity-30 uppercase font-serif animate-pulse">INITIALIZING...</div></div>;

  return (
    <div className={`min-h-screen transition-colors duration-700 ${isDarkMode ? 'dark bg-[#0a0a0a] text-slate-200' : 'bg-[#F5F5F5] text-[#333333]'} font-serif selection:bg-blue-500/20 bg-noise`}>
      <AnimatePresence mode="wait">
       {!hasConfirmedAge ? (
          <motion.div key="age-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center">
            <AnimatePresence mode="wait">
              {!isHonest ? (
                <motion.div key="question" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="max-w-md w-full text-[#333] dark:text-white">
                  <ShieldAlert className="mx-auto mb-8 opacity-20 text-black dark:text-white" size={48} />
                  <h1 className="text-2xl font-bold tracking-[0.3em] mb-4 uppercase text-black dark:text-white">Content Notice</h1>
                  <p className="mb-12 text-xs leading-relaxed tracking-widest text-black/60 dark:text-slate-400">本站存档内容包含部分分级作品（R18），仅供成年人浏览。<br/>继续访问即代表您已年满 18 周岁。</p>
                  <div className="flex flex-col gap-4 items-center">
                    <button onClick={handleConfirmAge} className={`w-48 py-3 border rounded-full text-[10px] font-black tracking-[0.3em] uppercase transition-all ${isDarkMode ? 'border-white/40 hover:bg-white hover:text-black bg-white/5' : 'border-black/20 hover:bg-black hover:text-white bg-black/5'}`}>I KNOW / 我已知晓</button>
                    <button onClick={() => setIsHonest(true)} className="text-[10px] uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity text-black dark:text-white font-bold">LEAVE / 离开</button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="honest-msg" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
                  <Heart className="mx-auto mb-6 opacity-20 text-red-500" size={40} />
                  <h2 className="text-lg font-bold tracking-[0.2em] mb-4 text-black dark:text-white italic">期待下次相遇</h2>
                  <p className="text-xs leading-relaxed opacity-60 text-black dark:text-slate-400">喵<br/>喵喵喵</p>
                  <button onClick={() => setIsHonest(false)} className="mt-8 text-[10px] underline opacity-40 uppercase font-bold text-black dark:text-white">Return</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="main-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col min-h-screen">
            
            <AnimatePresence>
              {showUpdateNotice && !currentStory && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-black/40 dark:bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }} 
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full max-w-[440px] flex flex-col items-center"
                  >
                    <div className={`${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-[#F5F5F5] border-black/10'} border p-10 rounded-2xl shadow-2xl w-full text-center`}>
                      <h4 className="text-[10px] uppercase tracking-[0.4em] font-sans font-black opacity-30 mb-10 text-black dark:text-slate-400">最近更新</h4>
                      <div className="space-y-8">
                        {/* Logic: Display Top 3 based on Git Sorting */}
                        {stories.slice(0, 3).map(story => {
                          const displayChapter = story.latestChapterTitle;
                          // Format Git timestamp as YYYY.MM.DD
                          const displayDate = story.lastGitUpdate 
                            ? new Date(story.lastGitUpdate).toLocaleDateString('zh-CN').replace(/\//g, '.')
                            : story.date.replace(/-/g, '.');
                          
                          return (
                            <div key={story.id}>
                              <p className={`text-xl font-serif font-black leading-tight tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>{story.title}</p>
                              {displayChapter && <p className="text-sm font-serif italic font-bold text-slate-500 dark:text-slate-300 mt-2">— {displayChapter}</p>}
                              <p className={`text-[9px] uppercase tracking-[0.2em] opacity-40 dark:opacity-60 mt-4 font-sans font-black ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{story.author} // {displayDate}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowUpdateNotice(false)}
                      className="mt-8 w-12 h-12 rounded-full bg-slate-500/20 hover:bg-slate-500/40 text-slate-600 dark:text-slate-100 flex items-center justify-center transition-all shadow-lg border border-black/5 dark:border-white/10"
                    >
                      <X size={24} />
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <header className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-sm border-b ${isDarkMode ? 'bg-black/60 border-white/10' : 'bg-white/30 border-black/5'}`}>
              <div className="flex items-center gap-4">
                {currentStory ? (
                  <button onClick={handleBack} className={`flex items-center gap-2 text-xs uppercase tracking-widest font-sans font-black transition-opacity ${isDarkMode ? 'text-white/80 hover:text-white' : 'opacity-60 hover:opacity-100 text-black'}`}>
                    <ChevronLeft size={16} /> {showChapterList ? 'Home' : 'Back'}
                  </button>
                ) : ( <h1 className="text-sm uppercase tracking-widest font-sans font-black opacity-30 text-black dark:text-white">HW / ARCHIVE</h1> )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'text-yellow-400 hover:bg-white/10' : 'text-slate-700 hover:bg-black/5'}`}>
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                {currentStory?.content && (
                  <div className="flex gap-1 ml-2 font-sans font-black text-black dark:text-white">
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
                    <header className="text-center py-12"><h1 className="text-3xl font-black tracking-[0.2em] mb-4 text-black dark:text-white">花汪档案馆</h1></header>
                    <section className="max-w-[700px] mx-auto">
                      {currentItems.map(s => (
                        <motion.button key={s.id} whileHover={{ x: 5 }} onClick={() => handleStoryClick(s)} className={`w-full grid grid-cols-[1fr_auto] py-8 border-b transition-colors text-left ${isDarkMode ? 'border-white/10 hover:border-white/30 text-white' : 'border-black/5 hover:border-black/20 text-[#333]'}`}>
                          <div className="flex items-baseline gap-3"><h3 className="text-xl font-black mb-1 font-serif italic">{s.title}</h3>{s.chapters && <BookOpen size={14} className="opacity-30" />}</div>
                          <div className="col-span-full flex gap-4 text-[10px] opacity-50 dark:opacity-70 uppercase tracking-widest font-sans font-black"><span>{s.author}</span><span>{s.date?.replace(/-/g, '.')}</span>{s.chapters && <span>{s.chapters.length} 章节</span>}</div>
                        </motion.button>
                      ))}
                    </section>
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center gap-12 mt-20 py-10 border-t border-dashed border-black/5 dark:border-white/10">
                        <button onClick={() => { setCurrentPage(p => Math.max(p - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === 1} className={`text-[10px] font-sans font-black tracking-[0.4em] uppercase transition-all ${currentPage === 1 ? 'opacity-10' : 'opacity-60 hover:opacity-100 text-black dark:text-white'}`}>← PREV</button>
                        <span className="text-[10px] font-sans font-black opacity-30 text-black dark:text-white">{currentPage} / {totalPages}</span>
                        <button onClick={() => { setCurrentPage(p => Math.min(p + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === totalPages} className={`text-[10px] font-sans font-black tracking-[0.4em] uppercase transition-all ${currentPage === totalPages ? 'opacity-10' : 'opacity-60 hover:opacity-100 text-black dark:text-white'}`}>NEXT →</button>
                      </div>
                    )}
                  </motion.div>
                ) : showChapterList ? (
                  <motion.div key="chapters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[600px] mx-auto py-12 text-center">
                    <div className="mb-12"><h2 className="text-2xl font-black font-serif italic text-black dark:text-white">{currentStory.title}</h2><p className="text-xs opacity-40 tracking-widest uppercase font-sans font-black text-black dark:text-slate-400">Directory / 目录</p></div>
                    <div className="grid gap-4">
                      {currentStory.chapters?.map((chapter, idx) => (
                        <button key={idx} onClick={() => loadFullStory(currentStory, chapter.fileName, chapter.title)} className={`p-6 border rounded-2xl text-left transition-all group flex justify-between items-center ${isDarkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-black/5 bg-white hover:bg-black/5'}`}>
                          <div><span className="text-[10px] opacity-30 dark:opacity-50 block mb-1 font-sans font-black uppercase tracking-widest text-black dark:text-slate-400">Chapter {idx + 1}</span><span className="text-lg group-hover:pl-2 transition-all duration-300 font-serif font-black italic text-black dark:text-white">{chapter.title}</span></div>
                          <div className="text-[10px] opacity-30 dark:opacity-50 font-sans tracking-widest uppercase text-right font-black text-black dark:text-slate-400">{chapter.autoWordCount ? `${chapter.autoWordCount.toLocaleString()} 字` : '...'}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[700px] mx-auto text-center">
                    <header className="mb-16 border-b border-black/5 dark:border-white/10 pb-12 font-sans">
                      <h2 className="text-4xl font-serif font-black italic mb-8 leading-tight text-black dark:text-white">{currentStory.title}{currentStory.currentChapterTitle && (<span className="block text-xl opacity-60 mt-4 font-serif font-medium">— {currentStory.currentChapterTitle}</span>)}</h2>
                      <div className="text-[11px] uppercase tracking-[0.2em] opacity-50 dark:opacity-70 space-y-1 font-black text-black dark:text-slate-300"><p>作者: {currentStory.author}</p><p>时间: {currentStory.date?.replace(/-/g, '.')}</p><p>字数: {reading ? '...' : (currentStory.wordCount?.toLocaleString() || '...')}</p></div>
                      <a href={currentStory.sourceLink} target="_blank" rel="noopener noreferrer" className={`inline-block mt-8 text-[13px] font-black tracking-[0.2em] underline underline-offset-8 decoration-1 transition-opacity ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-[#607d8b] hover:text-[#455a64]'}`}>原链接 SOURCE →</a>
                    </header>
                    {reading ? (<div className="py-20 text-center opacity-20 tracking-widest text-xs uppercase animate-pulse text-black dark:text-white">Loading Content...</div>) : (
                      <article style={{ fontSize: `${fontSize}px`, lineHeight: '1.9' }} className="text-justify mb-24 font-serif text-black dark:text-slate-200">
                        {(() => {
                          const raw = currentStory.content || '';
                          const cleanRaw = raw.replace(/\r\n/g, '\n');
                          const blockRegex = /(\[\s*quote\s*\][\s\S]*?\[\s*\/quote\s*\]|\[\s*box\s*\][\s\S]*?\[\s*\/box\s*\]|\[\s*bubble:[LR]\s*\][\s\S]*?\[\s*\/bubble\s*\]|\[\s*bvid:[a-zA-Z0-9]+\s*\]|---)/g;
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
                              return (<div key={idx} className={`my-4 p-8 border rounded-2xl text-sm leading-relaxed shadow-sm ${isDarkMode ? 'bg-zinc-900 border-white/10 text-slate-300' : 'bg-slate-100/60 border-slate-200 text-slate-700'}`}>{inner.split('\n').map((l, i) => l.trim() ? <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) }} /> : <div key={i} className="h-4" />)}</div>);
                            }
                            if (/\[\s*bubble:/.test(part)) {
                              const isRight = part.includes(':R');
                              const inner = part.replace(/\[\s*bubble:[LR]\s*\]/g, '').replace(/\[\s*\/bubble\s*\]/g, '').trim();
                              return (<div key={idx} className={`flex ${isRight ? 'justify-end' : 'justify-start'} my-4`}><div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm tracking-tight ${isRight ? 'bg-[#607d8b] text-white rounded-tr-none' : (isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-200 text-slate-800')}`}>{inner.split('\n').map((l, i) => l.trim() ? <p key={i} className="mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) }} /> : <div key={i} className="h-2" />)}</div></div>);
                            }
                            if (/\[\s*bvid:/.test(part)) {
                              const bvid = part.match(/bvid:\s*([a-zA-Z0-9]+)/)?.[1];
                              return (<div key={idx} className="my-10 aspect-video w-full overflow-hidden rounded-2xl shadow-2xl bg-black ring-1 ring-white/10"><iframe src={`//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`} className="w-full h-full border-none" allowFullScreen loading="lazy" /></div>);
                            }
                            if (trimmedPart === '---') return <hr key={idx} className={`my-16 border-t ${isDarkMode ? 'border-white/10' : 'border-black/10'}`} />;
                            return part.split('\n').map((line, lIdx) => {
                              if (line === '') return <div key={lIdx} className="h-8" />;
                              return <p key={`${idx}-${lIdx}`} className="mb-5 min-h-[1.5em]" dangerouslySetInnerHTML={{ __html: applyInlineStyles(line) }} />;
                            });
                          });
                        })()}
                      </article>
                    )}
                    <div className={`flex flex-col sm:flex-row items-center justify-between gap-6 py-12 border-t border-dashed ${isDarkMode ? 'border-white/20' : 'border-black/10'}`}>
                       <p className={`text-sm font-black tracking-widest ${isDarkMode ? 'text-white/60' : 'text-black/40'}`}>如果喜欢这篇文章，请务必去支持一下原作者。</p>
                       <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-black tracking-[0.2em] uppercase transition-all border ${isDarkMode ? 'border-white/30 hover:bg-white hover:text-black text-white' : 'border-black/10 hover:bg-black hover:text-white text-black'}`}>Top / 回到顶部 <ChevronUp size={14} /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
            <footer className="py-20 px-6 border-t border-black/5 dark:border-white/10 text-center opacity-40 text-[10px] tracking-widest font-serif uppercase text-black dark:text-slate-400">
              <div className="max-w-[600px] mx-auto space-y-3 normal-case leading-relaxed mb-12 text-center font-black"><p>本站仅作为 Postype 平台 녘랜 (花汪) 同人文作品的翻译交流与存档使用，版权归原作者所有。</p><p>站内内容全是机翻，如有侵权请联系删除。</p><p className="font-bold">联系微博：<span>@恋花症-</span></p></div>
              <p onClick={(e) => { if (e.detail === 5) setIsAdmin(true); }} className="italic font-sans tracking-[0.2em] cursor-default select-none text-center">© 2026 HW ARCHIVE.</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
