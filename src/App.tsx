import React, { useState, useEffect, useRef } from 'react'; // 引入 useRef
import { Octokit } from "octokit";
import { ChevronLeft, Key, Edit3, List, Bold, Italic, Quote, MessageSquare, Minus, Video } from 'lucide-react';

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

  // 为 textarea 创建引用，以便直接操作 DOM
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchStories = async () => {
    try {
      const res = await fetch('/stories/index.json');
      const data = await res.json();
      setStories(data);
    } catch (err) { alert("获取列表失败"); }
  };

  useEffect(() => { if (view === 'list') fetchStories(); }, [view]);

  // --- 智能插入标签函数 ---
  const insertTag = (openTag: string, closeTag: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return; // 确保 textarea 存在

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = content;

    const selectedText = currentContent.substring(start, end);
    let textToInsert = '';
    let cursorOffset = 0; // 光标最终停留的位置

    if (selectedText) {
      // 如果有选中文字，则直接包裹
      textToInsert = openTag + selectedText + closeTag;
      cursorOffset = openTag.length + selectedText.length; // 光标停在插入文本后
    } else {
      // 如果没有选中文字，则插入占位符
      textToInsert = openTag + placeholder + closeTag;
      cursorOffset = openTag.length + placeholder.length; // 光标停在占位符内部
    }

    const newContent = currentContent.substring(0, start) + textToInsert + currentContent.substring(end);
    setContent(newContent);

    // 重新设置光标位置 (需要异步执行，因为 setState 是异步的)
    setTimeout(() => {
      textarea.selectionStart = start + openTag.length;
      textarea.selectionEnd = start + cursorOffset;
      textarea.focus();
    }, 0);
  };

  const handleEdit = async (story: any, fileName: string, cTitle: string = '') => {
    setIsPublishing(true);
    setStatus('正在获取正文...');
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
        message: `Commit: ${title}`,
        content: btoa(unescape(encodeURIComponent(content))),
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
      setStatus('成功！一分钟后刷新。');
      if (!editingId) { setContent(''); setChapterTitle(''); }
    } catch (err: any) { setStatus(`错误: ${err.message}`); }
    finally { setIsPublishing(false); }
  };

  const saveToken = () => {
    localStorage.setItem('gh_token', token);
    alert("Token 已保存");
  };

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-black/10 dark:border-white/10">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-white font-bold uppercase tracking-widest transition-colors">
          <ChevronLeft size={16}/> EXIT
        </button>
        <div className="flex gap-4 items-center">
            <button onClick={() => { setView(view === 'create' ? 'list' : 'create'); setEditingId(null); }} className="flex items-center gap-2 font-bold uppercase text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                {view === 'create' ? <><List size={16}/> Manage</> : <><Edit3 size={16}/> New</>}
            </button>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} className="bg-black/10 dark:bg-white/10 rounded px-3 py-1 w-24 focus:w-40 transition-all outline-none" placeholder="Token" />
            <button onClick={saveToken} className="opacity-40 hover:opacity-100"><Key size={14}/></button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="space-y-4">
            <h2 className="text-2xl font-black mb-6">管理 / Manage</h2>
            {stories.map(s => (
                <div key={s.id} className="p-5 border border-black/10 dark:border-white/10 rounded-xl space-y-3 bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white">
                    <div className="flex justify-between items-center text-lg font-bold"><div><span>{s.title}</span><span className="text-xs opacity-40 block">{s.date}</span></div><span>{s.author}</span></div>
                    <div className="flex gap-2 flex-wrap pt-2">
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <button key={i} onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1 bg-blue-500/10 text-blue-600 rounded text-xs border border-blue-500/20">编辑: {c.title}</button>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1 bg-green-500/10 text-green-600 rounded text-xs border border-green-500/20">编辑全文</button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-black">{editingId ? '编辑 / Edit' : '发表 / New'}</h2>
          
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-2 text-2xl font-bold focus:border-blue-500 outline-none transition-colors placeholder:opacity-20" placeholder="总标题" />

          <div className="grid grid-cols-2 gap-6">
            <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-lg outline-none" placeholder="作者" />
            <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-lg outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="w-full bg-blue-500/5 dark:bg-blue-500/10 p-3 rounded-lg outline-none border border-blue-500/20 text-blue-700 dark:text-blue-300" placeholder="章节标题 (选填)" />
            <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-lg outline-none" placeholder="原链接" />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => insertTag('**', '**', '在此输入加粗文字')} title="加粗" className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Bold size={16}/></button>
              <button onClick={() => insertTag('*', '*', '在此输入斜体文字')} title="斜体" className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Italic size={16}/></button>
              <button onClick={() => insertTag('\n[quote]', '[/quote]\n', '在此输入灰色引用内容')} title="引用" className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Quote size={16}/></button>
              <button onClick={() => insertTag('\n[bubble:L]', '[/bubble]\n', '在此输入左侧对话内容')} title="左气泡" className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><MessageSquare size={16}/></button>
              <button onClick={() => insertTag('\n[bubble:R]', '[/bubble]\n', '在此输入右侧对话内容')} title="右气泡" className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors text-blue-500"><MessageSquare size={16}/></button>
              <button onClick={() => insertTag('\n---\n')} title="分割线" className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Minus size={16}/></button>
              <button onClick={() => insertTag('\n[bvid:', ']\n', '在此粘贴BV号')} title="视频" className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Video size={16}/></button>
            </div>
            <textarea 
              ref={textareaRef} // 将 ref 绑定到 textarea
              value={content} 
              onChange={e => setContent(e.target.value)} 
              rows={15} 
              className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-xl outline-none leading-relaxed text-base" 
              placeholder="在此粘贴正文..." 
            />
          </div>

          <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 rounded-full font-black tracking-[0.3em] uppercase bg-blue-600 text-white shadow-xl shadow-blue-500/30 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50">
            {isPublishing ? status : editingId ? 'Update / 更新' : 'Publish / 发布'}
          </button>
          
          {editingId && (
            <button onClick={() => { setEditingId(null); setContent(''); setTitle(''); setChapterTitle(''); setPublishDate(new Date().toISOString().split('T')[0]); }} className="w-full text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">取消编辑</button>
          )}
        </div>
      )}
    </div>
  );
}
