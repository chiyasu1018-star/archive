import React, { useState, useEffect, useRef } from 'react';
import { Octokit } from "octokit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  ChevronLeft, Key, Edit3, List, Bold, Italic, Quote, MessageSquare, 
  Minus, Video, PlusCircle, Square, Sparkles, Wand2, Eraser, CheckSquare
} from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [aiKey, setAiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [view, setView] = useState<'create' | 'list'>('create'); 
  const [stories, setStories] = useState<any[]>([]); 
  
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [nameMap, setNameMap] = useState("민규:玟奎\n원우:圆佑");

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

  // --- AI 逻辑 ---
  const handleAIAssist = async (mode: 'full' | 'tags_only') => {
    if (!aiKey) return alert("请先填写顶部的 Gemini Key");
    if (!aiInput) return alert("请在左侧贴入原文");
    setIsAiLoading(true);
    setStatus(mode === 'full' ? "AI 逐句翻译中..." : "AI 智能排版中...");
    try {
      const genAI = new GoogleGenerativeAI(aiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const prompt = mode === 'full' 
      ? `你是一个专业的韩译中排版助手。任务：翻译以下文字。要求：1.严禁漏译，保留所有段落细节。2.译名：\n${nameMap}\n3.自动标签：对话用 [bubble:L] 和 [bubble:R] 交替包裹；书信独白用 [quote]。直接输出译文：\n${aiInput}`
      : `不要翻译。任务：识别文字中的对话和引用，打上 [bubble] 和 [quote] 标签。直接输出带标签的原文：\n${aiInput}`;
      const result = await model.generateContent(prompt);
      setContent(result.response.text());
      setStatus("处理完成！请在右侧检查。");
    } catch (err: any) { alert("AI 助手罢工了: " + err.message); }
    finally { setIsAiLoading(false); }
  };

  // --- 列表逻辑 ---
  const fetchStories = async () => {
    try {
      const res = await fetch(`/stories/index.json?v=${Date.now()}`);
      const data = await res.json();
      setStories(data);
    } catch (err) { alert("获取列表失败"); }
  };
  useEffect(() => { if (view === 'list') fetchStories(); }, [view]);

  // --- 插入标签 (修复跳顶问题) ---
  const insertTag = (e: React.MouseEvent, openTag: string, closeTag: string = '') => {
    e.preventDefault(); // 阻止按钮默认行为
    const textarea = textareaRef.current;
    if (!textarea) return;
    const savedScrollTop = textarea.scrollTop; // 记录滚动高度
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const isBlock = openTag.includes('quote') || openTag.includes('bubble') || openTag.includes('bvid') || openTag.includes('---') || openTag.includes('box');
    let textToInsert = isBlock ? `\n${openTag}\n${selectedText || '内容'}\n${closeTag}\n` : `${openTag}${selectedText}${closeTag}`;
    const newContent = content.substring(0, start) + textToInsert + content.substring(end);
    setContent(newContent);
    setTimeout(() => { 
      textarea.focus(); 
      textarea.scrollTop = savedScrollTop; // 还原高度
    }, 10);
  };

  // --- 续传逻辑 ---
  const handleAddChapter = (story: any) => {
    setEditingId(story.id); 
    setEditingFileName(null);
    setEditingFileSha(null);
    setTitle(story.title);
    setAuthor(story.author);
    setSourceLink(story.sourceLink || '');
    setPublishDate(new Date().toISOString().split('T')[0]);
    setChapterTitle(`第 ${story.chapters ? story.chapters.length + 1 : 2} 节`);
    setContent(''); setAiInput(''); setView('create');
    setStatus(`正在为《${story.title}》添加新章节`);
  };

  const handleEdit = async (story: any, fileName: string, cTitle: string = '') => {
    setIsPublishing(true); setStatus('读取中...');
    try {
      const octokit = new Octokit({ auth: token });
      const { data: f } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}` });
      // @ts-ignore
      const text = decodeURIComponent(escape(atob(f.content)));
      setEditingId(story.id); setEditingFileName(fileName); // @ts-ignore
      setEditingFileSha(f.sha); setTitle(story.title); setAuthor(story.author); setPublishDate(story.date || publishDate);
      setSourceLink(story.sourceLink || ''); setChapterTitle(cTitle); setContent(text);
      setView('create'); setStatus('正文已加载');
    } catch (err: any) { alert("读取失败"); }
    finally { setIsPublishing(false); }
  };

  // --- 发布逻辑 (彻底修复 SHA 报错和自动跳转) ---
  const handlePublish = async () => {
    if (!token || !title || !content) return alert("请检查 Token、总标题和正文是否填写");
    setIsPublishing(true); setStatus('同步中...');
    try {
      const octokit = new Octokit({ auth: token });
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}_${Date.now()}.txt`;

      // 1. 同步正文文件
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`,
        message: `Post: ${title}`, content: btoa(unescape(encodeURIComponent(content))),
        sha: editingFileSha || undefined, branch: BRANCH
      });

      // 2. 核心修正：重新抓取 index.json 以获取最新 SHA，彻底解决蓝色报错
      const { data: idxF } = await octokit.rest.repos.getContent({ 
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        request: { cache: 'no-store' } 
      });
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
          } else {
            s.chapters.push({ title: chapterTitle, fileName });
          }
        }
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`,
        // @ts-ignore
        sha: idxF.sha, // 使用刚抓取的最新 SHA
        message: `Update Index`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))), 
        branch: BRANCH
      });

      setStatus('成功！正在为您跳转...');
      setTimeout(() => {
        setView('list'); setEditingId(null); setEditingFileName(null);
        setTitle(''); setChapterTitle(''); setContent(''); setStatus('');
        setIsPublishing(false);
      }, 1200); // 1.2秒后自动切回管理界面
    } catch (err: any) { setStatus(`错误: ${err.message}`); setIsPublishing(false); }
  };

  return (
    <div className="min-h-screen p-4 max-w-[1400px] mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
      <header className="flex justify-between items-center mb-6 pb-4 border-b dark:border-white/10 gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-black dark:hover:text-white transition-colors"><ChevronLeft size={16}/> EXIT</button>
        <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2 bg-blue-500/5 px-3 py-1.5 rounded-full border border-blue-500/20"><Sparkles size={14} className="text-blue-500"/><input type="password" value={aiKey} onChange={e => { setAiKey(e.target.value); localStorage.setItem('gemini_key', e.target.value); }} className="bg-transparent w-24 text-[10px] outline-none" placeholder="Gemini Key" /></div>
            <div className="flex items-center gap-2 bg-slate-500/5 px-3 py-1.5 rounded-full border border-black/10"><Key size={14} className="opacity-40"/><input type="password" value={token} onChange={e => { setToken(e.target.value); localStorage.setItem('gh_token', e.target.value); }} className="bg-transparent w-24 text-[10px] outline-none" placeholder="GH Token" /></div>
            <button onClick={() => setView(view === 'create' ? 'list' : 'create')} className="bg-slate-900 text-white dark:bg-white dark:text-black px-4 py-1.5 rounded-full font-bold uppercase text-[10px] hover:scale-105 transition-all">{view === 'create' ? 'Manage' : 'New Story'}</button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="max-w-2xl mx-auto space-y-4 animate-in slide-in-from-left duration-300">
            <div className="flex justify-between items-end mb-6"><h2 className="text-2xl font-black">管理列表 / Manage</h2><button onClick={fetchStories} className="text-[10px] opacity-40 hover:opacity-100 underline">刷新列表</button></div>
            {stories.map(s => (
                <div key={s.id} className="p-5 border dark:border-white/10 rounded-2xl bg-white/50 dark:bg-black/20">
                    <div className="flex justify-between items-start mb-4">
                        <div><span className="font-bold text-lg block text-slate-900 dark:text-white">{s.title}</span><span className="text-[10px] opacity-40 uppercase tracking-tighter">{s.date} · {s.author}</span></div>
                        <button onClick={() => handleAddChapter(s)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"><PlusCircle size={14}/> 续传/分P</button>
                    </div>
                    <div className="flex gap-2 flex-wrap border-t dark:border-white/5 pt-3">
                        <span className="text-[9px] opacity-30 uppercase w-full mb-1 font-bold">编辑已有章节:</span>
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <button key={i} onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-lg text-xs hover:border-blue-500/50 border border-transparent transition-all">{c.title}</button>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-lg text-xs hover:border-blue-500/50 border border-transparent transition-all italic text-blue-500">单页内容 (点击修改)</button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
          <div className="space-y-4">
            <div className="flex justify-between items-center"><h3 className="font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Eraser size={18}/> Step 1: 原文输入</h3><div className="flex gap-2"><button onClick={() => handleAIAssist('tags_only')} className="px-3 py-1.5 border border-blue-500 text-blue-500 rounded-full text-[10px] font-bold hover:bg-blue-500 hover:text-white transition-all">仅排版</button><button onClick={() => handleAIAssist('full')} className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center gap-1"><Sparkles size={12}/> 翻译+排版</button></div></div>
            <div className="bg-slate-100 dark:bg-black/20 p-4 rounded-2xl border dark:border-white/5">
              <textarea value={nameMap} onChange={e => setNameMap(e.target.value)} className="w-full h-14 bg-white dark:bg-black/40 p-2 rounded-xl text-[10px] font-mono outline-none mb-4 border dark:border-white/5" placeholder="译名对照: 민규:玟奎" />
              <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} className="w-full h-[450px] bg-white dark:bg-black/40 p-4 rounded-xl outline-none text-sm font-serif leading-relaxed" placeholder="在此贴入原文..." />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CheckSquare size={18}/> Step 2: 确认发布</h3>
            <div className="bg-white dark:bg-black/20 p-6 rounded-2xl border dark:border-white/10 space-y-4 shadow-xl">
               <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-2 text-xl font-black focus:border-blue-500 outline-none transition-all" placeholder="文章总标题..." />
               <div className="grid grid-cols-2 gap-4">
                  <input value={author} onChange={e => setAuthor(e.target.value)} className="bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl outline-none" placeholder="作者" />
                  <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} className="bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl outline-none" />
                  <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="bg-blue-500/5 dark:bg-blue-500/10 p-2.5 rounded-xl outline-none border border-blue-500/20 text-blue-600 font-bold" placeholder="章节名" />
                  <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl outline-none" placeholder="原链接" />
               </div>
               <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-white/5">
                  {[ ['**','**',Bold], ['*','*',Italic], ['[box]','[/box]',Square], ['[quote]','[/quote]',Quote], ['[bubble:L]','[/bubble]',MessageSquare], ['[bubble:R]','[/bubble]',MessageSquare], ['---','',Minus], ['[bvid:',']',Video] ].map(([ot,ct,Icon]:any, i) => (
                    <button key={i} type="button" onClick={(e) => insertTag(e, ot, ct)} className={`p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all bg-slate-100 dark:bg-white/5 ${ot.includes(':R') ? 'text-blue-500' : ''}`}><Icon size={14}/></button>
                  ))}
               </div>
               <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} className="w-full h-[400px] bg-slate-50 dark:bg-white/5 p-4 rounded-xl outline-none leading-relaxed text-base font-serif" placeholder="在此校对..." />
               <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 rounded-full font-black tracking-widest uppercase bg-blue-600 text-white shadow-2xl hover:bg-blue-700 active:scale-95 transition-all disabled:bg-slate-400">
                 {isPublishing ? status : editingFileName ? 'Update Changes / 保存修改' : 'Post / 立即发布'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
