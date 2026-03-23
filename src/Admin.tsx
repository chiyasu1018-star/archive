import React, { useState, useEffect } from 'react';
import { Octokit } from "octokit";
import { ChevronLeft, Send, Key, FileText, Edit3, Trash2, List } from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [view, setView] = useState<'create' | 'list'>('create'); // 视图状态：新建或列表
  const [stories, setStories] = useState<any[]>([]); // 存储文章列表
  
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

  // 获取文章列表
  const fetchStories = async () => {
    try {
      const res = await fetch('/stories/index.json');
      const data = await res.json();
      setStories(data);
    } catch (err) { alert("获取列表失败"); }
  };

  useEffect(() => { if (view === 'list') fetchStories(); }, [view]);

  // 编辑已有文章
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
      
      setTitle(story.title);
      setAuthor(story.author);
      setSourceLink(story.sourceLink);
      setChapterTitle(cTitle);
      setContent(text);
      setEditingId(story.id);
      setEditingFileName(fileName);
      // @ts-ignore
      setEditingFileSha(fileData.sha);
      setView('create');
      setStatus('正文已加载，可以开始修改');
    } catch (err: any) { alert("读取文件失败: " + err.message); }
    finally { setIsPublishing(false); }
  };

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("请填写完整内容");
    setIsPublishing(true);
    setStatus('正在保存到 GitHub...');

    try {
      const octokit = new Octokit({ auth: token });
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}.txt`;
      
      // 1. 更新或新建 .txt 文件
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Edit: ${title}`,
        content: btoa(unescape(encodeURIComponent(content))),
        sha: editingFileSha || undefined, // 如果有 SHA 说明是覆盖旧文件
        branch: BRANCH
      });

      // 2. 更新 index.json (只有在新建或修改标题/作者时需要)
      const { data: indexFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
      });
      // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(indexFile.content))));
      
      if (!editingId) {
          // 新建文章逻辑（保持不变）
          const existingIndex = indexData.findIndex((s: any) => s.title === title && s.author === author);
          if (chapterTitle && existingIndex !== -1) {
            const story = indexData[existingIndex];
            if (!story.chapters) { story.chapters = [{ title: "第 1 节", fileName: story.fileName }]; delete story.fileName; }
            story.chapters.push({ title: chapterTitle, fileName: fileName });
          } else if (chapterTitle) {
            indexData = [{ id: storyId, title, author, date: new Date().toISOString().split('T')[0], sourceLink, chapters: [{ title: chapterTitle, fileName: fileName }] }, ...indexData];
          } else {
            indexData = [{ id: storyId, title, author, date: new Date().toISOString().split('T')[0], fileName, sourceLink }, ...indexData];
          }
      } else {
          // 修改已有文章的元数据逻辑
          const idx = indexData.findIndex((s: any) => s.id === editingId);
          if (idx !== -1) {
              indexData[idx].title = title;
              indexData[idx].author = author;
              indexData[idx].sourceLink = sourceLink;
          }
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        // @ts-ignore
        sha: indexFile.sha,
        message: `Update index: ${title}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))),
        branch: BRANCH
      });

      setStatus('修改已成功提交！等待部署...');
      if (!editingId) { setContent(''); setChapterTitle(''); }
    } catch (err: any) { setStatus(`错误: ${err.message}`); }
    finally { setIsPublishing(false); }
  };

 // 建议直接修改 Admin.tsx 顶部的容器颜色和输入框颜色
return (
  <div className="min-h-screen p-6 max-w-2xl mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
    <header className="flex justify-between items-center mb-8 pb-4 border-b border-black/10 dark:border-white/10">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-white font-bold uppercase tracking-widest transition-colors">
        <ChevronLeft size={16}/> EXIT
      </button>
      <div className="flex gap-4 items-center">
          <button onClick={() => { setView(view === 'create' ? 'list' : 'create'); setEditingId(null); }} className="flex items-center gap-2 font-bold uppercase text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
              {view === 'create' ? <><List size={16}/> Manage Stories</> : <><Edit3 size={16}/> New Story</>}
          </button>
          <input type="password" value={token} onChange={e => setToken(e.target.value)} className="bg-black/10 dark:bg-white/10 rounded px-3 py-1 w-32 focus:w-48 transition-all outline-none border border-transparent focus:border-blue-500" placeholder="GitHub Token" />
      </div>
    </header>

    {view === 'list' ? (
      <div className="space-y-4">
          <h2 className="text-2xl font-black mb-6 text-slate-900 dark:text-white">文章管理 / Manage</h2>
          {stories.map(s => (
              <div key={s.id} className="p-5 border border-black/10 dark:border-white/10 rounded-xl space-y-3 bg-white/50 dark:bg-black/20">
                  <div className="flex justify-between items-center">
                      <span className="font-bold text-lg text-slate-900 dark:text-white">{s.title}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.author}</span>
                  </div>
                  {/* ... 按钮部分保持不变 ... */}
              </div>
          ))}
      </div>
    ) : (
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">{editingId ? '编辑文章 / Edit' : '发表文章 / New'}</h2>
        
        {/* 输入框：去掉了苍白的透明度，加深了文字颜色 */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Article Title / 总标题</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-2 text-2xl font-bold text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" placeholder="输入文章标题..." />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Author / 作者</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-lg outline-none text-slate-900 dark:text-white border border-transparent focus:border-blue-500" placeholder="作者名" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chapter / 章节标题</label>
            <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="w-full bg-blue-500/5 dark:bg-blue-500/10 p-3 rounded-lg outline-none border border-blue-500/20 text-blue-700 dark:text-blue-300 placeholder:text-blue-300" placeholder="选填，长篇必填" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Link / 原链接</label>
          <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-lg outline-none text-slate-900 dark:text-white" placeholder="https://..." />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Content / 正文</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={15} className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-xl outline-none leading-relaxed text-slate-900 dark:text-white text-base" placeholder="在此粘贴正文内容..." />
        </div>

        <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 rounded-full font-black tracking-[0.3em] uppercase bg-blue-600 text-white shadow-xl shadow-blue-500/30 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50">
          {isPublishing ? status : editingId ? 'Update / 更新文章' : 'Publish / 发布文章'}
        </button>
      </div>
    )}
  </div>
);
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <h2 className="text-xl font-bold">{editingId ? '编辑文章 / Edit' : '发表文章 / New'}</h2>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b border-black/10 dark:border-white/10 py-2 text-2xl outline-none" placeholder="文章总标题" />
          <div className="grid grid-cols-2 gap-4">
            <input value={author} onChange={e => setAuthor(e.target.value)} className="bg-black/5 dark:bg-white/5 p-3 rounded-lg outline-none" placeholder="作者" />
            <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="bg-blue-500/10 p-3 rounded-lg outline-none border border-blue-500/20" placeholder="章节标题 (选填)" />
          </div>
          <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 p-3 rounded-lg outline-none" placeholder="原链接" />
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={15} className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-xl outline-none leading-relaxed" placeholder="正文内容... 插入视频请写 [bvid:BVxxxx]" />
          <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 rounded-full font-bold tracking-[0.3em] uppercase bg-blue-600 text-white shadow-lg disabled:opacity-50">
            {isPublishing ? status : editingId ? 'Update / 更新文章' : 'Publish / 发布文章'}
          </button>
          {editingId && (
              <button onClick={() => { setEditingId(null); setContent(''); setTitle(''); }} className="w-full text-xs opacity-40 hover:underline">取消编辑，切换回新建模式</button>
          )}
        </div>
      )}
    </div>
  );
}
