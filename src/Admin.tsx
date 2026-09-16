import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Octokit } from "octokit";
import { 
  ChevronLeft, Key, Edit3, List, Bold, Italic, Quote, MessageSquare, 
  Minus, Video, PlusCircle, Square, Trash2, RotateCw, X, Clock
} from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

const RAW_GITHUB_INDEX = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/public/stories/index.json`;
const RAW_GITHUB_LOGS = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/public/stories/logs.json`;

const INDEX_PATH = 'public/stories/index.json';
const LOGS_PATH = 'public/stories/logs.json';
const TOKEN_KEY = 'gh_token';

const b64encode = (s: string) => btoa(unescape(encodeURIComponent(s)));
const b64decode = (s: string) => decodeURIComponent(escape(atob(s)));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const FETCH_TIMEOUT = 10000;

/** 带超时的请求。raw.githubusercontent.com 在国内经常连不上，
 *  不加超时的话后台会永远停在加载中，连"失败"都看不到 */
const fetchWithTimeout = async (url: string, timeout = FETCH_TIMEOUT) => {
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

/** GitHub 的乐观锁冲突（sha 过期）会自动重试，避免并发写失败 */
const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e: any) {
      lastErr = e;
      if (e?.status !== 409 && e?.status !== 422) throw e;
      await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
};

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [view, setView] = useState<'create' | 'list' | 'logs'>('list'); // 🌟 增加 logs 视图
  const [stories, setStories] = useState<any[]>([]); 
  const [logs, setLogs] = useState<any[]>([]);       // 🌟 日志状态
  const [isListLoading, setIsListLoading] = useState(false);

  // 表单状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [editingFileSha, setEditingFileSha] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [isR18, setIsR18] = useState(false);
  const [content, setContent] = useState('');
  
  // 日志表单
  const [logDate, setLogDate] = useState(new Date().toLocaleDateString());
  const [logContent, setLogContent] = useState('');

  const [status, setStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  // 有未发布的改动时，离开前先问一句
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tokenTimer = useRef<number | undefined>(undefined);
  const tokenRef = useRef(token);

  const octokitFor = (auth: string) => new Octokit({ auth });

  const getFile = async (octokit: Octokit, path: string) => {
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER, repo: REPO_NAME, path, request: { cache: 'no-store' },
    });
    return data as any;
  };

  const fetchStories = async () => {
    setIsListLoading(true);
    try {
      const data = await fetchWithTimeout(`${RAW_GITHUB_INDEX}?v=${Date.now()}`);
      setStories(Array.isArray(data) ? data : []);
    } catch (err) { setStatus("列表获取失败"); }
    finally { setIsListLoading(false); }
  };

  const fetchLogs = async () => {
    try {
      const data = await fetchWithTimeout(`${RAW_GITHUB_LOGS}?v=${Date.now()}`);
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      // 不能静默清空：否则日志拉取失败时看起来像"一条日志都没有"
      setLogs([]);
      setStatus("日志获取失败，请检查网络后刷新");
      setTimeout(() => setStatus(''), 3000);
    }
  };

  useEffect(() => { fetchStories(); fetchLogs(); }, []);

  // Token 改为防抖写入，不再每敲一个字符就落盘
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => () => {
    if (tokenTimer.current !== undefined) {
      window.clearTimeout(tokenTimer.current);
      try { localStorage.setItem(TOKEN_KEY, tokenRef.current); } catch {}
    }
  }, []);

  const handleTokenChange = (value: string) => {
    setToken(value);
    if (tokenTimer.current !== undefined) window.clearTimeout(tokenTimer.current);
    tokenTimer.current = window.setTimeout(() => {
      tokenTimer.current = undefined;
      try { localStorage.setItem(TOKEN_KEY, value); } catch {}
    }, 600);
  };

  // 未保存提醒
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const confirmDiscard = useCallback(() => {
    if (!dirty) return true;
    return window.confirm('当前内容尚未发布，确定离开吗？未保存的修改会丢失。');
  }, [dirty]);

  const insertTag = (e: React.MouseEvent, openTag: string, closeTag: string = '') => {
    e.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;
    const savedScrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const isBlock = openTag.includes('quote') || openTag.includes('bubble') || openTag.includes('box') || openTag.includes('youtube');
    let textToInsert = isBlock ? `\n${openTag}\n${selectedText || '内容'}\n${closeTag}\n` : `${openTag}${selectedText}${closeTag}`;
    const newContent = content.substring(0, start) + textToInsert + content.substring(end);
    setContent(newContent);
    setDirty(true);
    const newCursorPos = start + textToInsert.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.scrollTop = savedScrollTop;
      }
    }, 0);
  };

  const handleEdit = async (story: any, fileName: string, cTitle: string = '') => {
    if (!confirmDiscard()) return;
    setIsPublishing(true); setStatus('读取中...');
    try {
      const octokit = octokitFor(token);
      const f = await getFile(octokit, `public/stories/${fileName}`);
      setEditingId(story.id); setEditingFileName(fileName);
      setEditingFileSha(f.sha); setTitle(story.title); setAuthor(story.author);
      setSourceLink(story.sourceLink || ''); setChapterTitle(cTitle); setContent(b64decode(f.content));
      setIsR18(story.isR18 || false);
      setDirty(false);
      setView('create'); setStatus('加载成功');
    } catch (err) { alert("失败"); } finally { setIsPublishing(false); }
  };

  // 「续传/分P」：新建一个章节文件，必须把上一篇的残留内容清干净
  const startNewChapter = (story: any) => {
    if (!confirmDiscard()) return;
    setEditingId(story.id);
    setEditingFileName(null);
    setEditingFileSha(null);
    setTitle(story.title);
    setAuthor(story.author);
    setSourceLink(story.sourceLink || '');
    setIsR18(story.isR18 || false);
    setChapterTitle('');
    setContent('');
    setDirty(false);
    setStatus('');
    setView('create');
  };

  const handleNewStory = () => {
    if (view === 'create') {
      if (!confirmDiscard()) return;
      setView('list');
      return;
    }
    if (!confirmDiscard()) return;
    resetForm();
    setView('create');
  };

  const switchView = (next: 'create' | 'list' | 'logs') => {
    if (next === view) return;
    if (!confirmDiscard()) return;
    setView(next);
  };

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("必填项为空");
    setIsPublishing(true); setStatus('同步至 GitHub...');
    try {
      const octokit = octokitFor(token);
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}_${Date.now()}.txt`;

      // 正文：重新取一次 sha 再写，避免拿到过期的 sha
      await withRetry(async () => {
        let sha: string | undefined;
        try { sha = (await getFile(octokit, `public/stories/${fileName}`)).sha; } catch {}
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
          message: `Update`, content: b64encode(content), sha, branch: BRANCH,
        });
      });

      // 索引：每次重试都重新读一遍最新内容，避免覆盖别人的改动
      await withRetry(async () => {
        const idxF = await getFile(octokit, INDEX_PATH);
        let indexData: any[] = JSON.parse(b64decode(idxF.content));
        const idx = indexData.findIndex((s: any) => s.id === storyId);
        if (idx === -1) {
          const newS: any = { id: storyId, title, author, sourceLink, isR18, date: new Date().toISOString() };
          if (chapterTitle) newS.chapters = [{ title: chapterTitle, fileName }];
          else newS.fileName = fileName;
          indexData = [newS, ...indexData];
        } else {
          const s = indexData[idx];
          s.title = title; s.author = author; s.sourceLink = sourceLink;
          s.isR18 = isR18;
          if (editingFileName && s.chapters) {
            const ci = s.chapters.findIndex((c: any) => c.fileName === editingFileName);
            if (ci !== -1) s.chapters[ci].title = chapterTitle;
          } else if (!s.chapters) {
            s.chapters = [{ title: "第 1 节", fileName: s.fileName }, { title: chapterTitle, fileName }];
            delete s.fileName;
          } else { s.chapters.push({ title: chapterTitle, fileName }); }
        }
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: REPO_OWNER, repo: REPO_NAME, path: INDEX_PATH,
          sha: idxF.sha, message: `Index`, content: b64encode(JSON.stringify(indexData, null, 2)), branch: BRANCH,
        });
      });

      setStatus('成功！');
      setDirty(false);
      setTimeout(() => { fetchStories(); setView('list'); setStatus(''); resetForm(); setIsPublishing(false); }, 1000);
    } catch (err: any) { setStatus(`错误: ${err.message}`); setIsPublishing(false); }
  };

  // 🌟 保存日志逻辑：写入前重新拉一次最新日志，避免用本地旧列表覆盖
  const handleSaveLogs = async () => {
    if (!token || !logContent) return alert("内容不能为空");
    setIsPublishing(true); setStatus('同步日志...');
    try {
      const octokit = octokitFor(token);
      const newLog = { date: logDate, content: logContent };
      let saved: any[] = [];

      await withRetry(async () => {
        let sha: string | undefined;
        let current: any[] = [];
        try {
          const f = await getFile(octokit, LOGS_PATH);
          sha = f.sha;
          const parsed = JSON.parse(b64decode(f.content));
          if (!Array.isArray(parsed)) throw new Error('日志文件格式异常');
          current = parsed;
        } catch (e: any) {
          // 只有"文件还不存在"才能当作空列表继续；
          // 读取或解析失败必须中止——否则会拿着空数组把已有日志全覆盖掉
          if (e?.status !== 404) throw e;
        }

        saved = [newLog, ...current];
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: REPO_OWNER, repo: REPO_NAME, path: LOGS_PATH,
          sha, message: `Update Logs`, content: b64encode(JSON.stringify(saved, null, 2)), branch: BRANCH,
        });
      });

      setLogs(saved);
      setStatus('日志更新成功！');
      setLogContent('');
      setDirty(false);
      setTimeout(() => { setStatus(''); setIsPublishing(false); }, 1000);
    } catch (err: any) { alert(err.message); setIsPublishing(false); }
  };

  const resetForm = () => {
    setEditingId(null); setEditingFileName(null); setEditingFileSha(null);
    setTitle(''); setAuthor(''); setChapterTitle(''); setSourceLink('');
    setIsR18(false); setContent(''); setStatus(''); setDirty(false);
  };

  const handleDeleteChapter = async (story: any, fileName: string, cTitle: string) => {
    if (!token) return alert("请先输入 Token");
    if (!window.confirm(`确定删除章节：${cTitle} 吗？`)) return;
    setIsPublishing(true); setStatus('正在删除...');
    try {
      const octokit = octokitFor(token);
      await withRetry(async () => {
        const fileInfo = await getFile(octokit, `public/stories/${fileName}`);
        await octokit.rest.repos.deleteFile({
          owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
          message: `Delete`, sha: fileInfo.sha, branch: BRANCH,
        });
      });
      await withRetry(async () => {
        const idxF = await getFile(octokit, INDEX_PATH);
        let indexData: any[] = JSON.parse(b64decode(idxF.content));
        const sIdx = indexData.findIndex((s: any) => s.id === story.id);
        if (sIdx !== -1 && indexData[sIdx].chapters) {
          indexData[sIdx].chapters = indexData[sIdx].chapters.filter((c: any) => c.fileName !== fileName);
          if (indexData[sIdx].chapters.length === 0) indexData = indexData.filter((s: any) => s.id !== story.id);
        }
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: REPO_OWNER, repo: REPO_NAME, path: INDEX_PATH,
          sha: idxF.sha, message: `Update`, content: b64encode(JSON.stringify(indexData, null, 2)), branch: BRANCH,
        });
      });
      setStatus('删除成功！'); setTimeout(() => { fetchStories(); setStatus(''); setIsPublishing(false); }, 1000);
    } catch (err) { alert("失败"); setIsPublishing(false); }
  };

  const handleDelete = async (story: any) => {
    if (!token) return alert("需要 Token");
    if (!window.confirm(`确定删除整篇《${story.title}》吗？`)) return;
    setIsPublishing(true); setStatus('清理中...');
    try {
      const octokit = octokitFor(token);
      const files = story.chapters ? story.chapters.map((c: any) => c.fileName) : [story.fileName];
      for (const fName of files) {
        try {
          await withRetry(async () => {
            const f = await getFile(octokit, `public/stories/${fName}`);
            await octokit.rest.repos.deleteFile({
              owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fName}`,
              message: `Delete`, sha: f.sha, branch: BRANCH,
            });
          });
        } catch (e) {}
      }
      await withRetry(async () => {
        const idxF = await getFile(octokit, INDEX_PATH);
        const indexData: any[] = JSON.parse(b64decode(idxF.content));
        const newIndex = indexData.filter((s: any) => s.id !== story.id);
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: REPO_OWNER, repo: REPO_NAME, path: INDEX_PATH,
          sha: idxF.sha, message: `Delete story`, content: b64encode(JSON.stringify(newIndex, null, 2)), branch: BRANCH,
        });
      });
      setStatus('删除成功'); setTimeout(() => { fetchStories(); setStatus(''); setIsPublishing(false); }, 1000);
    } catch (err) { setIsPublishing(false); }
  };

  const handleExit = () => {
    if (!confirmDiscard()) return;
    if (tokenTimer.current !== undefined) {
      window.clearTimeout(tokenTimer.current);
      tokenTimer.current = undefined;
      try { localStorage.setItem(TOKEN_KEY, token); } catch {}
    }
    onBack();
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
      <header className="flex justify-between items-center mb-10 pb-4 border-b dark:border-white/10">
        <button onClick={handleExit} className="flex items-center gap-2 text-slate-500 hover:text-black dark:hover:text-white font-bold tracking-widest">
          <ChevronLeft size={16}/> EXIT
        </button>
        <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 bg-slate-500/5 px-3 py-1.5 rounded-full border border-black/10">
               <Key size={14} className="opacity-40"/>
               <input type="password" value={token} onChange={e => handleTokenChange(e.target.value)} className="bg-transparent w-32 focus:w-48 outline-none text-[10px]" placeholder="GitHub Token" />
            </div>
            {/* 🌟 增加 Edit Logs 按钮 */}
            <button onClick={() => switchView('logs')} className={`p-2 rounded-full transition-all ${view === 'logs' ? 'bg-blue-600 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-40'}`} title="Edit Logs" aria-label="编辑更新日志"><Clock size={20}/></button>
            <button onClick={handleNewStory} className="bg-slate-900 text-white dark:bg-white dark:text-black px-6 py-2 rounded-full font-black text-xs shadow-xl">
                {view === 'create' ? 'Manage' : 'New Story'}
            </button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-3xl font-black italic tracking-tight">Archive Management</h2>
               <button onClick={fetchStories} disabled={isListLoading} aria-label="刷新列表" className={`p-2 ${isListLoading ? 'animate-spin' : ''}`}>
                 <RotateCw size={20} className="opacity-40" />
               </button>
            </div>
            {status && <div className="text-xs font-bold text-blue-500 mb-4 animate-pulse">{status}</div>}
            {isListLoading ? <div className="py-20 text-center opacity-20 uppercase tracking-[0.3em]">Loading Index...</div> : stories.map(s => (
                <div key={s.id} className="p-6 border dark:border-white/10 rounded-2xl bg-white dark:bg-black/20 shadow-sm mb-4">
                    <div className="flex justify-between items-start mb-4">
                        <div><span className="font-bold text-xl block">{s.title}</span><span className="text-[10px] opacity-40 uppercase font-mono">{s.author}</span></div>
                        <div className="flex gap-2">
                           <button onClick={() => startNewChapter(s)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase transition-all hover:bg-blue-700">续传/分P</button>
                           <button onClick={() => handleDelete(s)} disabled={isPublishing} className="p-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-full hover:bg-red-600 hover:text-white transition-all disabled:opacity-30"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap border-t dark:border-white/5 pt-4">
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <div key={i} className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-lg pr-1 group">
                                <button onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1.5 text-xs hover:text-blue-600 transition-all">{c.title}</button>
                                <button onClick={() => handleDeleteChapter(s, c.fileName, c.title)} className="p-1 hover:bg-red-500 hover:text-white rounded transition-all opacity-0 group-hover:opacity-100 text-red-500">
                                  <X size={12}/>
                                </button>
                            </div>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-xs italic text-blue-500">编辑正文</button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : view === 'logs' ? (
        // 🌟 独立的日志编辑视图
        <div className="max-w-xl mx-auto space-y-8 animate-in fade-in">
           <h2 className="text-2xl font-black italic">更新日志</h2>
           <div className="bg-white dark:bg-black/20 p-8 rounded-3xl border dark:border-white/10 space-y-6 shadow-2xl">
              <div className="space-y-1">
                 <label className="text-[10px] font-black opacity-30 uppercase">Date</label>
                 <input value={logDate} onChange={e => { setLogDate(e.target.value); setDirty(true); }} className="w-full bg-transparent border-b-2 dark:border-slate-800 py-2 text-xl font-bold outline-none" />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black opacity-30 uppercase">What's New?</label>
                 <textarea value={logContent} onChange={e => { setLogContent(e.target.value); setDirty(true); }} className="w-full h-32 bg-slate-50 dark:bg-white/5 p-4 rounded-xl outline-none" placeholder="例如：新增 R18 标识，优化 iPad 适配..." />
              </div>
              {status && <div className="text-xs font-bold text-blue-500">{status}</div>}
              <button onClick={handleSaveLogs} disabled={isPublishing} className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all">SAVE LOG ENTRY</button>
           </div>
           
           <div className="space-y-4">
              <h3 className="text-[10px] font-black opacity-30 uppercase tracking-widest">History Logs</h3>
              {logs.map((l, i) => (
                <div key={i} className="p-4 border dark:border-white/10 rounded-xl bg-white/5">
                  <div className="font-bold text-xs mb-1">{l.date}</div>
                  <div className="text-xs opacity-60">{l.content}</div>
                </div>
              ))}
           </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black font-serif italic">{editingId ? 'Edit Content' : 'Post New Story'}</h2>
            <div className="bg-white dark:bg-black/20 p-8 rounded-3xl border dark:border-white/10 space-y-6 shadow-2xl">
               <div className="space-y-1">
                  <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Global Title</label>
                  <input value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-2 text-2xl font-black focus:border-blue-500 outline-none transition-all" placeholder="总标题..." />
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Author</label>
                    <input value={author} onChange={e => { setAuthor(e.target.value); setDirty(true); }} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-xl outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Chapter Title</label>
                    <input value={chapterTitle} onChange={e => { setChapterTitle(e.target.value); setDirty(true); }} className="w-full bg-blue-500/5 dark:bg-blue-500/10 p-3 rounded-xl outline-none border border-blue-500/20 text-blue-600 font-bold" placeholder="章节名" />
                  </div>
               </div>
               <div className="flex items-center gap-4 pt-2">
                 <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Rating / 分级</label>
                 <button type="button" onClick={() => { setIsR18(!isR18); setDirty(true); }} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all border ${isR18 ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-transparent border-slate-300 dark:border-white/20 opacity-40 hover:opacity-100'}`}>{isR18 ? 'R18 RESTRICTED' : 'General'}</button>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Source Link</label>
                  <input value={sourceLink} onChange={e => { setSourceLink(e.target.value); setDirty(true); }} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-xl outline-none text-xs" />
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Content Editor</label>
                  <div className="flex flex-wrap gap-2">
                    {[ ['**','**',Bold], ['*','*',Italic], ['[box]','[/box]',Square], ['[quote]','[/quote]',Quote], ['[bubble:L]','[/bubble]',MessageSquare], ['[bubble:R]','[/bubble]',MessageSquare], ['---','',Minus], ['[bvid:',']',Video] ].map(([ot,ct,Icon]:any, i) => (
                      <button key={i} type="button" onClick={(e) => insertTag(e, ot, ct)} className={`p-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all bg-slate-100 dark:bg-white/10 ${ot.includes(':R') ? 'text-blue-500' : ''}`}><Icon size={16}/></button>
                    ))}
                  </div>
                  <textarea ref={textareaRef} value={content} onChange={e => { setContent(e.target.value); setDirty(true); }} className="w-full h-[500px] bg-slate-50 dark:bg-white/5 p-6 rounded-2xl outline-none leading-relaxed text-base font-serif" placeholder="内容..." />
               </div>
               {status && <div className="text-xs font-bold text-blue-500 animate-pulse">{status}</div>}
               <button onClick={handlePublish} disabled={isPublishing} className="w-full py-5 rounded-2xl bg-blue-600 text-white font-black text-lg tracking-widest shadow-xl hover:bg-blue-700 transition-all disabled:bg-slate-400">
                 {isPublishing ? 'PUBLISHING...' : 'POST TO ARCHIVE'}
               </button>
            </div>
        </div>
      )}
    </div>
  );
}
