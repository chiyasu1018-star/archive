import React, { useState } from 'react';
import { Octokit } from "octokit";
import { ChevronLeft, Send, Key, FileText } from 'lucide-react';

// 配置你的 GitHub 信息
const REPO_OWNER = "你的GitHub用户名"; // 比如 "myname"
const REPO_NAME = "你的仓库名";      // 比如 "my-archive"
const BRANCH = "main";             // 你的分支名

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const saveToken = () => {
    localStorage.setItem('gh_token', token);
    alert("Token 已保存至本地浏览器");
  };

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("请填写完整内容");
    setIsPublishing(true);
    setStatus('正在连接 GitHub...');

    try {
      const octokit = new Octokit({ auth: token });
      const date = new Date().toISOString().split('T')[0];
      const storyId = Date.now().toString();
      const fileName = `story_${storyId}.txt`;
      const filePath = `public/stories/${fileName}`;
      const indexPath = `public/stories/index.json`;

      // 1. 上传正文 .txt 文件
      setStatus('正在上传正文...');
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: filePath,
        message: `Add story: ${title}`,
        content: btoa(unescape(encodeURIComponent(content))), // 处理中文编码
        branch: BRANCH
      });

      // 2. 更新 index.json
      setStatus('正在更新目录...');
      const { data: indexFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: indexPath,
      });

      // @ts-ignore
      const oldIndex = JSON.parse(decodeURIComponent(escape(atob(indexFile.content))));
      const newEntry = {
        id: storyId,
        title,
        author,
        date,
        fileName,
        sourceLink
      };
      
      const newIndex = [newEntry, ...oldIndex]; // 新文章排在最前面

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: indexPath,
        // @ts-ignore
        sha: indexFile.sha, 
        message: `Update index for: ${title}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(newIndex, null, 2)))),
        branch: BRANCH
      });

      setStatus('发布成功！Vercel 正在部署，请等 1 分钟后刷新网站。');
      // 清空表单
      setTitle('');
      setContent('');
    } catch (err: any) {
      console.error(err);
      setStatus(`错误: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto font-sans text-sm">
      <header className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="flex items-center gap-2 opacity-50 hover:opacity-100 uppercase tracking-widest font-bold">
          <ChevronLeft size={16} /> Exit Admin
        </button>
        <div className="flex items-center gap-2">
          <input 
            type="password" 
            placeholder="GitHub Token" 
            value={token} 
            onChange={e => setToken(e.target.value)}
            className="bg-black/5 dark:bg-white/5 border-none rounded px-3 py-1 w-32 focus:w-64 transition-all"
          />
          <button onClick={saveToken} className="p-2 opacity-30 hover:opacity-100"><Key size={16}/></button>
        </div>
      </header>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="opacity-40 uppercase tracking-tighter font-bold">Title / 标题</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b border-black/10 dark:border-white/10 py-2 text-xl focus:border-blue-500 outline-none transition-colors" placeholder="输入文章标题..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="opacity-40 uppercase tracking-tighter font-bold">Author / 作者</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-transparent border-b border-black/10 dark:border-white/10 py-2 outline-none" placeholder="作者名" />
          </div>
          <div className="space-y-2">
            <label className="opacity-40 uppercase tracking-tighter font-bold">Link / 原链接</label>
            <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-transparent border-b border-black/10 dark:border-white/10 py-2 outline-none" placeholder="Postype 链接" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="opacity-40 uppercase tracking-tighter font-bold flex items-center gap-2">
            <FileText size={14}/> Content / 正文 (Supports plain text)
          </label>
          <textarea 
            value={content} 
            onChange={e => setContent(e.target.value)} 
            rows={15} 
            className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-xl resize-none focus:ring-1 ring-blue-500 outline-none leading-relaxed" 
            placeholder="粘贴你的文章内容..."
          />
        </div>

        <button 
          onClick={handlePublish}
          disabled={isPublishing}
          className={`w-full py-4 rounded-full font-bold tracking-[0.3em] uppercase transition-all flex items-center justify-center gap-3 ${isPublishing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'}`}
        >
          {isPublishing ? status : <><Send size={18}/> Publish Article</>}
        </button>

        {status && !isPublishing && (
          <p className="text-center py-4 text-blue-500 font-bold animate-pulse">{status}</p>
        )}
      </div>
    </div>
  );
}
