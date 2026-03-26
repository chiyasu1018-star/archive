import React, { useState, useEffect, useRef } from 'react';
import { Octokit } from "octokit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  ChevronLeft, Key, Edit3, List, Bold, Italic, Quote, MessageSquare, 
  Minus, Video, PlusCircle, Square, Sparkles, Wand2, RefreshCw, Cpu, Undo2, Link
} from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [aiKey, setAiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [modelId, setModelId] = useState(localStorage.getItem('gemini_model') || 'gemini-2.0-flash');
  
  const [view, setView] = useState<'create' | 'list'>('list'); 
  const [stories, setStories] = useState<any[]>([]); 
  const [isListLoading, setIsListLoading] = useState(false);
  
  const [aiInput, setAiInput] = useState('');
  const [postypeUrl, setPostypeUrl] = useState(''); // 链接输入
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [nameMap, setNameMap] = useState("민규:玟奎\n원우:圆佑");

  const [content, setContent] = useState('');
  const [history, setHistory] = useState<string[]>([]); 

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [editingFileSha, setEditingFileSha] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publishDate, setPublishDate] = useState(new Date().toISOString().split('T')[0]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [status, setStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- 历史与撤回 ---
  const pushToHistory = (newText: string) => {
    setHistory(prev => [...prev, content]);
    setContent(newText);
  };
  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setContent(last);
  };

  // --- 本地修正脚本 ---
  const handleLocalSmartFix = () => {
    let text = content || aiInput;
    const bvidRegex = /https?:\/\/www\.bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/ig;
    text = text.replace(bvidRegex, '\n[bvid:$1]\n');
    text = text.replace(/^[—\-_*]{3,}$/gm, '---');
    text = text.replace(/\n{4,}/g, '\n\n\n');
    pushToHistory(text);
    setStatus("格式已优化");
  };

  // --- AI 处理：自动扫描 Postype 格式、加粗与翻译 ---
  const handleAIAssist = async (mode: 'full' | 'tags_only') => {
    if (!aiKey) return alert("请先填写顶部的 Gemini Key");
    if (!aiInput) return alert("请在左侧贴入原文内容");
    setIsAiLoading(true);
    setStatus(mode === 'full' ? "AI 正在扫描并逐句翻译..." : "AI 正在分析气泡与样式...");
    
    try {
      const genAI = new GoogleGenerativeAI(aiKey);
      const model = genAI.getGenerativeModel({ model: modelId });
      
      const prompt = `
        任务：作为档案馆秘书，扫描处理 Postype 文章并输出带标签的格式。
        
        【规则要求 - 极其重要】
        1. 识别并保留原文中所有的【加粗】、强调样式，并将其转化为 **加粗**。
        2. 对话识别：
           - 如果是 ${nameMap.split('\n')[0]?.split(':')[1] || '主角A'} 说话 -> [bubble:L]内容[/bubble]
           - 如果是 ${nameMap.split('\n')[1]?.split(':')[1] || '主角B'} 说话 -> [bubble:R]内容[/bubble]
           - 所有的气泡标签必须【成对闭合】，严禁漏掉结尾。
        3. 心理/独白：识别内心描写并包裹 [quote]内容[/quote]。
        4. ${mode === 'full' ? '韩译中：必须逐句对应翻译，严禁漏掉任何段落细节。' : '不翻译：仅添加标签并保留原文样式。'}
        5. 词典：\n${nameMap}

        直接输出处理好的带标签的正文，不要 Markdown 代码包裹符，不要解释。
        原文内容如下：\n${aiInput}
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
      pushToHistory(text);
      setStatus("处理成功！发现错误可撤回。");
    } catch (err: any) { alert("AI 报错: " + err.message); }
    finally { setIsAiLoading(false); }
  };

  // --- GitHub 发布逻辑 ---
  const fetchStories = async () => {
    setIsListLoading(true);
    try {
      const res = await fetch(`/stories/index.json?v=${Date.now()}`);
      const data = await res.json();
      setStories(data || []);
    } catch (err) { setStatus("获取列表失败"); }
    finally { setIsListLoading(false); }
  };
  useEffect(() => { fetchStories(); }, []);

  const insertTag = (e: React.MouseEvent, openTag: string, closeTag: string = '') => {
    e.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;
    const savedScrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const isBlock = openTag.includes('quote') || openTag.includes('bubble') || openTag.includes('box');
    let textToInsert = isBlock ? `\n${openTag}\n${selectedText || '内容'}\n${closeTag}\n` : `${openTag}${selectedText}${closeTag}`;
    pushToHistory(content.substring(0, start) + textToInsert + content.substring(end));
    setTimeout(() => { textarea.focus(); textarea.scrollTop = savedScrollTop; }, 10);
  };

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("信息不全");
    setIsPublishing(true); setStatus('同步中...');
    try {
      const octokit = new Octokit({ auth: token });
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}_${Date.now()}.txt`;
      let currentSha = undefined;
      if (editingFileName) {
          try { const { data: f } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${editingFileName}`, request: { cache: 'no-store' } }); // @ts-ignore
          currentSha = f.sha; } catch (e) {}
      }
      await octokit.rest.repos.createOrUpdateFileContents({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`, message: `Archive Post`, content: btoa(unescape(encodeURIComponent(content))), sha: currentSha, branch: BRANCH });
      const { data: idxF } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, request: { cache: 'no-store' } }); // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(idxF.content))));
      const idx = indexData.findIndex((s: any) => s.id === storyId);
      if (idx === -1) {
        const newS: any = { id: storyId, title, author, date: publishDate, sourceLink };
        if (chapterTitle) newS.chapters = [{ title: chapterTitle, fileName }]; else newS.fileName = fileName;
        indexData = [newS, ...indexData];
      } else {
        const s = indexData[idx]; s.title = title; s.author = author; s.date = publishDate; s.sourceLink = sourceLink;
        if (!editingFileName) {
          if (!s.chapters) { s.chapters = [{ title: "第 1 节", fileName: s.fileName }, { title: chapterTitle, fileName }]; delete s.fileName; }
          else s.chapters.push({ title: chapterTitle, fileName });
        } else if (s.chapters) {
          const ci = s.chapters.findIndex((c: any) => c.fileName === editingFileName);
          if (ci !== -1) s.chapters[ci].title = chapterTitle;
        }
      }
      await octokit.rest.repos.createOrUpdateFileContents({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, // @ts-ignore
      sha: idxF.sha, message: `Index Update`, content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))), branch: BRANCH });
      setStatus('发布成功！');
      setTimeout(() => { fetchStories(); setView('list'); setEditingId(null); setEditingFileName(null); setStatus(''); setIsPublishing(false); }, 1500);
    } catch (err: any) { setStatus(`错误: ${err.message}`); setIsPublishing(false); }
  };

  const handleEdit = (story: any, fileName: string, cTitle: string = '') => {
    setEditingId(story.id); setEditingFileName(fileName); setTitle(story.title); setAuthor(story.author || ''); setPublishDate(story.date || new Date().toISOString().split('T')[0]); setSourceLink(story.sourceLink || ''); setChapterTitle(cTitle);
    setStatus('拉取中...'); setView('create');
    const octokit = new Octokit({ auth: token });
    octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`, request: { cache: 'no-store' } }).then(({ data }: any) => {
      setContent(decodeURIComponent(escape(atob(data.content)))); setStatus('加载完成'); setEditingFileSha(data.sha);
    }).catch(() => setStatus('拉取失败'));
  };

  return (
    <div className="min-h-screen p-4 max-w-[1500px] mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
      <header className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b dark:border-white/10 gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-blue-500 transition-colors shrink-0"><ChevronLeft size={20}/> EXIT</button>
        <div className="flex gap-2 items-center ml-auto">
            <div className="flex items-center gap-2 bg-purple-500/5 px-3 py-1.5 rounded-xl border border-purple-500/20"><Cpu size={14} className="text-purple-500"/><input type="text" value={modelId} onChange={e => { setModelId(e.target.value); localStorage.setItem('gemini_model', e.target.value); }} className="bg-transparent w-28 text-[10px] outline-none" placeholder="Model ID" /></div>
            <div className="flex items-center gap-2 bg-blue-500/5 px-3 py-1.5 rounded-xl border border-blue-500/20"><Sparkles size={14} className="text-blue-500"/><input type="password" value={aiKey} onChange={e => { setAiKey(e.target.value); localStorage.setItem('gemini_key', e.target.value); }} className="bg-transparent w-28 text-[10px] outline-none" placeholder="Gemini Key" /></div>
            <div className="flex items-center gap-2 bg-slate-500/5 px-3 py-1.5 rounded-xl border border-black/10"><Key size={14} className="opacity-40"/><input type="password" value={token} onChange={e => { setToken(e.target.value); localStorage.setItem('gh_token', e.target.value); }} className="bg-transparent w-28 text-[10px] outline-none" placeholder="GH Token" /></div>
            <button onClick={() => setView(view === 'create' ? 'list' : 'create')} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                {view === 'create' ? 'Manage' : 'New Story'}
            </button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-black uppercase tracking-tighter">Archives List</h2><button onClick={fetchStories} className={`p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all ${isListLoading ? 'animate-spin' : ''}`}><RefreshCw size={18} /></button></div>
            {isListLoading ? <div className="py-20 text-center opacity-30 uppercase font-serif tracking-widest">Loading...</div> : stories.map(s => (
                <div key={s.id} className="p-6 border dark:border-white/10 rounded-3xl bg-white dark:bg-black/20 shadow-sm mb-4">
                    <div className="flex justify-between items-start mb-4">
                        <div><span className="font-bold text-xl block">{s.title}</span><span className="text-xs opacity-40 uppercase font-mono">{s.date} // {s.author}</span></div>
                        <button onClick={() => { setEditingId(s.id); setEditingFileName(null); setTitle(s.title); setAuthor(s.author); setChapterTitle(`第 ${s.chapters?.length + 1 || 2} 节`); setSourceLink(s.sourceLink || ''); setView('create'); setContent(''); setAiInput(''); setPostypeUrl(s.sourceLink || ''); }} className="flex items-center gap-1 px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-black rounded-full text-xs font-black transition-all hover:scale-105"><PlusCircle size={14}/> 续传/分P</button>
                    </div>
                    <div className="flex gap-2 flex-wrap border-t dark:border-white/5 pt-4">
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <button key={i} onClick={() => handleEdit(s, c.fileName, c.title)} className="px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-sm hover:text-blue-600 border border-transparent transition-all">{c.title}</button>
                        )) : <button onClick={() => handleEdit(s, s.fileName)} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl text-sm italic">单页全文 (点击编辑)</button>}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-120px)]">
          {/* Step 1: 输入与 AI */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center text-blue-500 font-black uppercase tracking-widest"><h3 className="flex items-center gap-2"><Link size={18}/> Step 1: Raw Content</h3><div className="flex gap-2">
                <button onClick={() => handleAIAssist('tags_only')} disabled={isAiLoading} className="px-4 py-2 border-2 border-blue-500 text-blue-500 rounded-xl text-xs font-black">仅识别气泡</button>
                <button onClick={() => handleAIAssist('full')} disabled={isAiLoading} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 shadow-lg flex items-center gap-2">{isAiLoading ? <RefreshCw size={14} className="animate-spin"/> : <Sparkles size={14}/>} 翻译并识别加粗</button>
            </div></div>
            <div className="flex-1 bg-slate-100 dark:bg-black/40 rounded-3xl p-6 border-2 border-dashed dark:border-white/10 flex flex-col gap-4">
               <input value={postypeUrl} onChange={e => { setPostypeUrl(e.target.value); setSourceLink(e.target.value); }} className="w-full bg-white dark:bg-white/5 p-3 rounded-2xl outline-none text-[10px] font-mono border dark:border-white/10" placeholder="Postype URL (选填)" />
               <textarea value={nameMap} onChange={e => setNameMap(e.target.value)} className="w-full h-12 bg-white dark:bg-white/5 p-3 rounded-2xl text-[10px] outline-none" placeholder="译名字典: 韩文:中文" />
               <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} className="w-full flex-1 bg-transparent outline-none text-sm font-serif leading-relaxed resize-none mt-2" placeholder="在此粘贴 Postype 的原文文本（哪怕带 HTML 也没事）..." />
            </div>
          </div>

          {/* Step 2: 校对与发布 */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center text-slate-400 font-black uppercase tracking-widest">
               <h3 className="flex items-center gap-2"><Edit3 size={18}/> Step 2: Review Studio</h3>
               <div className="flex gap-2">
                  <button onClick={handleUndo} disabled={history.length === 0} className="px-4 py-2 bg-slate-200 dark:bg-white/10 rounded-xl text-xs font-black disabled:opacity-30 flex items-center gap-1"><Undo2 size={14}/> 撤回</button>
                  <button onClick={handleLocalSmartFix} className="px-4 py-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl text-xs font-black flex items-center gap-1"><Wand2 size={14}/> 纠错</button>
               </div>
            </div>
            <div className="flex-1 bg-white dark:bg-black/20 rounded-3xl p-8 border dark:border-white/10 shadow-2xl flex flex-col gap-4 overflow-y-auto overflow-x-hidden">
               <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b-4 border-slate-100 dark:border-white/5 py-1 text-3xl font-black outline-none focus:border-blue-500 transition-all font-serif" placeholder="总标题" />
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl flex flex-col"><span className="text-[9px] font-black opacity-20 uppercase">Author</span><input value={author} onChange={e => setAuthor(e.target.value)} className="bg-transparent outline-none font-bold placeholder:opacity-20" placeholder="作者" /></div>
                  <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl flex flex-col"><span className="text-[9px] font-black opacity-20 uppercase">Date</span><input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} className="bg-transparent outline-none font-bold" /></div>
                  <div className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-2xl flex flex-col border border-blue-500/20 text-blue-600"><span className="text-[9px] font-black opacity-40 uppercase tracking-widest">Chapter</span><input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="bg-transparent outline-none font-black font-serif" placeholder="章节名" /></div>
                  <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl flex flex-col"><span className="text-[9px] font-black opacity-20 uppercase">Link</span><input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="bg-transparent outline-none text-[10px]" /></div>
               </div>
               <div className="flex flex-wrap gap-2 py-2 border-t dark:border-white/5">
                  <button type="button" onClick={(e) => insertTag(e, '**', '**')} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:scale-110 transition-all" title="加粗"><Bold size={18}/></button>
                  {[ ['*','*',Italic], ['[box]','[/box]',Square], ['[quote]','[/quote]',Quote], ['[bubble:L]','[/bubble]',MessageSquare], ['[bubble:R]','[/bubble]',MessageSquare], ['---','',Minus], ['[bvid:',']',Video] ].map(([ot,ct,Icon]:any, i) => (
                    <button key={i} type="button" onClick={(e) => insertTag(e, ot, ct)} className={`p-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all bg-slate-100 dark:bg-white/10 ${ot.includes(':R') ? 'text-blue-500' : ''}`}><Icon size={16}/></button>
                  ))}
               </div>
               <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} className="w-full flex-1 bg-transparent outline-none text-base font-serif leading-loose resize-none" placeholder="结果预览与手动精修..." />
               <button onClick={handlePublish} disabled={isPublishing} className="w-full py-5 rounded-2xl bg-blue-600 text-white font-black text-lg tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all disabled:bg-slate-400">
                 {isPublishing ? status : 'POST TO ARCHIVE'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
