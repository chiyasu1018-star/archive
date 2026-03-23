import React, { useState, useEffect, useRef } from 'react';
import { Octokit } from "octokit";
import { ChevronLeft, Key, Edit3, List, Bold, Italic, Quote, MessageSquare, Minus, Video, PlusCircle } from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [view, setView] = useState<'create' | 'list'>('create'); 
  const [stories, setStories] = useState<any[]>([]); 
  
  // 表单状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [editingFileSha, setEditingFileSha] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publishDate, setPublishDate] = useState(new Date().toISOString().split('T')[0]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [content, setContent] = useState('');
  
  const [status, setStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchStories = async () => {
    try {
      const res = await fetch('/stories/index.json');
      const data = await res.json();
      setStories(data);
    } catch (err) { alert("获取列表失败"); }
  };

  useEffect(() => { if (view === 'list') fetchStories(); }, [view]);

  // --- 智能插入标签 ---
  const insertTag = (openTag: string, closeTag: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    let textToInsert = selectedText ? openTag + selectedText + closeTag : openTag + placeholder + closeTag;
    const cursorOffset = selectedText ? openTag.length + selectedText.length : openTag.length + placeholder.length;
    const newContent = content.substring(0, start) + textToInsert + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.selectionStart = start + openTag.length;
      textarea.selectionEnd = start + cursorOffset;
      textarea.focus();
    }, 0);
  };

  // --- 核心：续传新章节逻辑 ---
  const handleAddChapter = (story: any) => {
    setEditingId(null); // 这是新文件
    setEditingFileName(null);
    setEditingFileSha(null);
    
    // 自动填入旧文章的信息
    setTitle(story.title);
    setAuthor(story.author);
    setSourceLink(story.sourceLink || '');
    setPublishDate(new Date().toISOString().split('T')[0]);
    
    // 清空章节标题和正文
    setChapterTitle('');
    setContent('');
    
    setView('create');
    setStatus(`正在为《${story.title}》添加新章节`);
  };

  // 编辑逻辑
  const handleEdit = async (story: any, fileName: string, cTitle: string = '') => {
    setIsPublishing(true); setStatus('正在获取正文...');
    try {
      const octokit = new Octokit({ auth: token });
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
      });
      // @ts-ignore
      const text = decodeURIComponent(escape(atob(fileData.content)));
      setTitle(story.title); setAuthor(story.author); setPublishDate(story.date || new Date().toISOString().split('T')[0]);
      setSourceLink(story.sourceLink); setChapterTitle(cTitle); setContent(text);
      setEditingId(story.id); setEditingFileName(fileName);
      // @ts-ignore
      setEditingFileSha(fileData.sha); setView('create'); setStatus('正文已加载');
    } catch (err: any) { alert("读取失败: " + err.message); }
    finally { setIsPublishing(false); }
  };

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("请填写完整内容");
    setIsPublishing(true); setStatus('正在保存...');
    try {
      const octokit = new Octokit({ auth: token });
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}.txt`;
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Commit: ${title}`, content: btoa(unescape(encodeURIComponent(content))),
        sha: editingFileSha || undefined, branch: BRANCH
      });
      const { data: indexFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
      });
      // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(indexFile.content))));
      if (!editingId) {
          const existingIndex = indexData.findIndex((s: any) => s.title === title && s.author === author);
          if (chapterTitle && existingIndex !== -1) {
            const story = indexData[existingIndex];
            story.date = publishDate;
            if (!story.chapters) { story.chapters = [{ title: "第 1 节", fileName: story.fileName }]; delete story.fileName; }
            story.chapters.push({ title: chapterTitle, fileName: fileName });
          } else if (chapterTitle) {
            indexData = [{ id: storyId, title, author, date: publishDate, sourceLink, chapters: [{ title: chapterTitle, fileName: fileName }] }, ...indexData];
          } else {
            indexData = [{ id: storyId, title, author, date: publishDate, fileName, sourceLink }, ...indexData];
          }
      } else {
          const idx = indexData.findIndex((s: any) => s.id === editingId);
          if (idx !== -1) { indexData[idx].title = title; indexData[idx].author = author; indexData[idx].date = publishDate; indexData[idx].sourceLink = sourceLink; }
      }
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        // @ts-ignore
        sha: indexFile.sha, message: `Update: ${title}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))), branch: BRANCH
      });
      setStatus('成功！Vercel 部署中...');
      if (!editingId) { setContent(''); setChapterTitle(''); }
    } catch (err: any) { setStatus(`错误: ${err.message}`); }
    finally { setIsPublishing(false); }
  };

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-black/10 dark:border-white/10">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-white font-bold uppercase tracking-widest transition-colors">
          <ChevronLeft size={16}/> EXIT
        </button>
        <div className="flex gap-4 items-center">
            <button onClick={() => { setView(view === 'create' ? 'list' : 'create'); setEditingId(null); }} className="flex items-center gap-2 font-bold uppercase text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                {view === 'create' ? <><List size={16}/> Manage</> : <><Edit3 size={16}/> New Story</>}
            </button>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} className="bg-black/10 dark:bg-white/10 rounded px-3 py-1 w-24 focus:w-40 transition-all outline-none" placeholder="Token" />
            <button onClick={() => localStorage.setItem('gh_token', token)} className="opacity-40 hover:opacity-100"><Key size={14}/></button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="space-y-4">
            <h2 className="text-2xl font-black mb-6">文章管理 / Manage</h2>
            {stories.map(s => (
                <div key={s.id} className="p-5 border border-black/10 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="font-bold text-lg block leading-tight">{s.title}</span>
                            <span className="text-[10px] opacity-40 uppercase tracking-tighter">{s.date} · {s.author}</span>
                        </div>
                        {/* 续传新章节按钮 */}
                        <button 
                            onClick={() => handleAddChapter(s)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                        >
                            <PlusCircle size={14}/> 续传
                        </button>
                    </div>
                    <div className="flex gap-2 flex-wrap border-t border-black/5 dark:border-white/5 pt-3">
                        <span className="text-[9px] opacity-30 uppercase w-full mb-1 font-bold">已传章节:</span>
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <button key={i} onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded text-xs border border-transparent hover:border-blue-500/50 transition-all">
                                {c.title}
                            </button>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded text-xs border border-transparent hover:border-blue-500/50 transition-all">
                                编辑全文
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-end">
            <h2 className="text-2xl font-black">{editingId ? '编辑文章 / Edit' : '发表文章 / New'}</h2>
            {title && !editingId && <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-1 rounded font-bold uppercase tracking-widest animate-pulse">续传模式</span>}
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Title / 总标题</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-2 text-2xl font-bold focus:border-blue-500 outline-none transition-colors" placeholder="输入总标题..." />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Author / 作者</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-lg outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / 日期</label>
              <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-lg outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Chapter Title / 章节名</label>
                <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="w-full bg-blue-500/5 dark:bg-blue-500/10 p-3 rounded-lg outline-none border border-blue-500/20 text-blue-700 dark:text-blue-300 font-bold" placeholder="如：第 2 章" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source / 原链接</label>
                <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-lg outline-none" placeholder="https://..." />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => insertTag('**', '**', '加粗文字')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Bold size={16}/></button>
              <button onClick={() => insertTag('*', '*', '斜体文字')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Italic size={16}/></button>
              <button onClick={() => insertTag('\n[quote]', '[/quote]\n', '引用内容')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Quote size={16}/></button>
              <button onClick={() => insertTag('\n[bubble:L]', '[/bubble]\n', '左对话')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><MessageSquare size={16}/></button>
              <button onClick={() => insertTag('\n[bubble:R]', '[/bubble]\n', '右对话')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors text-blue-500"><MessageSquare size={16}/></button>
              <button onClick={() => insertTag('\n---\n')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Minus size={16}/></button>
              <button onClick={() => insertTag('\n[bvid:', ']\n', 'BV号')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Video size={16}/></button>
            </div>
            <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} rows={15} className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-xl outline-none leading-relaxed text-base" placeholder="在此粘贴正文..." />
          </div>

          <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 rounded-full font-black tracking-[0.3em] uppercase bg-blue-600 text-white shadow-xl">
            {isPublishing ? status : editingId ? 'Update / 更新' : 'Publish / 发布'}
          </button>
          
          {(editingId || title) && (
            <button onClick={() => { setEditingId(null); setContent(''); setTitle(''); setChapterTitle(''); }} className="w-full text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">取消/清空表单</button>
          )}
        </div>
      )}
    </div>
  );
}
