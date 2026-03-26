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
  
  // AI 辅助状态
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [nameMap, setNameMap] = useState("민규:玟奎\n원우:圆佑");

  // 编辑表单状态
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

  // --- 核心：AI 处理函数 (支持仅排版或翻译+排版) ---
  const handleAIAssist = async (mode: 'full' | 'tags_only') => {
    if (!aiKey) return alert("请在顶部填入 Gemini Key");
    if (!aiInput) return alert("请在左侧贴入文字");
    setIsAiLoading(true);
    setStatus(mode === 'full' ? "AI 逐句翻译排版中..." : "AI 正在识别气泡标签...");
    
    try {
      const genAI = new GoogleGenerativeAI(aiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      const prompt = mode === 'full' 
      ? `你是一个严谨的韩译中排版助手。
         任务：翻译我给出的韩文。
         【硬性要求】
         1. 严禁漏译：必须逐段、逐句翻译，不可省略任何细节和描写。
         2. 固定译名：使用以下对照：\n${nameMap}
         3. 自动标签：对话用 [bubble:L] 和 [bubble:R] 交替包裹；书信/心理活动用 [quote]。
         4. 保持格式：保留原文的所有换行和留白。
         直接输出译文。原文如下：\n${aiInput}`
      : `你是一个排版助手。不要翻译，保持原文语言。
         任务：识别文字中的对话和引用，并打上标签。
         1. 对话包裹：[bubble:L]内容[/bubble] 和 [bubble:R]内容[/bubble]。
         2. 引用包裹：[quote]内容[/quote]。
         直接输出带标签的原文内容：\n${aiInput}`;

      const result = await model.generateContent(prompt);
      setContent(result.response.text());
      setStatus("处理完成！请在右侧检查校对。");
    } catch (err: any) { alert("AI 出错: " + err.message); }
    finally { setIsAiLoading(false); }
  };

  // --- GitHub 发布逻辑 ---
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
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const isBlock = openTag.includes('quote') || openTag.includes('bubble') || openTag.includes('bvid') || openTag.includes('---') || openTag.includes('box');
    let textToInsert = isBlock ? `\n${openTag}\n${selectedText || placeholder}\n${closeTag}\n` : `${openTag}${selectedText || placeholder}${closeTag}`;
    setContent(content.substring(0, start) + textToInsert + content.substring(end));
    setTimeout(() => { textarea.focus(); }, 10);
  };

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("信息不全");
    setIsPublishing(true); setStatus('同步至 GitHub...');
    try {
      const octokit = new Octokit({ auth: token });
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}_${Date.now()}.txt`;
      let currentSha = undefined;
      if (editingFileName) {
          try { const { data: f } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${editingFileName}` }); // @ts-ignore
          currentSha = f.sha; } catch (e) {}
      }
      await octokit.rest.repos.createOrUpdateFileContents({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`, message: `Update: ${title}`, content: btoa(unescape(encodeURIComponent(content))), sha: currentSha, branch: BRANCH });
      const { data: idxF } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json` }); // @ts-ignore
      let indexData = JSON.parse(decodeURIComponent(escape(atob(idxF.content))));
      const idx = indexData.findIndex((s: any) => s.id === storyId);
      if (idx === -1) {
        const newS: any = { id: storyId, title, author, date: publishDate, sourceLink };
        if (chapterTitle) newS.chapters = [{ title: chapterTitle, fileName }]; else newS.fileName = fileName;
        indexData = [newS, ...indexData];
      } else {
        const s = indexData[idx]; s.title = title; s.author = author; s.date = publishDate; s.sourceLink = sourceLink;
        if (editingFileName) {
          if (s.chapters) { const ci = s.chapters.findIndex((c: any) => c.fileName === editingFileName); if (ci !== -1) s.chapters[ci].title = chapterTitle; }
          else if (chapterTitle) { s.chapters = [{ title: chapterTitle, fileName: s.fileName }]; delete s.fileName; }
        } else {
          if (!s.chapters) { s.chapters = [{ title: "第 1 节", fileName: s.fileName }, { title: chapterTitle, fileName }]; delete s.fileName; }
          else s.chapters.push({ title: chapterTitle, fileName });
        }
      }
      await octokit.rest.repos.createOrUpdateFileContents({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, // @ts-ignore
      sha: idxF.sha, message: `Update Index`, content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))), branch: BRANCH });
      setStatus('成功！正在跳转...');
      setTimeout(() => { setView('list'); setEditingId(null); setEditingFileName(null); setContent(''); setTitle(''); setChapterTitle(''); setStatus(''); setIsPublishing(false); }, 1500);
    } catch (err: any) { setStatus(`错误: ${err.message}`); setIsPublishing(false); }
  };

  return (
    <div className="min-h-screen p-4 max-w-[1400px] mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
      {/* 顶部工具栏：Key 管理 */}
      <header className="flex justify-between items-center mb-6 pb-4 border-b dark:border-white/10 gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold uppercase transition-colors shrink-0 hover:text-black dark:hover:text-white"><ChevronLeft size={16}/> EXIT</button>
        <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2 bg-blue-500/5 px-3 py-1.5 rounded-full border border-blue-500/20">
               <Sparkles size={14} className="text-blue-500"/>
               <input type="password" value={aiKey} onChange={e => { setAiKey(e.target.value); localStorage.setItem('gemini_key', e.target.value); }} className="bg-transparent w-24 focus:w-48 transition-all outline-none text-[10px]" placeholder="Gemini API Key" />
            </div>
            <div className="flex items-center gap-2 bg-slate-500/5 px-3 py-1.5 rounded-full border border-black/10">
               <Key size={14} className="opacity-40"/>
               <input type="password" value={token} onChange={e => { setToken(e.target.value); localStorage.setItem('gh_token', e.target.value); }} className="bg-transparent w-24 focus:w-48 transition-all outline-none text-[10px]" placeholder="GitHub Token" />
            </div>
            <button onClick={() => setView(view === 'create' ? 'list' : 'create')} className="bg-slate-900 text-white dark:bg-white dark:text-black px-4 py-1.5 rounded-full font-bold uppercase text-[10px] hover:scale-105 transition-all">
                {view === 'create' ? 'Manage' : 'New Story'}
            </button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-300">
            <h2 className="text-2xl font-black mb-6">Archive Management</h2>
            {stories.map(s => (
                <div key={s.id} className="p-5 border dark:border-white/10 rounded-2xl bg-white/50 dark:bg-black/20">
                    <div className="flex justify-between items-start mb-4">
                        <div><span className="font-bold text-lg block text-slate-900 dark:text-white">{s.title}</span><span className="text-[10px] opacity-40 uppercase">{s.date} · {s.author}</span></div>
                        <button onClick={() => handleAddChapter(s)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"><PlusCircle size={14}/> 续传/分P</button>
                    </div>
                    <div className="flex gap-2 flex-wrap border-t dark:border-white/5 pt-3">
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <button key={i} onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-lg text-xs hover:border-blue-500/50 border border-transparent transition-all">{c.title}</button>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-lg text-xs hover:border-blue-500/50 border border-transparent transition-all text-blue-500 italic">单页内容 (点击修改)</button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* 左侧：原文与 AI 辅助区 */}
          <div className="space-y-4 flex flex-col sticky top-4">
            <div className="flex justify-between items-center">
               <h3 className="font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Eraser size={18}/> Step 1: Input & Assist</h3>
               <div className="flex gap-2">
                  <button onClick={() => handleAIAssist('tags_only')} disabled={isAiLoading} className="px-3 py-1.5 border border-blue-500 text-blue-500 rounded-full text-[10px] font-bold hover:bg-blue-500 hover:text-white transition-all">仅自动排版</button>
                  <button onClick={() => handleAIAssist('full')} disabled={isAiLoading} className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-1">
                    <Sparkles size={12}/> 翻译+排版
                  </button>
               </div>
            </div>
            <div className="bg-slate-100 dark:bg-black/20 p-4 rounded-2xl border dark:border-white/5">
              <label className="text-[9px] font-black opacity-30 uppercase mb-2 block">Names Map / 译名对照</label>
              <textarea value={nameMap} onChange={e => setNameMap(e.target.value)} className="w-full h-14 bg-white dark:bg-black/40 p-2 rounded-xl text-[11px] font-mono outline-none mb-4 border dark:border-white/5" placeholder="一行一个，如 민규:玟奎" />
              <label className="text-[9px] font-black opacity-30 uppercase mb-2 block">Original Text / 贴入原文</label>
              <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} className="w-full h-[450px] bg-white dark:bg-black/40 p-4 rounded-xl outline-none text-sm font-serif leading-relaxed" placeholder="在此粘贴 Postype 原文..." />
            </div>
          </div>

          {/* 右侧：最终编辑发布区 */}
          <div className="space-y-4">
            <h3 className="font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CheckSquare size={18}/> Step 2: Final Edit & Publish</h3>
            <div className="bg-white dark:bg-black/20 p-6 rounded-2xl border dark:border-white/10 space-y-4 shadow-xl">
               <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-2 text-xl font-black outline-none focus:border-blue-500 transition-all" placeholder="文章总标题..." />
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black opacity-30 uppercase">Author</span>
                    <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl outline-none" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black opacity-30 uppercase">Date</span>
                    <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl outline-none" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-blue-500 uppercase">Chapter Title</span>
                    <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="w-full bg-blue-500/5 dark:bg-blue-500/10 p-2.5 rounded-xl outline-none border border-blue-500/20 text-blue-600 font-bold" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black opacity-30 uppercase">Source Link</span>
                    <input value={sourceLink} onChange={e => setSourceLink(e.target.value)} className="w-full bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl outline-none" placeholder="https://..." />
                  </div>
               </div>

               <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-white/5">
                  {[ 
                    ['**','**',Bold,'加粗'], 
                    ['*','*',Italic,'斜体'], 
                    ['[box]','[/box]',Square,'方框'], 
                    ['[quote]','[/quote]',Quote,'引用'], 
                    ['[bubble:L]','[/bubble]',MessageSquare,'左气泡'], 
                    ['[bubble:R]','[/bubble]',MessageSquare,'右气泡'], 
                    ['---','',Minus,'分割线'], 
                    ['[bvid:',']',Video,'视频'] 
                  ].map(([ot,ct,Icon,tip]:any, i) => (
                    <button key={i} type="button" onClick={(e) => insertTag(e, ot, ct)} className={`p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all bg-slate-100 dark:bg-white/5 ${ot.includes(':R') ? 'text-blue-500' : ''}`} title={tip}><Icon size={14}/></button>
                  ))}
               </div>

               <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} className="w-full h-[400px] bg-slate-50 dark:bg-white/5 p-4 rounded-xl outline-none leading-relaxed text-base font-serif" placeholder="在此校对或手动输入..." />

               <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 rounded-full font-black tracking-widest uppercase bg-blue-600 text-white shadow-2xl shadow-blue-500/40 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-400">
                 {isPublishing ? status : editingFileName ? 'Update Changes' : 'Publish Story'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
