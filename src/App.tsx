/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronUp, Moon, Sun, BookOpen, X, Clock } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react'; 

// 后台按需加载：Admin 会带上整个 Octokit（GitHub SDK），
// 而它只有站主一个人会打开。静态 import 会让每个访客都白下载这一坨。
const Admin = React.lazy(() => import('./Admin'));

// --- CONFIGURATION ---
const GITHUB_OWNER = "chiyasu1018-star"; 
const GITHUB_REPO = "archive";       

// 主源：随站点一起部署的本地文件，国内可直连
const LOCAL_INDEX_URL = '/stories/index.json';
const LOCAL_LOGS_URL = '/stories/logs.json';
// 备用源：本地文件取不到时才回退到 GitHub
const FALLBACK_INDEX_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/public/stories/index.json`;
const FALLBACK_LOGS_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/public/stories/logs.json`;

const FETCH_TIMEOUT = 8000;
const API_BASE = '/stories/';
const ITEMS_PER_PAGE = 8;
const POS_KEY = 'hw_reading_pos';
const FONT_KEY = 'hw_font_size';
const SITE_TITLE = '花汪档案馆 | HuaWang Archive';

// 后台入口密钥（地址栏 # 后面那段）。只有知道它的人才能打开后台界面。
// 说明：它出现在前端产物里，属于"门牌"而非"锁"——真正的锁是后台里要求验证的 Token，
// 而且后台在 Token 通过验证前不会渲染任何内容。换密钥只需改这一行。
const ADMIN_HASH = '#hw-699375a42e24efbe';

/** 带超时的 JSON 请求，避免网络不通时请求永久挂起 */
const fetchJson = async (url: string, timeout = FETCH_TIMEOUT) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

/** 读取正文；失败时抛错（调用方负责给出提示） */
const fetchStoryText = async (fileName: string, timeout = FETCH_TIMEOUT) => {
  // 和 fetchJson 一样必须带超时：正文是最大的一次请求，
  // 之前这里是裸 fetch，网络一挂就永远停在 Loading Content...
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${API_BASE}${fileName}?v=${Date.now()}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // 静态托管若把 404 兜底重写成首页，会返回一整页 HTML。
    // 正文不可能是 HTML，遇到就按读取失败处理，免得把网页源码当小说显示出来。
    if (/^\s*(<!doctype\s+html|<html[\s>])/i.test(text)) throw new Error('NOT_FOUND');
    return text;
  } finally {
    clearTimeout(timer);
  }
};

const countWords = (text: string) => text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length;

// --- 阅读位置记忆 ---
const readPositions = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(POS_KEY) || '{}'); } catch { return {}; }
};
const writePosition = (key: string, top: number) => {
  try {
    const all = readPositions();
    all[key] = top;
    const keys = Object.keys(all);
    if (keys.length > 60) delete all[keys[0]];
    localStorage.setItem(POS_KEY, JSON.stringify(all));
  } catch {}
};

// --- 路由（与浏览器历史同步）---
type RouteBase =
  | { view: 'list'; page: number }
  | { view: 'chapters'; storyId: string }
  | { view: 'content'; storyId: string; fileName: string; chapterTitle: string; chapterIndex: number };
type Route = RouteBase & { depth: number };

const currentDepth = () => {
  const s = window.history.state as Route | null;
  return s && typeof s.depth === 'number' ? s.depth : 0;
};

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
  currentChapterIndex?: number;
  currentFile?: string;
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
  const [fontSize, setFontSize] = useState(() => {
    const saved = Number(localStorage.getItem(FONT_KEY));
    return saved >= 14 && saved <= 28 ? saved : 18;
  }); 
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [reading, setReading] = useState(false);
  // 正文读取失败时记下是哪一章，回到目录后给出提示并允许重试
  const [chapterError, setChapterError] = useState<{ title: string; storyId: string; fileName: string; chapterIndex: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const storiesRef = useRef<Story[]>([]);
  useEffect(() => { storiesRef.current = stories; }, [stories]);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(fontSize));
  }, [fontSize]);

  // 把路由状态应用到界面
  const applyRoute = useCallback(async (route: Route | null) => {
    const r: RouteBase = route ?? { view: 'list', page: 1 };

    if (r.view === 'list') {
      setCurrentStory(null);
      setShowChapterList(false);
      setCurrentPage(r.page || 1);
      setChapterError(null);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const story = storiesRef.current.find(s => s.id === r.storyId);
    if (!story) {
      setCurrentStory(null);
      setShowChapterList(false);
      return;
    }

    if (r.view === 'chapters') {
      setCurrentStory(story);
      setShowChapterList(true);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    // 正文：先切视图（此时还没内容，显示加载态），再取正文
    setCurrentStory({ ...story, currentChapterTitle: r.chapterTitle, currentChapterIndex: r.chapterIndex });
    setShowChapterList(false);
    setReading(true);
    setChapterError(null);
    try {
      const text = await fetchStoryText(r.fileName);
      setCurrentStory({
        ...story,
        content: text,
        wordCount: countWords(text),
        currentChapterTitle: r.chapterTitle,
        currentChapterIndex: r.chapterIndex,
        currentFile: r.fileName,
      });
    } catch {
      // 正文读不到：退回目录，但要留下提示，别让用户以为是点错了
      setCurrentStory(story);
      setShowChapterList(true);
      setChapterError({
        title: r.chapterTitle || '该章节',
        storyId: r.storyId,
        fileName: r.fileName,
        chapterIndex: r.chapterIndex,
      });
      // 界面已经回到目录，历史里这一条也要跟着改掉，
      // 否则按返回键会跳过目录、刷新也会又去请求那个读不到的章节
      window.history.replaceState(
        { view: 'chapters', storyId: story.id, depth: currentDepth() } as Route,
        ''
      );
    } finally {
      setReading(false);
    }
  }, []);

  const go = useCallback((route: RouteBase, mode: 'push' | 'replace' = 'push') => {
    const depth = mode === 'push' ? currentDepth() + 1 : currentDepth();
    const next = { ...route, depth } as Route;
    if (mode === 'push') window.history.pushState(next, '');
    else window.history.replaceState(next, '');
    void applyRoute(next);
  }, [applyRoute]);

  // 应用栏里的返回按钮：有站内历史就交给浏览器，否则直接回列表
  const goBack = useCallback(() => {
    if (currentDepth() > 0) window.history.back();
    else go({ view: 'list', page: 1 }, 'replace');
  }, [go]);

  // 浏览器返回 / 前进
  useEffect(() => {
    const onPop = (e: PopStateEvent) => { void applyRoute(e.state as Route | null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyRoute]);

  // 刷新后停在同一处，而不是被踢回首页
  const initialRouteApplied = useRef(false);
  useEffect(() => {
    if (loading || initialRouteApplied.current) return;
    initialRouteApplied.current = true;
    const state = window.history.state as Route | null;
    if (state && state.view) void applyRoute(state);
  }, [loading, applyRoute]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const storyData = await fetchJson(LOCAL_INDEX_URL);
        const logsData = await fetchJson(LOCAL_LOGS_URL).catch(() => []);
        if (cancelled) return;
        setStories(Array.isArray(storyData) ? storyData : []);
        setLogs(Array.isArray(logsData) ? logsData : []);
      } catch {
        // 本地文件取不到时才回退到 GitHub raw
        try {
          const storyData = await fetchJson(`${FALLBACK_INDEX_URL}?v=${Date.now()}`);
          const logsData = await fetchJson(`${FALLBACK_LOGS_URL}?v=${Date.now()}`).catch(() => []);
          if (cancelled) return;
          setStories(Array.isArray(storyData) ? storyData : []);
          setLogs(Array.isArray(logsData) ? logsData : []);
        } catch {
          if (!cancelled) setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(false);
    setReloadKey(k => k + 1);
  };

  // 后台入口：只有地址栏 # 后面带着正确密钥时才进得去。
  // 以前是「页脚连点 5 下」+ `#admin`，两者都是公开约定/可猜字符串，等于没藏。
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === ADMIN_HASH) setIsAdmin(true);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 退出后台时清掉地址栏里的入口密钥，否则刷新又掉回后台，
  // 而且密钥会一直留在地址栏上被旁人看到
  const exitAdmin = useCallback(() => {
    setIsAdmin(false);
    if (window.location.hash === ADMIN_HASH) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }, []);

  // 更新日志弹窗：Esc 关闭 + 锁住背景滚动
  useEffect(() => {
    if (!showLogs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowLogs(false); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showLogs]);

  // 标签页标题跟随当前作品
  useEffect(() => {
    if (!currentStory) { document.title = SITE_TITLE; return; }
    const label = currentStory.currentChapterTitle
      ? `${currentStory.title} · ${currentStory.currentChapterTitle}`
      : currentStory.title;
    document.title = `${label} | 花汪档案馆`;
  }, [currentStory]);

  // --- 阅读位置：恢复 ---
  const activeKey = currentStory?.content && currentStory.currentFile
    ? `${currentStory.id}:${currentStory.currentFile}`
    : null;

  useEffect(() => {
    if (!activeKey) return;
    const saved = readPositions()[activeKey] || 0;
    const raf = window.requestAnimationFrame(() => {
      window.scrollTo({ top: saved, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeKey]);

  // --- 阅读位置：记录 ---
  useEffect(() => {
    if (!activeKey) return;
    let timer: number | undefined;
    let lastY = window.scrollY;
    const onScroll = () => {
      lastY = window.scrollY;
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        writePosition(activeKey, lastY);
      }, 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer !== undefined) window.clearTimeout(timer);
      writePosition(activeKey, lastY);
    };
  }, [activeKey]);

  const totalPages = Math.ceil(stories.length / ITEMS_PER_PAGE);
  const currentItems = stories.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleStoryClick = (story: Story) => {
    if (story.chapters && story.chapters.length > 0) {
      go({ view: 'chapters', storyId: story.id });
      // 目录字数后台补齐，不阻塞进入目录
      story.chapters.forEach(async (ch, idx) => {
        if (ch.autoWordCount) return;
        try {
          const text = await fetchStoryText(ch.fileName);
          const count = countWords(text);
          setStories(prev => prev.map(s => s.id === story.id ? {
            ...s, chapters: s.chapters?.map((c, i) => i === idx ? { ...c, autoWordCount: count } : c)
          } : s));
        } catch {}
      });
    } else if (story.fileName) {
      go({ view: 'content', storyId: story.id, fileName: story.fileName, chapterTitle: '', chapterIndex: -1 });
    }
  };

  const openChapter = (story: Story, fileName: string, chapterTitle: string, chapterIndex: number) => {
    go({ view: 'content', storyId: story.id, fileName, chapterTitle, chapterIndex });
  };

  // 正文最终会交给 dangerouslySetInnerHTML，所以先转义再拼标签。
  // 顺序必须是 & -> < -> >，否则已转义的 &lt; 会被二次转义成 &amp;lt; 显示成原文。
  // 效果：正文里的裸 < > & 按字面显示（以前会被浏览器当成标签吃掉半行），
  // 同时正文中出现的 <script> / onerror= 之类也只是文字，不会执行。
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const applyInlineStyles = (text: string) => {
    if (!text) return '';
    return escapeHtml(text)
      .replace(/\*\*\s*(.*?)\s*\*\*/g, `<strong class="font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}">$1</strong>`)
      .replace(/\*\s*(.*?)\s*\*/g, '<em class="italic opacity-80">$1</em>');
  };

  if (isAdmin) return (
    <React.Suspense fallback={<div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#F5F5F5] text-black'}`}><div className="text-sm tracking-[0.5em] opacity-30 uppercase font-serif animate-pulse">INITIALIZING...</div></div>}>
      <Admin onBack={exitAdmin} />
    </React.Suspense>
  );
  if (loading) return <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#F5F5F5] text-black'}`}><div className="text-sm tracking-[0.5em] opacity-30 uppercase font-serif animate-pulse">INITIALIZING...</div></div>;

  if (loadError) return (
    <div className={`min-h-screen flex flex-col items-center justify-center gap-8 transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#F5F5F5] text-black'}`}>
      <div className="text-sm tracking-[0.4em] opacity-30 font-serif">内容加载失败</div>
      <p className={`text-xs tracking-widest font-serif ${isDarkMode ? 'text-slate-400' : 'text-black/50'}`}>请检查网络连接后重试</p>
      <button onClick={retryLoad} className={`px-6 py-3 rounded-full text-[10px] font-sans font-black tracking-[0.2em] uppercase border transition-all ${isDarkMode ? 'border-white/30 text-white/70 hover:bg-white hover:text-black' : 'border-black/20 text-black/60 hover:bg-black hover:text-white'}`}>重试 / RETRY</button>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-700 ${isDarkMode ? 'dark bg-[#0a0a0a] text-slate-200' : 'bg-[#F5F5F5] text-[#333333]'} font-serif selection:bg-blue-500/20 bg-noise`}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col min-h-screen">

        <header className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-sm border-b ${isDarkMode ? 'bg-black/60 border-white/10' : 'bg-white/30 border-black/5'}`}>
          <div className="flex items-center gap-4">
            {currentStory ? (
              <button onClick={goBack} className={`flex items-center gap-2 text-xs uppercase tracking-widest font-sans font-black transition-opacity ${isDarkMode ? 'text-white/80 hover:text-white' : 'opacity-60 hover:opacity-100 text-black'}`}>
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
            <button onClick={() => setIsDarkMode(!isDarkMode)} aria-label={isDarkMode ? '切换到浅色模式' : '切换到深色模式'} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'text-yellow-400 hover:bg-white/10' : 'text-slate-700 hover:bg-black/5'}`}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {currentStory?.content && (
              <div className={`flex gap-1 ml-2 font-sans font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>
                <button onClick={() => setFontSize(f => Math.max(f-2, 14))} aria-label="缩小字号" className="w-8 h-8 text-xs">A-</button>
                <button onClick={() => setFontSize(f => Math.min(f+2, 28))} aria-label="放大字号" className="w-8 h-8 text-lg">A+</button>
              </div>
            )}
          </div>
        </header>

        {/* 🌟 更新日志弹窗渲染 */}
        <AnimatePresence>
          {showLogs && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLogs(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
              <motion.div role="dialog" aria-modal="true" aria-label="更新日志" initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={(e) => e.stopPropagation()} className={`max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-white border-black/5 text-black'}`}>
                <div className="p-6 border-b flex justify-between items-center dark:border-white/10">
                   <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2"><Clock size={14}/> 更新日志 </h2>
                   <button onClick={() => setShowLogs(false)} aria-label="关闭更新日志" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"><X size={18}/></button>
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
                  {currentItems.length === 0 && (
                    <div className="py-24 text-center text-xs tracking-[0.3em] uppercase opacity-30 font-sans font-black">暂无存档</div>
                  )}
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
                    <button onClick={() => go({ view: 'list', page: Math.max(currentPage - 1, 1) })} disabled={currentPage === 1} className={`text-[10px] font-sans font-black tracking-[0.4em] uppercase transition-all ${currentPage === 1 ? 'opacity-10' : `opacity-60 hover:opacity-100 ${isDarkMode ? 'text-white' : 'text-black'}`}`}>← PREV</button>
                    <span className={`text-[10px] font-sans font-black opacity-30 ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentPage} / {totalPages}</span>
                    <button onClick={() => go({ view: 'list', page: Math.min(currentPage + 1, totalPages) })} disabled={currentPage === totalPages} className={`text-[10px] font-sans font-black tracking-[0.4em] uppercase transition-all ${currentPage === totalPages ? 'opacity-10' : `opacity-60 hover:opacity-100 ${isDarkMode ? 'text-white' : 'text-black'}`}`}>NEXT →</button>
                  </div>
                )}
              </motion.div>
            ) : showChapterList ? (
              <motion.div key="chapters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[600px] mx-auto py-12 text-center">
                <div className="mb-12"><h2 className={`text-2xl font-black font-serif italic ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentStory.title}</h2><p className={`text-xs opacity-40 tracking-widest uppercase font-sans font-black ${isDarkMode ? 'text-slate-400' : 'text-black'}`}>Directory / 目录</p></div>
                {chapterError && (
                  <div role="alert" className={`mb-8 px-5 py-4 border rounded-2xl text-left flex items-start gap-3 ${isDarkMode ? 'border-red-400/25 bg-red-400/[0.07]' : 'border-red-500/20 bg-red-50'}`}>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] uppercase tracking-[0.2em] font-sans font-black mb-1.5 ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>正文读取失败 / Load failed</div>
                      <p className={`text-[13px] leading-relaxed mb-3 ${isDarkMode ? 'text-red-200/80' : 'text-red-900/80'}`}>「{chapterError.title}」没有加载成功，可能是网络问题。</p>
                      <button onClick={() => { const e = chapterError; setChapterError(null); go({ view: 'content', storyId: e.storyId, fileName: e.fileName, chapterTitle: e.title, chapterIndex: e.chapterIndex }); }} className={`text-[11px] font-sans font-black uppercase tracking-[0.2em] underline underline-offset-4 decoration-1 transition-opacity hover:opacity-70 ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>重试 / RETRY</button>
                    </div>
                    <button onClick={() => setChapterError(null)} aria-label="关闭提示" className={`shrink-0 mt-0.5 transition-opacity hover:opacity-100 opacity-40 ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}><X size={14} /></button>
                  </div>
                )}
                <div className="grid gap-4">
                  {currentStory.chapters?.map((chapter, idx) => (
                    <button key={idx} onClick={() => openChapter(currentStory, chapter.fileName, chapter.title, idx)} className={`p-6 border rounded-2xl text-left transition-all group flex justify-between items-center ${isDarkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-black/5 bg-white hover:bg-black/5'}`}>
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
                        const blockRegex = /(\[\s*quote\s*\][\s\S]*?\[\s*\/quote\s*\]|\[\s*box\s*\][\s\S]*?\[\s*\/box\s*\]|\[\s*bubble:[LR]\s*\][\s\S]*?\[\s*\/bubble\s*\]|\[\s*bvid:[^\]]+\]|\[\s*youtube:[^\]]+\]|---)/g;
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
                            // 只取视频号，其余内容一律丢弃，避免把任意字符串拼进 iframe src
                            const bvid = part.match(/bvid:\s*([A-Za-z0-9]+)/)?.[1];
                            if (!bvid) return <p key={idx} className="mb-5 min-h-[1.5em]">{part}</p>;
                            return (<div key={idx} className="my-10 aspect-video w-full overflow-hidden rounded-2xl shadow-2xl bg-black ring-1 ring-white/10"><iframe src={`//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`} className="w-full h-full border-none" allowFullScreen loading="lazy" /></div>);
                          }
                          if (/\[\s*youtube:/.test(part)) {
                            // 支持 [youtube:ID] 和 [youtube:ID&t=12s] 两种写法。
                            // 以前正则只吃 [A-Za-z0-9_-]，带 &t= 的标签匹配不上，会原样显示成一行文字。
                            const ytRaw = (part.match(/youtube:\s*([^\]]+)/)?.[1] || '').trim();
                            const ytId = ytRaw.match(/^([A-Za-z0-9_-]+)/)?.[1];
                            if (!ytId) return <p key={idx} className="mb-5 min-h-[1.5em]">{part}</p>;
                            // 只放行起始秒数，其余参数忽略
                            const ytStart = ytRaw.match(/[?&]t=(\d+)s?/)?.[1];
                            return (<div key={idx} className="my-10 aspect-video w-full overflow-hidden rounded-2xl shadow-2xl bg-black ring-1 ring-white/10"><iframe src={`https://www.youtube.com/embed/${ytId}${ytStart ? `?start=${ytStart}` : ''}`} className="w-full h-full border-none" allowFullScreen loading="lazy" /></div>);
                          }
                          if (trimmedPart === '---') return <hr key={idx} className={`my-16 border-t ${isDarkMode ? 'border-white/10' : 'border-black/10'}`} />;
                          return part.split('\n').map((line, lIdx) => {
                            if (line === '') return <div key={lIdx} className="h-8" />;
                            return <p key={`${idx}-${lIdx}`} className="mb-5 min-h-[1.5em]" dangerouslySetInnerHTML={{ __html: applyInlineStyles(line) }} />;
                          });
                        });
                      })()}
                    </article>

                    {currentStory.chapters && currentStory.chapters.length > 1 && (() => {
                      const chapters = currentStory.chapters;
                      // 用下标定位，标题重复或为空都不会跳错章
                      const currentIndex = typeof currentStory.currentChapterIndex === 'number' && currentStory.currentChapterIndex >= 0
                        ? currentStory.currentChapterIndex
                        : chapters.findIndex(c => c.fileName === currentStory.currentFile);
                      return (
                        <div className={`flex justify-between items-center py-12 border-t mt-16 gap-4 ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
                          <div className="flex-1 text-left">
                            {currentIndex > 0 && (
                              <button onClick={() => openChapter(currentStory, chapters[currentIndex - 1].fileName, chapters[currentIndex - 1].title, currentIndex - 1)} className={`group flex flex-col gap-2 transition-all text-left ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/30 hover:text-black'}`}>
                                <span className="text-[9px] uppercase tracking-[0.2em] font-sans font-black flex items-center gap-1"><ChevronLeft size={12} /> Previous / 上一章</span>
                                <span className="text-sm font-serif italic font-bold">{chapters[currentIndex - 1].title}</span>
                              </button>
                            )}
                          </div>
                          <div className="flex-1 text-right">
                            {currentIndex >= 0 && currentIndex < chapters.length - 1 && (
                              <button onClick={() => openChapter(currentStory, chapters[currentIndex + 1].fileName, chapters[currentIndex + 1].title, currentIndex + 1)} className={`group flex flex-col items-end gap-2 transition-all ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/30 hover:text-black'}`}>
                                <span className="text-[9px] uppercase tracking-[0.2em] font-sans font-black flex items-center gap-1">Next / 下一章 <ChevronLeft size={12} className="rotate-180" /></span>
                                <span className="text-sm font-serif italic font-bold">{chapters[currentIndex + 1].title}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
          <div className="max-w-[600px] mx-auto space-y-3 normal-case leading-relaxed mb-12 text-center font-black"><p>本站存档内容包含部分分级作品（R18），仅供成年人浏览。继续访问即代表您已年满 18 周岁。</p><p>本站仅作为 Postype 平台 녘랜 (花汪) 同人文作品的翻译交流与存档使用，版权归原作者所有。</p><p>站内内容全是机翻，如有侵权请联系删除。</p><p className="font-bold">联系微博：<span>@恋花症-</span></p></div>
          <p className="italic font-sans tracking-[0.2em] cursor-default select-none text-center">© 2026 HW ARCHIVE.</p>
        </footer>
      </motion.div>
      <Analytics />
    </div>
  );
}
