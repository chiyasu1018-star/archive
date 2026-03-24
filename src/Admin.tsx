import React, { useState, useEffect, useRef } from 'react';
import { Octokit } from "octokit";
import { 
  ChevronLeft, Key, Edit3, List, Bold, Italic, Quote, MessageSquare, 
  Minus, Video, PlusCircle, Square 
} from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [view, setView] = useState<'create' | 'list'>('create'); 
  const [stories, setStories] = useState<any[]>([]); 
  
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
      const res = await fetch(`/stories/index.json?v=${Date.now()}`);
      const data = await res.json();
      setStories(data);
    } catch (err) { alert("获取列表失败"); }
  };

  useEffect(() => { if (view === 'list') fetchStories(); }, [view]);

  const insertTag = (e: React.MouseEvent, openTag: string, closeTag: string = '', placeholder: string = '') => {
    e.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;
    const savedScrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const isBlock = openTag.includes('quote') || openTag.includes('bubble') || openTag.includes('bvid') || openTag.includes('---') || openTag.includes('box');
    
    let textToInsert = '';
    let newCursorStart = 0;
    let newCursorEnd = 0;

    if (isBlock) {
        const beforeChar = content.charAt(start - 1);
        const prefix = (start === 0 || beforeChar === '\n') ? '' : '\n';
        const innerText = selectedText || placeholder;
        textToInsert = `${prefix}${openTag}\n${innerText}\n${closeTag}\n`;
        newCursorStart = start + prefix.length + openTag.length + 1;
        newCursorEnd = newCursorStart + innerText.length;
    } else {
        const innerText = selectedText || placeholder;
        textToInsert = `${openTag}${innerText}${closeTag}`;
        newCursorStart = start + openTag.length;
        newCursorEnd = newCursorStart + innerText.length;
    }

    const newContent = content.substring(0, start) + textToInsert + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
      textarea.scrollTop = savedScrollTop;
    }, 0);
  };

  // --- 续传逻辑：准备添加新章节 ---
  const handleAddChapter = (story: any) => {
    setEditingId(story.id); 
    setEditingFileName(null); // 代表我们要新建一个文件
    setEditingFileSha(null);
    
    setTitle(story.title);
    setAuthor(story.author);
    setSourceLink(story.sourceLink || '');
    setPublishDate(new Date().toISOString().split('T')[0]);
    
    setChapterTitle(`第 ${story.chapters ? story.chapters.length + 1 : 2} 节`);
    setContent('');
    setView('create');
    setStatus(`正在为《${story.title}》续写新章节`);
  };

  // --- 编辑逻辑：加载已有内容 ---
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
      setEditingId(story.id); 
      setEditingFileName(fileName);
      // @ts-ignore
      setEditingFileSha(fileData.sha); 
      setView('create'); 
      setStatus('正文已加载，可以修改标题和内容');
    } catch (err: any) { alert("读取失败: " + err.message); }
    finally { setIsPublishing(false); }
  };

  // --- 核心发布逻辑：智能处理分P与改名 ---
  const handlePublish = async () => {
    if (!token || !title || !content) return alert("请填写完整内容");
    setIsPublishing(true); setStatus('正在同步至 GitHub...');
    try {
      const octokit = new Octokit({ auth: token });
      
      // 1. 处理故事 ID 和 文件名
      const storyId = editingId || Date.now().toString();
      // 如果是续传新章节，生成一个新的文件名
      const fileName = editingFileName || `story_${storyId}_${Date.now()}.txt`;

      // 2. 上传/更新正文文件 (.txt)
      const { data: uploadRes } = await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Archive: ${title} - ${chapterTitle}`, 
        content: btoa(unescape(encodeURIComponent(content))),
        sha: editingFileSha || undefined, 
        branch: BRANCH
      });

      // 3. 更新索引文件 (index.json)
      const { data: indexFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
      });
      // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(indexFile.content))));

      const existingStoryIdx = indexData.findIndex((s: any) => s.id === storyId);

      if (existingStoryIdx === -1) {
        // A. 完全新建的文章
        const newEntry: any = { id: storyId, title, author, date: publishDate, sourceLink };
        if (chapterTitle) {
          newEntry.chapters = [{ title: chapterTitle, fileName: fileName }];
        } else {
          newEntry.fileName = fileName;
        }
        indexData = [newEntry, ...indexData];
      } else {
        // B. 已有的文章（修改或续传）
        const story = indexData[existingStoryIdx];
        story.title = title;
        story.author = author;
        story.date = publishDate;
        story.sourceLink = sourceLink;

        if (editingFileName) {
          // B-1. 正在修改【已有章节】的内容或标题
          if (story.chapters) {
            const chapIdx = story.chapters.findIndex((c: any) => c.fileName === editingFileName);
            if (chapIdx !== -1) story.chapters[chapIdx].title = chapterTitle;
          } else {
            // 如果原来是单篇，现在给了个章节名，就地转为分P模式
            if (chapterTitle) {
               story.chapters = [{ title: chapterTitle, fileName: story.fileName }];
               delete story.fileName;
            }
          }
        } else {
          // B-2. 正在【续传】新章节
          if (!story.chapters) {
            // 从单篇强制转为多章节
            story.chapters = [
              { title: "第 1 节", fileName: story.fileName },
              { title: chapterTitle || `第 2 节`, fileName: fileName }
            ];
            delete story.fileName;
          } else {
            story.chapters.push({ title: chapterTitle || `第 ${story.chapters.length + 1} 节`, fileName: fileName });
          }
        }
      }

      // 4. 保存 index.json
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        // @ts-ignore
        sha: indexFile.sha, message: `Index Update: ${title}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))), 
        branch: BRANCH
      });

      setStatus('发布成功！请等待约 1 分钟让 Vercel 部署。');
      // 如果是修改模式，保持现状；如果是新建/续传，清空输入
      if (!editingFileName) { setContent(''); setChapterTitle(''); }
    } catch (err: any) { setStatus(`发生错误: ${err.message}`); }
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
            <div className="flex justify-between items-end mb-6">
               <h2 className="text-2xl font-black">管理列表 / Manage</h2>
               <button onClick={fetchStories} className="text-[10px] opacity-40 hover:opacity-100 underline">刷新列表</button>
            </div>
            {stories.map(s => (
                <div key={s.id} className="p-5 border border-black/10 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="font-bold text-lg block leading-tight">{s.title}</span>
                            <span className="text-[10px] opacity-40 uppercase tracking-tighter">{s.date} · {s.author}</span>
                        </div>
                        <button onClick={() => handleAddChapter(s)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                            <PlusCircle size={14}/> 续传/分P
                        </button>
                    </div>
                    <div className="flex gap-2 flex-wrap border-t border-black/5 dark:border-white/5 pt-3">
                        <span className="text-[9px] opacity-30 uppercase w-full mb-1 font-bold">编辑已有章节:</span>
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <button key={i} onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded text-xs border border-transparent hover:border-blue-500/50 transition-all">
                                {c.title}
                            </button>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded text-xs border border-transparent hover:border-blue-500/50 transition-all">
                                单页内容 (点击改标题)
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-end">
            <h2 className="text-2xl font-black">{editingId ? '内容编辑 / Edit' : '发表文章 / New'}</h2>
            {status && <span className="text-[10px] text-blue-500 font-bold uppercase animate-pulse">{status}</span>}
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Title / 总标题 (修改此处同步所有章节)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-2 text-2xl font-bold focus:border-blue-500 outline-none transition-colors" placeholder="总标题..." />
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
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Chapter Title / 章节名 (修改此处可改分P标题)</label>
                <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="w-full bg-blue-500/5 dark:bg-blue-500/10 p-3 rounded-lg outline-none border border-blue-500/20 text-blue-700 dark:text-blue-300 font-bold font-serif" placeholder="如：第 1 节" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source / 原链接</label>
                <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-lg outline-none" placeholder="https://..." />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={(e) => insertTag(e, '**', '**', '加粗')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Bold size={16}/></button>
              <button type="button" onClick={(e) => insertTag(e, '*', '*', '斜体')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Italic size={16}/></button>
              <button type="button" onClick={(e) => insertTag(e, '[box]', '[/box]', '方框内容')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors text-amber-600"><Square size={16}/></button>
              <button type="button" onClick={(e) => insertTag(e, '[quote]', '[/quote]', '引用内容')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Quote size={16}/></button>
              <button type="button" onClick={(e) => insertTag(e, '[bubble:L]', '[/bubble]', '左气泡')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><MessageSquare size={16}/></button>
              <button type="button" onClick={(e) => insertTag(e, '[bubble:R]', '[/bubble]', '右气泡')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors text-blue-500"><MessageSquare size={16}/></button>
              <button type="button" onClick={(e) => insertTag(e, '---')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Minus size={16}/></button>
              <button type="button" onClick={(e) => insertTag(e, '[bvid:', ']', 'BV号')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Video size={16}/></button>
            </div>
            <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} rows={15} className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-xl outline-none leading-relaxed text-base font-serif" placeholder="在此粘贴正文..." />
          </div>

          <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 rounded-full font-black tracking-[0.3em] uppercase bg-blue-600 text-white shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all">
            {isPublishing ? 'Publishing...' : editingFileName ? 'Save Changes / 保存修改' : 'Post / 立即发布'}
          </button>
          
          <button onClick={() => { setEditingId(null); setEditingFileName(null); setContent(''); setTitle(''); setChapterTitle(''); }} className="w-full text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">清空当前表单</button>
        </div>
      )}
    </div>
  );
}
