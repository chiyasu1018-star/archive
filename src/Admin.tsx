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

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto font-sans text-sm text-[#333] dark:text-[#ccc]">
      <header className="flex justify-between items-center mb-8 pb-4 border-b dark:border-white/10">
        <button onClick={onBack} className="flex items-center gap-2 opacity-50 hover:opacity-100 font-bold uppercase tracking-widest"><ChevronLeft size={16}/> Exit</button>
        <div className="flex gap-4 items-center">
            <button onClick={() => { setView(view === 'create' ? 'list' : 'create'); setEditingId(null); }} className="flex items-center gap-2 font-bold uppercase opacity-70 hover:opacity-100">
                {view === 'create' ? <><List size={16}/> Manage Stories</> : <><Edit3 size={16}/> New Story</>}
            </button>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} className="bg-black/5 dark:bg-white/5 rounded px-3 py-1 w-32 focus:w-48 transition-all outline-none" placeholder="GitHub Token" />
        </div>
      </header>

      {view === 'list' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-xl font-bold mb-6">文章管理 / Manage</h2>
            {stories.map(s => (
                <div key={s.id} className="p-4 border dark:border-white/10 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">{s.title}</span>
                        <span className="text-[10px] opacity-40 uppercase">{s.author}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <button key={i} onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded text-xs transition-colors border border-blue-500/20">
                                编辑: {c.title}
                            </button>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded text-xs transition-colors border border-green-500/20">
                                编辑全文
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : (
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
