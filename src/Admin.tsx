import React, { useState, useEffect, useRef } from 'react';
import { Octokit } from "octokit";
import { 
  ChevronLeft, Key, Edit3, List, Bold, Italic, Quote, MessageSquare, 
  Minus, Video, PlusCircle, Square, Trash2, RotateCw, X 
} from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

const RAW_GITHUB_INDEX = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/public/stories/index.json`;

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
  const [isR18, setIsR18] = useState(false); // 🌟 新增：R18 分级状态
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchStories = async () => {
    setIsListLoading(true);
    try {
      const res = await fetch(`${RAW_GITHUB_INDEX}?v=${Date.now()}`);
      const data = await res.json();
      setStories(data || []);
    } catch (err) { setStatus("列表获取失败"); }
    finally { setIsListLoading(false); }
  };

  useEffect(() => { fetchStories(); }, []);

  const handleDeleteChapter = async (story: any, fileName: string, cTitle: string) => {
    if (!token) return alert("请先输入 Token");
    if (!window.confirm(`确定要删除章节：${cTitle} 吗？`)) return;
    setIsPublishing(true); setStatus('正在删除...');
    try {
      const octokit = new Octokit({ auth: token });
      const { data: fileInfo } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        request: { cache: 'no-store' }
      });
      await octokit.rest.repos.deleteFile({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Delete chapter: ${cTitle}`,
        // @ts-ignore
        sha: fileInfo.sha, branch: BRANCH
      });
      const { data: idxF } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, request: { cache: 'no-store' } });
      // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(idxF.content))));
      const sIdx = indexData.findIndex((s: any) => s.id === story.id);
      if (sIdx !== -1 && indexData[sIdx].chapters) {
        indexData[sIdx].chapters = indexData[sIdx].chapters.filter((c: any) => c.fileName !== fileName);
        if (indexData[sIdx].chapters.length === 0) indexData = indexData.filter((s: any) => s.id !== story.id);
      }
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        // @ts-ignore
        sha: idxF.sha, message: `Update Index`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))), branch: BRANCH
      });
      setStatus('删除成功！');
      setTimeout(() => { fetchStories(); setStatus(''); setIsPublishing(false); }, 1000);
    } catch (err: any) { alert("失败"); setIsPublishing(false); }
  };

  const handleDelete = async (story: any) => {
    if (!token) return alert("需要 Token");
    if (!window.confirm(`确定要删除整篇《${story.title}》吗？`)) return;
    setIsPublishing(true); setStatus('清理中...');
    try {
      const octokit = new Octokit({ auth: token });
      const files = story.chapters ? story.chapters.map((c: any) => c.fileName) : [story.fileName];
      for (const fName of files) {
        try {
          const { data: f } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fName}`, request: { cache: 'no-store' } });
          // @ts-ignore
          await octokit.rest.repos.deleteFile({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fName}`, message: `Delete`, sha: f.sha, branch: BRANCH });
        } catch (e) {}
      }
      const { data: idxF } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, request: { cache: 'no-store' } });
      // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(idxF.content))));
      const newIndex = indexData.filter((s: any) => s.id !== story.id);
      await octokit.rest.repos.createOrUpdateFileContents({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, // @ts-ignore
        sha: idxF.sha, message: `Delete story`, content: btoa(unescape(encodeURIComponent(JSON.stringify(newIndex, null, 2)))), branch: BRANCH
      });
      setStatus('删除成功'); setTimeout(() => { fetchStories(); setStatus(''); setIsPublishing(false); }, 1000);
    } catch (err) { setIsPublishing(false); }
  };

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
    const newCursorPos = start + textToInsert.length;
    const newContent = content.substring(0, start) + textToInsert + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.scrollTop = savedScrollTop;
      }
    }, 0);
  };

  const handleEdit = async (story: any, fileName: string, cTitle: string = '') => {
    setIsPublishing(true); setStatus('读取中...');
    try {
      const octokit = new Octokit({ auth: token });
      const { data: f } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`, request: { cache: 'no-store' } });
      // @ts-ignore
      const text = decodeURIComponent(escape(atob(f.content)));
      setEditingId(story.id); setEditingFileName(fileName); // @ts-ignore
      setEditingFileSha(f.sha); setTitle(story.title); setAuthor(story.author);
      setSourceLink(story.sourceLink || ''); setChapterTitle(cTitle); setContent(text);
      setIsR18(story.isR18 || false); // 🌟 加载文章的 R18 状态
      setView('create'); setStatus('加载成功');
    } catch (err) { alert("失败"); } finally { setIsPublishing(false); }
  };

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("必填项为空");
    setIsPublishing(true); setStatus('同步至 GitHub...');
    try {
      const octokit = new Octokit({ auth: token });
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}_${Date.now()}.txt`;
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Update`, content: btoa(unescape(encodeURIComponent(content))),
        sha: editingFileSha || undefined, branch: BRANCH
      });
      const { data: idxF } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, request: { cache: 'no-store' } });
      // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(idxF.content))));
      const idx = indexData.findIndex((s: any) => s.id === storyId);
      if (idx === -1) {
        // 🌟 新建文章时存入 isR18
        const newS: any = { id: storyId, title, author, sourceLink, isR18, date: new Date().toISOString() };
        if (chapterTitle) newS.chapters = [{ title: chapterTitle, fileName }];
        else newS.fileName = fileName;
        indexData = [newS, ...indexData];
      } else {
        const s = indexData[idx];
        s.title = title; s.author = author; s.sourceLink = sourceLink;
        s.isR18 = isR18; // 🌟 更新已存在的 R18 状态
        if (editingFileName && s.chapters) {
          const ci = s.chapters.findIndex((c: any) => c.fileName === editingFileName);
          if (ci !== -1) s.chapters[ci].title = chapterTitle;
        } else if (!s.chapters) {
          s.chapters = [{ title: "第 1 节", fileName: s.fileName }, { title: chapterTitle, fileName }];
          delete s.fileName;
        } else { s.chapters.push({ title: chapterTitle, fileName }); }
      }
      await octokit.rest.repos.createOrUpdateFileContents({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, // @ts-ignore
        sha: idxF.sha, message: `Index`, content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))), branch: BRANCH
      });
      setStatus('成功！');
      setTimeout(() => { fetchStories(); setView('list'); setStatus(''); resetForm(); setIsPublishing(false); }, 1000);
    } catch (err: any) { setStatus(`错误: ${err.message}`); setIsPublishing(false); }
  };

  const resetForm = () => {
    setEditingId(null); setEditingFileName(null); setEditingFileSha(null);
    setTitle(''); setAuthor(''); setChapterTitle(''); setSourceLink('');
    setIsR18(false); setContent(''); setStatus(''); 
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
      <header className="flex justify-between items-center mb-10 pb-4 border-b dark:border-white/10">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-black dark:hover:text-white font-bold tracking-widest">
          <ChevronLeft size={16}/> EXIT
        </button>
        <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 bg-slate-500/5 px-3 py-1.5 rounded-full border border-black/10">
               <Key size={14} className="opacity-40"/>
               <input type="password" value={token} onChange={e => { setToken(e.target.value); localStorage.setItem('gh_token', e.target.value); }} className="bg-transparent w-32 focus:w-48 outline-none text-[10px]" placeholder="GitHub Token" />
            </div>
            <button onClick={() => setView(view === 'create' ? 'list' : 'create')} className="bg-slate-900 text-white dark:bg-white dark:text-black px-6 py-2 rounded-full font-black text-xs shadow-xl">
                {view === 'create' ? <><List size={14} className="mr-1 inline"/> Manage</> : <><Edit3 size={14} className="mr-1 inline"/> New Story</>}
            </button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-3xl font-black italic tracking-tight">Archive Management</h2>
               <button onClick={fetchStories} disabled={isListLoading} className={`p-2 ${isListLoading ? 'animate-spin' : ''}`}>
                 <RotateCw size={20} className="opacity-40" />
               </button>
            </div>
            {status && <div className="text-xs font-bold text-blue-500 mb-4 animate-pulse">{status}</div>}
            {isListLoading ? <div className="py-20 text-center opacity-20 uppercase tracking-[0.3em]">Loading Index...</div> : stories.map(s => (
                <div key={s.id} className="p-6 border dark:border-white/10 rounded-2xl bg-white dark:bg-black/20 shadow-sm mb-4">
                    <div className="flex justify-between items-start mb-4">
                        <div><span className="font-bold text-xl block">{s.title}</span><span className="text-[10px] opacity-40 uppercase font-mono">{s.author}</span></div>
                        <div className="flex gap-2">
                           <button onClick={() => { setEditingId(s.id); setTitle(s.title); setAuthor(s.author); setSourceLink(s.sourceLink || ''); setView('create'); setIsR18(s.isR18 || false); }} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase transition-all hover:bg-blue-700">续传/分P</button>
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
      ) : (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black font-serif italic">{editingId ? 'Edit Content' : 'Post New Story'}</h2>
            <div className="bg-white dark:bg-black/20 p-8 rounded-3xl border dark:border-white/10 space-y-6 shadow-2xl">
               <div className="space-y-1">
                  <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Global Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-2 text-2xl font-black focus:border-blue-500 outline-none transition-all" placeholder="总标题..." />
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Author</label>
                    <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-xl outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Chapter Title</label>
                    <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="w-full bg-blue-500/5 dark:bg-blue-500/10 p-3 rounded-xl outline-none border border-blue-500/20 text-blue-600 font-bold" placeholder="章节名（如：第 1 节）" />
                  </div>
               </div>
               {/* 🌟 插入 R18 开关按钮 */}
               <div className="flex items-center gap-4 pt-2">
                 <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Rating / 分级</label>
                 <button 
                   type="button"
                   onClick={() => setIsR18(!isR18)}
                   className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                     isR18 
                       ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20' 
                       : 'bg-transparent border-slate-300 dark:border-white/10 opacity-40 hover:opacity-100'
                   }`}
                 >
                   {isR18 ? 'R18 RESTRICTED' : 'General / 全年龄'}
                 </button>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Source Link</label>
                  <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-xl outline-none text-xs" placeholder="https://..." />
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Content Editor</label>
                  <div className="flex flex-wrap gap-2">
                    {[ 
                      ['**','**',Bold], ['*','*',Italic], ['[box]','[/box]',Square], ['[quote]','[/quote]',Quote], 
                      ['[bubble:L]','[/bubble]',MessageSquare], ['[bubble:R]','[/bubble]',MessageSquare], 
                      ['---','',Minus], ['[bvid:',']',Video] 
                    ].map(([ot,ct,Icon]:any, i) => (
                      <button key={i} type="button" onClick={(e) => insertTag(e, ot, ct)} className={`p-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all bg-slate-100 dark:bg-white/10 ${ot.includes(':R') ? 'text-blue-500' : ''}`}><Icon size={16}/></button>
                    ))}
                  </div>
                  <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} className="w-full h-[500px] bg-slate-50 dark:bg-white/5 p-6 rounded-2xl outline-none leading-relaxed text-base font-serif" placeholder="在此输入内容..." />
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
