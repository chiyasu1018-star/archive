/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronUp, 
  Moon, 
  Sun, 
  ShieldAlert,
  Heart,
  BookOpen 
} from 'lucide-react';

import Admin from './Admin';

interface Chapter {
  title: string;
  fileName: string;
  autoWordCount?: number; 
}

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

  // 1. 这里的 fetch 增加了反缓存，保证首页列表是最新的
  useEffect(() => {
    fetch('/stories/index.json?v=' + Date.now())
      .then(res => res.json())
      .then(data => {
        setStories(data);
        setTimeout(() => setLoading(false), 1000);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleStoryClick = async (story: Story) => {
    setCurrentStory(story);
    if (story.chapters && story.chapters.length > 0) {
      setShowChapterList(true);
      if (!story.chapters[0].autoWordCount) {
        const updatedChapters = await Promise.all(
          story.chapters.map(async (ch) => {
            try {
              // 2. 这里的 fetch 也增加了反缓存
              const res = await fetch(`/stories/${ch.fileName}?v=${Date.now()}`);
              const text = await res.text();
              const count = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length;
              return { ...ch, autoWordCount: count };
            } catch { return { ...ch, autoWordCount: 0 }; }
          })
        );
        setCurrentStory(prev => prev ? { ...prev, chapters: updatedChapters } : null);
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
      }
    } else {
      loadFullStory(story, story.fileName!);
    }
  };

  const loadFullStory = async (parentStory: Story, fileName: string, chapterTitle?: string) => {
    setReading(true);
    try {
      // 3. 这里的 fetch 也增加了反缓存
      const response = await fetch(`/stories/${fileName}?v=${Date.now()}`);
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
    } else {
      setCurrentStory(null);
      setShowChapterList(false);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const applyInlineStyles = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\*\*\s*(.*?)\s*\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
      .replace(/\*\s*(.*?)\s*\*/g, '<em class="italic opacity-80">$1</em>');
  };

  if (isAdmin) return <Admin onBack={() => setIsAdmin(false)} />;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#121212]">
      <div className="text-sm tracking-[0.5em] opacity-30 uppercase font-serif">INITIALIZING...</div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'dark bg-[#121212] text-[#E0E0E0]' : 'bg-[#F5F5F5] text-[#333333]'} font-serif selection:bg-black/5 bg-noise`}>
      <AnimatePresence mode="wait">
       {!hasConfirmedAge ? (
          <motion.div key="age-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center">
            <AnimatePresence mode="wait">
              {!isHonest ? (
                <motion.div key="question" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="max-w-md w-full text-[#333] dark:text-white">
                  <ShieldAlert className="mx-auto mb-8 opacity-20" size={48} />
                  <h1 className="text-2xl font-bold tracking-[0.3em] mb-4 uppercase">Content Notice</h1>
                  <div className="space-y-4 mb-12 text-xs leading-relaxed opacity-60 tracking-widest">
                    <p>本站存档内容包含部分分级作品（R18），仅供成年人浏览。</p>
                    <p>继续访问即代表您已年满 18 周岁。</p>
                  </div>
                  <div className="flex flex-col gap-4 items-center">
                    <button onClick={() => setHasConfirmedAge(true)} className={`w-48 py-3 border rounded-full text-[10px] font-bold tracking-[0.3em] uppercase transition-all ${isDarkMode ? 'border-white/20 hover:bg-white hover:text-black' : 'border-black/20 hover:bg-black hover:text-white'}`}>I KNOW / 我已知晓</button>
                    <button onClick={() => setIsHonest(true)} className="text-[10px] uppercase tracking-[0.2em] opacity-30 hover:opacity-100 transition-opacity">LEAVE / 离开</button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="honest-msg" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
                  <Heart className="mx-auto mb-6 opacity-20 text-red-500" size={40} />
                  <h2 className="text-lg font-bold tracking-[0.2em] mb-4 text-[#333] dark:text-white">期待下次相遇</h2>
                  <p className="text-xs leading-relaxed opacity-60 tracking-widest">喵<br/>喵喵喵</p>
                  <button onClick={() => setIsHonest(false)} className="mt-8 text-[10px] underline opacity-40">返回</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="main-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col min-h-screen text-[#333] dark:text-white">
            <header className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-sm border-b ${isDarkMode ? 'bg-black/30 border-white/10' : 'bg-white/30 border-black/5'}`}>
              <div className="flex items-center gap-4">
                {currentStory ? (
                  <button onClick={handleBack} className={`flex items-center gap-2 text-xs uppercase tracking-widest font-sans font-bold transition-opacity ${isDarkMode ? 'text-white/60 hover:text-white' : 'opacity-60 hover:opacity-100'}`}>
                    <ChevronLeft size={16} /> {showChapterList ? 'Home' : 'Back'}
                  </button>
                ) : (
                  <h1 className="text-sm uppercase tracking-widest font-sans font-semibold opacity-30 text-[#333] dark:text-white">HW / ARCHIVE</h1>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'text-yellow-400 hover:bg-white/10' : 'text-slate-700 hover:bg-black/5'}`}>
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                {currentStory?.content && (
                  <div className="flex gap-1 ml-2 font-sans font-bold text-[#333] dark:text-white">
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
                    <header className="text-center py-12 text-[#333] dark:text-white">
                      <h1 className="text-3xl font-bold tracking-[0.2em] mb-4">花汪档案馆</h1>
                    </header>
                    <section className="max-w-[700px] mx-auto">
                      {stories.map(s => (
                        <motion.button key={s.id} whileHover={{ x: 5 }} onClick={() => handleStoryClick(s)} className={`w-full grid grid-cols-[1fr_auto] py-8 border-b transition-colors text-left ${isDarkMode ? 'border-white/10 hover:border-white/30 text-white' : 'border-black/5 hover:border-black/20 text-[#333]'}`}>
                          <div className="flex items-baseline gap-3">
                             <h3 className="text-xl font-medium mb-1">{s.title}</h3>
                             {s.chapters && <BookOpen size={14} className="opacity-30" />}
                          </div>
                          <div className="col-span-full flex gap-4 text-[10px] opacity-40 uppercase tracking-widest font-sans">
                            <span>{s.author}</span>
                            <span>{s.date?.replace(/-/g, '.')}</span>
                            {s.chapters && <span>{s.chapters.length} 章节</span>}
                          </div>
                        </motion.button>
                      ))}
                    </section>
                  </motion.div>
                ) : showChapterList ? (
                  <motion.div key="chapters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[600px] mx-auto py-12 text-[#333] dark:text-white">
                    <div className="mb-12 text-center">
                       <h2 className="text-2xl font-bold mb-2">{currentStory.title}</h2>
                       <p className="text-xs opacity-40 tracking-widest uppercase font-sans">Directory / 目录</p>
                    </div>
                    <div className="grid gap-4">
                      {currentStory.chapters?.map((chapter, idx) => (
                        <button key={idx} onClick={() => loadFullStory(currentStory, chapter.fileName, chapter.title)} className={`p-6 border rounded-xl text-left transition-all group flex justify-between items-center ${isDarkMode ? 'border-white/10 hover:bg-white/5' : 'border-black/5 hover:bg-black/5'}`}>
                          <div>
                            <span className="text-[10px] opacity-30 block mb-1 font-sans font-bold">CHAPTER {idx + 1}</span>
                            <span className="text-lg group-hover:pl-2 transition-all duration-300">{chapter.title}</span>
                          </div>
                          <div className="text-[10px] opacity-30 font-sans tracking-widest uppercase text-right">
                             {chapter.autoWordCount ? `${chapter.autoWordCount.toLocaleString()} 字` : '...'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[700px] mx-auto text-[#333] dark:text-white">
                    <header className="mb-16 border-b border-black/5 dark:border-white/5 pb-12 font-sans">
                      <h2 className="text-4xl font-serif font-light mb-8 leading-tight">
                        {currentStory.title}
                        {currentStory.currentChapterTitle && (
                          <span className="block text-xl opacity-50 mt-4 font-serif">— {currentStory.currentChapterTitle}</span>
                        )}
                      </h2>
                      <div className="text-[11px] uppercase tracking-[0.2em] opacity-40 space-y-1 font-bold">
                        <p>作者: {currentStory.author}</p>
                        <p>时间: {currentStory.date?.replace(/-/g, '.')}</p>
                        <p>字数: {reading ? '...' : (currentStory.wordCount?.toLocaleString() || '...')}</p>
                      </div>
                      <a href={currentStory.sourceLink} target="_blank" rel="noopener noreferrer" className={`inline-block mt-8 text-[13px] font-bold tracking-[0.2em] underline underline-offset-8 decoration-1 transition-opacity ${isDarkMode ? 'text-[#90a4ae] hover:text-[#b0bec5]' : 'text-[#607d8b] hover:text-[#455a64]'}`}>原链接 SOURCE →</a>
                    </header>
                    {reading ? (
                       <div className="py-20 text-center opacity-20 tracking-widest text-xs uppercase animate-pulse">Loading Content...</div>
                    ) : (
                      <>
                        <article style={{ fontSize: `${fontSize}px`, lineHeight: '1.9' }} className="text-justify mb-24 font-serif text-[#333] dark:text-[#E0E0E0]">
                          {(() => {
                            let raw = currentStory.content || '';
                            raw = raw.replace(/^\s*(\[[\/]?\w+.*?\]|---)\s*$/gm, '$1');
                            raw = raw.replace(/\r\n/g, '\n');
                            const blockRegex = /(\[quote\][\s\S]*?\[\/quote\]|\[box\][\s\S]*?\[\/box\]|\[bubble:[LR]\][\s\S]*?\[\/bubble\]|\[bvid:[a-zA-Z0-9]+\]|^---$)/gm;
                            const parts = raw.split(blockRegex);
                            return parts.map((part, idx) => {
                                if (!part || !part.trim()) return null;
                                if (part.includes('[quote]')) {
                                    const inner = part.replace(/\[\/?quote\]/g, '').trim();
                                    return (
                                        <blockquote key={idx} className="my-10 pl-5 border-l-4 border-slate-300 dark:border-slate-700 italic text-slate-500 dark:text-slate-400 bg-slate-100/30 dark:bg-white/5 py-6 rounded-r-xl">
                                            {inner.split('\n').map((l, i) => (<p key={i} className={l.trim() ? "mb-2 last:mb-0" : "h-4"} dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) || '&nbsp;' }} />))}
                                        </blockquote>
                                    );
                                }
                                if (part.includes('[box]')) {
                                  const inner = part.replace(/\[\/?box\]/g, '').trim();
                                  return (
                                      <div key={idx} className="my-10 p-8 bg-slate-100/60 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl text-sm leading-relaxed shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                                          {inner.split('\n').map((l, i) => (<p key={i} className={l.trim() ? "mb-2 last:mb-0" : "h-4"} dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) || '&nbsp;' }} />))}
                                      </div>
                                  );
                                }
                                if (part.includes('[bubble:')) {
                                    const isRight = part.includes('[bubble:R]');
                                    const inner = part.replace(/\[bubble:[LR]\]/g, '').replace(/\[\/bubble\]/g, '').trim();
                                    return (
                                        <div key={idx} className={`flex ${isRight ? 'justify-end' : 'justify-start'} my-2`}>
                                            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm tracking-tight ${isRight ? 'bg-[#607d8b] text-white rounded-tr-none' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'}`}>
                                                {inner.split('\n').map((l, i) => (<p key={i} className="mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) || '&nbsp;' }} />))}
                                            </div>
                                        </div>
                                    );
                                }
                                if (part.includes('[bvid:')) {
                                    const bvid = part.match(/\[bvid:([a-zA-Z0-9]+)\]/)?.[1];
                                    return (
                                        <div key={idx} className="my-10 aspect-video w-full overflow-hidden rounded-2xl shadow-2xl bg-black ring-1 ring-white/10">
                                            <iframe src={`//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0`} className="w-full h-full border-none" allowFullScreen />
                                        </div>
                                    );
                                }
                                if (part.trim() === '---') return <hr key={idx} className="my-16 border-t border-black/10 dark:border-white/10" />;
                                return part.split('\n').map((line, lIdx) => {
                                    const cleanLine = line.trim();
                                    if (!cleanLine) return <div key={lIdx} className="h-6" />;
                                    return <p key={`${idx}-${lIdx}`} className="mb-5 min-h-[1.5em]" dangerouslySetInnerHTML={{ __html: applyInlineStyles(line) }} />;
                                });
                            });
                          })()}
                        </article>
                        <div className={`flex flex-col sm:flex-row items-center justify-between gap-6 py-12 border-t border-dashed ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
                           <p className={`text-sm font-bold tracking-widest ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>如果喜欢这篇文章，请务必去支持一下原作者。</p>
                           <button onClick={scrollToTop} className={`flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase transition-all border ${isDarkMode ? 'border-white/10 hover:bg-white hover:text-black' : 'border-black/10 hover:border-black hover:text-white'}`}>Top / 回到顶部 <ChevronUp size={14} /></button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            <footer className="py-20 px-6 border-t border-black/5 dark:border-white/10 text-center opacity-40 text-[10px] tracking-widest font-serif uppercase text-[#333] dark:text-white">
              <div className="max-w-[600px] mx-auto space-y-3 normal-case leading-relaxed mb-12">
                <p>本站仅作为 Postype 平台 녘랜 (花汪) 同人文作品的翻译交流与存档使用，版权归原作者所有。</p>
                <p>站内内容全是机翻，如有侵权请联系删除。</p>
                <p className="font-bold">联系微博：<span>@恋花症-</span></p>
              </div>
              <p onClick={(e) => { if (e.detail === 5) setIsAdmin(true); }} className="italic font-sans tracking-[0.2em] cursor-default select-none">© 2026 HW ARCHIVE.</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
