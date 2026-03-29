import React, { useState, useEffect, useRef } from 'react';
import { Octokit } from "octokit";
import { 
  ChevronLeft, Key, Edit3, List, Bold, Italic, Quote, MessageSquare, 
  Minus, Video, PlusCircle, Square, Trash2 // --- 1. 导入 Trash2 图标 ---
} from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

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
  const [publishDate, setPublishDate] = useState(new Date().toISOString().split('T')[0]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- 获取列表逻辑 ---
  const fetchStories = async () => {
    setIsListLoading(true);
    try {
      const res = await fetch(`/stories/index.json?v=${Date.now()}`);
      const data = await res.json();
      setStories(data || []);
    } catch (err) { setStatus("列表获取失败"); }
    finally { setIsListLoading(false); }
  };

  useEffect(() => { fetchStories(); }, []);

  // --- 2. 新增：删除文章逻辑 ---
  const handleDelete = async (story: any) => {
    if (!token) return alert("请先输入 GitHub Token");
    if (!window.confirm(`确定要永久删除《${story.title}》及其所有章节文件吗？此操作不可撤销。`)) return;

    setIsPublishing(true);
    setStatus('正在清理文件...');

    try {
      const octokit = new Octokit({ auth: token });
      
      // A. 获取该故事涉及的所有文件名
      const filesToDelete = story.chapters 
        ? story.chapters.map((c: any) => c.fileName) 
        : [story.fileName];

      // B. 循环删除存储在 /stories/ 下的 .txt 文件
      for (const fileName of filesToDelete) {
        try {
          // 必须先获取该文件的 SHA 才能删除
          const { data: fileInfo } = await octokit.rest.repos.getContent({
            owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`
          });
          await octokit.rest.repos.deleteFile({
            owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
            message: `Delete Story File: ${fileName}`,
            // @ts-ignore
            sha: fileInfo.sha, branch: BRANCH
          });
        } catch (e) { console.log(`${fileName} 可能已被手动删除`); }
      }

      // C. 更新 index.json，移除该条目
      setStatus('正在更新索引...');
      const { data: idxF } = await octokit.rest.repos.getContent({ 
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        request: { cache: 'no-store' } 
      });
      // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(idxF.content))));
      const newIndex = indexData.filter((s: any) => s.id !== story.id);

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        // @ts-ignore
        sha: idxF.sha,
        message: `Remove ${story.title} from Index`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(newIndex, null, 2)))), 
        branch: BRANCH
      });

      setStatus('删除成功！');
      setTimeout(() => { fetchStories(); setStatus(''); setIsPublishing(false); }, 1000);
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
      setIsPublishing(false);
      setStatus('');
    }
  };

  // --- 插入标签 ---
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
    setTimeout(() => { textarea.focus(); textarea.scrollTop = savedScrollTop; }, 10);
  };

  // --- 续传、编辑、发布逻辑保持不变 ---
  const handleAddChapter = (story: any) => {
    setEditingId(story.id); setEditingFileName(null); setEditingFileSha(null);
    setTitle(story.title); setAuthor(story.author); setSourceLink(story.sourceLink || '');
    setPublishDate(new Date().toISOString().split('T')[0]);
    setChapterTitle(`第 ${story.chapters ? story.chapters.length + 1 : 2} 节`);
    setContent(''); setView('create'); setStatus(`准备为《${story.title}》添加新章节`);
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
      setPublishDate(story.date || new Date().toISOString().split('T')[0]);
      setSourceLink(story.sourceLink || ''); setChapterTitle(cTitle); setContent(text);
      setView('create'); setStatus('正文已加载');
    } catch (err: any) { alert("读取失败"); }
    finally { setIsPublishing(false); }
  };

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("请填写 Token、总标题和正文");
    setIsPublishing(true); setStatus('正在同步 GitHub...');
    try {
      const octokit = new Octokit({ auth: token });
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}_${Date.now()}.txt`;
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Archive: ${title}`, content: btoa(unescape(encodeURIComponent(content))),
        sha: editingFileSha || undefined, branch: BRANCH
      });
      const { data: idxF } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, request: { cache: 'no-store' } });
      // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(idxF.content))));
      const idx = indexData.findIndex((s: any) => s.id === storyId);
      if (idx === -1) {
        const newS: any = { id: storyId, title, author, date: publishDate, sourceLink };
        if (chapterTitle) newS.chapters = [{ title: chapterTitle, fileName }];
        else newS.fileName = fileName;
        indexData = [newS, ...indexData];
      } else {
        const s = indexData[idx];
        s.title = title; s.author = author; s.date = publishDate; s.sourceLink = sourceLink;
        if (editingFileName) {
          if (s.chapters) {
            const ci = s.chapters.findIndex((c: any) => c.fileName === editingFileName);
            if (ci !== -1) s.chapters[ci].title = chapterTitle;
          }
        } else {
          if (!s.chapters) {
            s.chapters = [{ title: "第 1 节", fileName: s.fileName }, { title: chapterTitle, fileName }];
            delete s.fileName;
          } else { s.chapters.push({ title: chapterTitle, fileName }); }
        }
      }
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        // @ts-ignore
        sha: idxF.sha, message: `Update Index`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))), branch: BRANCH
      });
      setStatus('成功！正在跳转...');
      setTimeout(() => { fetchStories(); setView('list'); setEditingId(null); setEditingFileName(null); setTitle(''); setChapterTitle(''); setContent(''); setStatus(''); setIsPublishing(false); }, 1500);
    } catch (err: any) { setStatus(`错误: ${err.message}`); setIsPublishing(false); }
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
            <button onClick={() => setView(view === 'create' ? 'list' : 'create')} className="bg-slate-900 text-white dark:bg-white dark:text-black px-6 py-2 rounded-full font-black uppercase text-xs hover:scale-105 transition-all shadow-xl">
                {view === 'create' ? <><List size={14} className="mr-1 inline"/> Manage</> : <><Edit3 size={14} className="mr-1 inline"/> New Story</>}
            </button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-300">
            <h2 className="text-3xl font-black mb-8 font-serif italic tracking-tight">Archive Management</h2>
            {status && <div className="text-xs font-bold text-red-500 mb-4 animate-pulse">{status}</div>}
            {isListLoading ? <div className="py-20 text-center opacity-20 uppercase tracking-[0.3em]">Loading Index...</div> : stories.map(s => (
                <div key={s.id} className="p-6 border dark:border-white/10 rounded-2xl bg-white dark:bg-black/20 shadow-sm mb-4">
                    <div className="flex justify-between items-start mb-4">
                        <div><span className="font-bold text-xl block">{s.title}</span><span className="text-[10px] opacity-40 uppercase font-mono">{s.date} // {s.author}</span></div>
                        <div className="flex gap-2">
                           <button onClick={() => handleAddChapter(s)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase hover:bg-blue-700 transition-all"><PlusCircle size={14}/> 续传/分P</button>
                           {/* --- 3. 新增：删除按钮 --- */}
                           <button 
                             onClick={() => handleDelete(s)} 
                             disabled={isPublishing}
                             className="p-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-full hover:bg-red-600 hover:text-white transition-all disabled:opacity-30"
                           >
                             <Trash2 size={16}/>
                           </button>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap border-t dark:border-white/5 pt-4">
                        <span className="text-[9px] opacity-30 uppercase w-full mb-1 font-bold">Edit Chapter:</span>
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <button key={i} onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-xs hover:text-blue-600 border border-transparent transition-all">{c.title}</button>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-xs italic text-blue-500">单页正文 (点击修改)</button>
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
                    <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Date</label>
                    <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-xl outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Chapter Title</label>
                    <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="w-full bg-blue-500/5 dark:bg-blue-500/10 p-3 rounded-xl outline-none border border-blue-500/20 text-blue-600 font-bold" placeholder="章节名（如：第 1 节）" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Source Link</label>
                    <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-xl outline-none text-xs" placeholder="https://..." />
                  </div>
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-black opacity-30 uppercase tracking-widest">Content Editor</label>
                  <div className="flex flex-wrap gap-2">
                    {[ 
                      ['**','**',Bold], ['*','*',Italic], ['[box]','[/box]',Square], ['[quote]','[/quote]',Quote], 
                      ['[bubble:L]','[/bubble]',MessageSquare], ['[bubble:R]','[/bubble]',MessageSquare], 
                      ['---','',Minus], ['[bvid:',']',Video], ['[youtube:', ']', Video] 
                    ].map(([ot,ct,Icon]:any, i) => (
                      <button key={i} type="button" onClick={(e) => insertTag(e, ot, ct)} className={`p-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all bg-slate-100 dark:bg-white/10 ${ot.includes(':R') ? 'text-blue-500' : ''}`}><Icon size={16}/></button>
                    ))}
                  </div>
                  <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} className="w-full h-[500px] bg-slate-50 dark:bg-white/5 p-6 rounded-2xl outline-none leading-relaxed text-base font-serif" placeholder="在此粘贴你的内容..." />
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
