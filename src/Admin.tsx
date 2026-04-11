import React, { useState, useEffect } from 'react';
import { Octokit } from "octokit";
import { ChevronLeft, Key, Edit3, List, PlusCircle, Trash2, RotateCw, X } from 'lucide-react';
import LiveContentEditor from './LiveContentEditor';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

const RAW_GITHUB_INDEX = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/public/stories/index.json`;

// --- 辅助工具：处理 GitHub 的 Base64 编解码（支持中文） ---
const encodeContent = (str: string) => {
  return btoa(unescape(encodeURIComponent(str)));
};

const decodeContent = (base64: string) => {
  // 必须先移除换行符，否则 atob 会报错
  const cleanBase64 = base64.replace(/\s/g, '');
  return decodeURIComponent(escape(atob(cleanBase64)));
};

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [view, setView] = useState<'create' | 'list'>('list'); 
  const [stories, setStories] = useState<any[]>([]); 
  const [isListLoading, setIsListLoading] = useState(false);

  // 表单状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [editingFileSha, setEditingFileSha] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [readerDark, setReaderDark] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [previewFontSize] = useState(18);

  // --- 获取列表 ---
  const fetchStories = async () => {
    setIsListLoading(true);
    try {
      const res = await fetch(`${RAW_GITHUB_INDEX}?v=${Date.now()}`);
      if (!res.ok) throw new Error("Index file not found");
      const data = await res.json();
      setStories(data || []);
    } catch (err) { 
      setStatus("列表获取失败，请确认 index.json 路径正确"); 
    } finally { 
      setIsListLoading(false); 
    }
  };

  useEffect(() => { fetchStories(); }, []);

  // --- 主题与环境监听 ---
  useEffect(() => {
    const readTheme = () => {
      const s = localStorage.getItem('theme');
      if (s === 'dark') setReaderDark(true);
      else if (s === 'light') setReaderDark(false);
      else setReaderDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };
    readTheme();
    window.addEventListener('storage', readTheme);
    const mq = window.matchMedia('(max-width: 767px)');
    const onMq = () => setIsMobileViewport(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    return () => {
      window.removeEventListener('storage', readTheme);
      mq.removeEventListener('change', onMq);
    };
  }, []);

  // --- 获取 GitHub 文件的通用逻辑 ---
  const getGHFile = async (octokit: Octokit, path: string) => {
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER, repo: REPO_NAME, path,
      request: { cache: 'no-store' }
    });
    if ("content" in data) return data;
    throw new Error("Target is not a file");
  };

  // --- 删除指定章节 ---
  const handleDeleteChapter = async (story: any, fileName: string, cTitle: string) => {
    if (!token) return alert("请先输入 Token");
    if (!window.confirm(`确定删除章节：${cTitle} 吗？`)) return;

    setIsPublishing(true);
    setStatus('正在同步 GitHub...');

    try {
      const octokit = new Octokit({ auth: token });
      
      // 1. 删除 TXT 文件
      const fileInfo = await getGHFile(octokit, `public/stories/${fileName}`);
      await octokit.rest.repos.deleteFile({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Delete chapter: ${cTitle}`,
        sha: fileInfo.sha, branch: BRANCH
      });

      // 2. 更新 index.json
      const idxF = await getGHFile(octokit, `public/stories/index.json`);
      let indexData = JSON.parse(decodeContent(idxF.content));
      
      const sIdx = indexData.findIndex((s: any) => s.id === story.id);
      if (sIdx !== -1) {
        if (indexData[sIdx].chapters) {
          indexData[sIdx].chapters = indexData[sIdx].chapters.filter((c: any) => c.fileName !== fileName);
          if (indexData[sIdx].chapters.length === 0) {
            indexData = indexData.filter((s: any) => s.id !== story.id);
          }
        } else {
          indexData = indexData.filter((s: any) => s.id !== story.id);
        }
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        sha: idxF.sha,
        message: `Update index: remove ${cTitle}`,
        content: encodeContent(JSON.stringify(indexData, null, 2)),
        branch: BRANCH
      });

      setStatus('删除成功');
      setTimeout(() => { fetchStories(); setStatus(''); setIsPublishing(false); }, 1000);
    } catch (err: any) {
      alert(`操作失败: ${err.message}`);
      setIsPublishing(false);
    }
  };

  // --- 删除整个故事 ---
  const handleDelete = async (story: any) => {
    if (!token) return alert("请先输入 Token");
    if (!window.confirm(`确定彻底删除《${story.title}》吗？`)) return;

    setIsPublishing(true);
    setStatus('清理文件中...');

    try {
      const octokit = new Octokit({ auth: token });
      const filesToDelete = story.chapters ? story.chapters.map((c: any) => c.fileName) : [story.fileName];

      for (const fName of filesToDelete) {
        try {
          const f = await getGHFile(octokit, `public/stories/${fName}`);
          await octokit.rest.repos.deleteFile({
            owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fName}`,
            message: `Delete story file`, sha: f.sha, branch: BRANCH
          });
        } catch (e) { console.warn("Skip:", fName); }
      }

      const idxF = await getGHFile(octokit, `public/stories/index.json`);
      let indexData = JSON.parse(decodeContent(idxF.content));
      const newIndex = indexData.filter((s: any) => s.id !== story.id);

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        sha: idxF.sha, message: `Delete story: ${story.title}`,
        content: encodeContent(JSON.stringify(newIndex, null, 2)), branch: BRANCH
      });

      setStatus('已全量删除');
      setTimeout(() => { fetchStories(); setStatus(''); setIsPublishing(false); }, 1000);
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
      setIsPublishing(false);
    }
  };

  // --- 编辑/续传逻辑 ---
  const handleEdit = async (story: any, fileName: string, cTitle: string = '') => {
    if (!token) return alert("操作需要 Token");
    setIsPublishing(true); setStatus('载入中...');
    try {
      const octokit = new Octokit({ auth: token });
      const file = await getGHFile(octokit, `public/stories/${fileName}`);
      const text = decodeContent(file.content);
      
      setEditingId(story.id);
      setEditingFileName(fileName);
      setEditingFileSha(file.sha);
      setTitle(story.title);
      setAuthor(story.author);
      setSourceLink(story.sourceLink || '');
      setChapterTitle(cTitle);
      setContent(text);
      setView('create');
      setStatus('加载成功');
    } catch (err: any) { alert("读取失败"); }
    finally { setIsPublishing(false); }
  };

  const handleAddChapter = (story: any) => {
    setEditingId(story.id); setEditingFileName(null); setEditingFileSha(null);
    setTitle(story.title); setAuthor(story.author); setSourceLink(story.sourceLink || '');
    setChapterTitle(`第 ${story.chapters ? story.chapters.length + 1 : 2} 节`);
    setContent(''); setView('create');
  };

  // --- 发布/保存 ---
  const handlePublish = async () => {
    if (!token || !title || !content) return alert("必填项不能为空");
    setIsPublishing(true); setStatus('同步至 GitHub...');
    try {
      const octokit = new Octokit({ auth: token });
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}_${Date.now()}.txt`;

      // 1. 保存正文
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Update content: ${title}`, 
        content: encodeContent(content),
        sha: editingFileSha || undefined, branch: BRANCH
      });

      // 2. 更新 Index
      const idxF = await getGHFile(octokit, `public/stories/index.json`);
      let indexData = JSON.parse(decodeContent(idxF.content));
      const idx = indexData.findIndex((s: any) => s.id === storyId);

      if (idx === -1) {
        const newEntry: any = { id: storyId, title, author, sourceLink };
        if (chapterTitle) newEntry.chapters = [{ title: chapterTitle, fileName }];
        else newEntry.fileName = fileName;
        indexData = [newEntry, ...indexData];
      } else {
        const s = indexData[idx];
        s.title = title; s.author = author; s.sourceLink = sourceLink;
        if (editingFileName) {
          if (s.chapters) {
            const ci = s.chapters.findIndex((c: any) => c.fileName === editingFileName);
            if (ci !== -1) s.chapters[ci].title = chapterTitle;
          }
        } else {
          if (!s.chapters) {
            s.chapters = [{ title: "第 1 节", fileName: s.fileName }, { title: chapterTitle, fileName }];
            delete s.fileName;
          } else {
            s.chapters.push({ title: chapterTitle, fileName });
          }
        }
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        sha: idxF.sha, message: `Update Index`,
        content: encodeContent(JSON.stringify(indexData, null, 2)), branch: BRANCH
      });

      setStatus('发布成功！');
      setTimeout(() => {
        fetchStories();
        setView('list');
        resetForm();
      }, 1000);
    } catch (err: any) { 
      setStatus(`错误: ${err.message}`); 
      setIsPublishing(false); 
    }
  };

  const resetForm = () => {
    setEditingId(null); setEditingFileName(null); setEditingFileSha(null);
    setTitle(''); setAuthor(''); setChapterTitle(''); setSourceLink('');
    setContent(''); setStatus(''); setIsPublishing(false);
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
      <header className="flex justify-between items-center mb-10 pb-4 border-b dark:border-white/10">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-black dark:hover:text-white font-bold uppercase tracking-widest transition-colors">
          <ChevronLeft size={16}/> EXIT
        </button>
        <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 bg-slate-500/5 px-3 py-1.5 rounded-full border border-black/10">
               <Key size={14} className="opacity-40"/>
               <input type="password" value={token} onChange={e => { setToken(e.target.value); localStorage.setItem('gh_token', e.target.value); }} className="bg-transparent w-32 focus:w-48 transition-all outline-none text-[10px]" placeholder="GitHub Token" />
            </div>
            <button onClick={() => { if(view==='create') resetForm(); setView(view === 'create' ? 'list' : 'create'); }} className="bg-slate-900 text-white dark:bg-white dark:text-black px-6 py-2 rounded-full font-black uppercase text-xs hover:scale-105 transition-all shadow-xl">
                {view === 'create' ? <><List size={14} className="mr-1 inline"/> Manage</> : <><Edit3 size={14} className="mr-1 inline"/> New Story</>}
            </button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-3xl font-black font-serif italic tracking-tight">Archive Management</h2>
               <button onClick={fetchStories} disabled={isListLoading} className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-all ${isListLoading ? 'animate-spin' : ''}`}>
                 <RotateCw size={20} className="opacity-40" />
               </button>
            </div>
            
            {status && <div className="text-xs font-bold text-blue-500 mb-4 animate-pulse">{status}</div>}
            
            {isListLoading ? <div className="py-20 text-center opacity-20 uppercase tracking-[0.3em]">Loading Index...</div> : stories.map(s => (
                <div key={s.id} className="p-6 border dark:border-white/10 rounded-2xl bg-white dark:bg-black/20 shadow-sm mb-4">
                    <div className="flex justify-between items-start mb-4">
                        <div><span className="font-bold text-xl block">{s.title}</span><span className="text-[10px] opacity-40 uppercase font-mono">{s.author}</span></div>
                        <div className="flex gap-2">
                           <button onClick={() => handleAddChapter(s)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase hover:bg-blue-700 transition-all"><PlusCircle size={14}/> 续传/分P</button>
                           <button onClick={() => handleDelete(s)} disabled={isPublishing} className="p-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-full hover:bg-red-600 hover:text-white transition-all disabled:opacity-30"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap border-t dark:border-white/5 pt-4">
                        <span className="text-[9px] opacity-30 uppercase w-full mb-1 font-bold">Chapters:</span>
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <div key={i} className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-lg pr-1 group">
                                <button onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1.5 text-xs hover:text-blue-600 transition-all">{c.title}</button>
                                <button onClick={() => handleDeleteChapter(s, c.fileName, c.title)} className="p-1 hover:bg-red-500 hover:text-white rounded transition-all opacity-0 group-hover:opacity-100 text-red-500">
                                  <X size={12}/>
                                </button>
                            </div>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-xs italic text-blue-500">单页正文 (点击编辑)</button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-500">
          <h2 className="text-2xl font-black font-serif italic">{editingId ? 'Edit Content' : 'Post New Story'}</h2>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-black/20 lg:sticky lg:top-4 h-fit">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-30">Global Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border-b-2 border-slate-200 bg-transparent py-2 text-2xl font-black outline-none focus:border-blue-500 dark:border-slate-800" placeholder="总标题..."/>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-30">Author</label>
                  <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full rounded-xl bg-slate-100 p-3 outline-none dark:bg-white/5" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-500">Chapter Title</label>
                  <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="w-full rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 font-bold text-blue-600 outline-none dark:bg-blue-500/10" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-30">Source Link</label>
                <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full rounded-xl bg-slate-100 p-3 text-xs outline-none dark:bg-white/5" />
              </div>
              {status && <div className="text-xs font-bold text-blue-500 animate-pulse">{status}</div>}
              <button onClick={handlePublish} disabled={isPublishing} className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-black tracking-widest text-white shadow-xl hover:bg-blue-700 disabled:bg-slate-400 transition-all">
                {isPublishing ? 'PUBLISHING...' : 'POST TO ARCHIVE'}
              </button>
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40">正文编辑</label>
              <LiveContentEditor
                content={content}
                onChange={setContent}
                readerDark={readerDark}
                isMobileViewport={isMobileViewport}
                fontSize={previewFontSize}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
