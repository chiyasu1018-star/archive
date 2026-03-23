import React, { useState } from 'react';
import { Octokit } from "octokit";
import { ChevronLeft, Send, Key, FileText, PlusSquare } from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [chapterTitle, setChapterTitle] = useState(''); // 新增：章节标题
  const [sourceLink, setSourceLink] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("请填写完整内容");
    setIsPublishing(true);
    setStatus('正在连接 GitHub...');

    try {
      const octokit = new Octokit({ auth: token });
      const date = new Date().toISOString().split('T')[0];
      const storyId = Date.now().toString();
      const fileName = `story_${storyId}.txt`;
      
      // 1. 上传正文 .txt 文件
      setStatus('正在上传文件...');
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Upload: ${title} ${chapterTitle}`,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: BRANCH
      });

      // 2. 更新 index.json 逻辑
      setStatus('正在更新目录...');
      const { data: indexFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
      });
      // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(indexFile.content))));

      // 查找是否已存在同名同作者的文章
      const existingIndex = indexData.findIndex((s: any) => s.title === title && s.author === author);

      if (chapterTitle && existingIndex !== -1) {
        // 情况 A: 追加章节
        const story = indexData[existingIndex];
        if (!story.chapters) {
          // 如果原来是单篇，转换为多章节格式
          story.chapters = [{ title: "第 1 节", fileName: story.fileName }];
          delete story.fileName;
        }
        story.chapters.push({ title: chapterTitle, fileName: fileName });
      } else if (chapterTitle) {
        // 情况 B: 新建多章节文章
        const newEntry = { id: storyId, title, author, date, sourceLink, chapters: [{ title: chapterTitle, fileName: fileName }] };
        indexData = [newEntry, ...indexData];
      } else {
        // 情况 C: 依然是普通单篇
        const newEntry = { id: storyId, title, author, date, fileName, sourceLink };
        indexData = [newEntry, ...indexData];
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        // @ts-ignore
        sha: indexFile.sha,
        message: `Update index: ${title}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))),
        branch: BRANCH
      });

      setStatus('发布成功！1分钟后刷新网站即可。');
      setChapterTitle(''); setContent('');
    } catch (err: any) {
      setStatus(`错误: ${err.message}`);
    } finally { setIsPublishing(false); }
  };

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto font-sans text-sm">
      <header className="flex justify-between items-center mb-8">
        <button onClick={onBack} className="flex items-center gap-2 opacity-50 hover:opacity-100 uppercase font-bold tracking-widest"><ChevronLeft size={16} /> Exit</button>
        <input type="password" value={token} onChange={e => setToken(e.target.value)} className="bg-black/5 dark:bg-white/5 rounded px-3 py-1 w-32 focus:w-64 transition-all outline-none" placeholder="GitHub Token" />
      </header>

      <div className="space-y-4">
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b border-black/10 dark:border-white/10 py-2 text-2xl outline-none" placeholder="文章总标题 (如：某长篇小说)" />
        
        <div className="grid grid-cols-2 gap-4">
          <input value={author} onChange={e => setAuthor(e.target.value)} className="bg-black/5 dark:bg-white/5 p-3 rounded-lg outline-none" placeholder="作者" />
          <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="bg-blue-500/10 p-3 rounded-lg outline-none border border-blue-500/20" placeholder="章节标题 (单篇请留空)" />
        </div>
        
        <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 p-3 rounded-lg outline-none" placeholder="原链接" />

        <div className="relative">
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={15} className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-xl outline-none leading-relaxed" placeholder="正文内容... 插入视频请写 [bvid:BVxxxx]" />
          <button 
            onClick={() => setContent(prev => prev + '\n[bvid:在此粘贴BV号]\n')}
            className="absolute bottom-4 right-4 bg-black text-white dark:bg-white dark:text-black px-3 py-1 rounded text-[10px] font-bold uppercase opacity-50 hover:opacity-100"
          >
            + 插入 B 站视频
          </button>
        </div>

        <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 rounded-full font-bold tracking-[0.3em] uppercase bg-blue-600 text-white shadow-lg">
          {isPublishing ? status : 'Publish / 发布'}
        </button>
      </div>
    </div>
  );
}
