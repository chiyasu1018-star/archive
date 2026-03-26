import React, { useState, useEffect, useRef } from 'react';
import { Octokit } from "octokit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  ChevronLeft, Key, Edit3, List, Bold, Italic, Quote, MessageSquare, 
  Minus, Video, PlusCircle, Square, Sparkles, Wand2, Eraser, CheckSquare, Cpu
} from 'lucide-react';

const REPO_OWNER = "chiyasu1018-star"; 
const REPO_NAME = "archive";      
const BRANCH = "main";             

export default function Admin({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [aiKey, setAiKey] = useState(localStorage.getItem('gemini_key') || '');
  // ✅ 默认切换为 Google 免费且最快的 gemini-2.0-flash 模型
  const [modelId, setModelId] = useState(localStorage.getItem('gemini_model') || 'gemini-2.5-flash');
  
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

  // --- 🌟 增强版：本地一键洗稿 ---
  const handleLocalSmartFix = () => {
    let text = content || aiInput;
    
    // 1. 清理 Postype 恶心的多余换行 (把3个及以上的连续换行变成2个)
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // 2. 自动抠出所有B站链接并转为 [bvid:...] 标签
    const bvidRegex = /https?:\/\/www\.bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/ig;
    text = text.replace(bvidRegex, '\n[bvid:$1]\n');
    
    // 3. 规范化分割线
    text = text.replace(/^[—\-_*]{3,}$/gm, '---');
    
    setContent(text);
    setStatus("本地格式优化完成！空行与链接已清洗。");
  };

  // --- 🤖 增强版：AI 处理函数 ---
  const handleAIAssist = async (mode: 'full' | 'tags_only') => {
    if (!aiKey) return alert("请先填写顶部的 Gemini Key");
    if (!aiInput) return alert("请在左侧贴入原文");
    setIsAiLoading(true);
    setStatus(mode === 'full' ? "AI 逐句翻译排版中 (保留多媒体)..." : "AI 正在重构排版...");
    
    try {
      const genAI = new GoogleGenerativeAI(aiKey);
      const model = genAI.getGenerativeModel({ model: modelId });
      
      const prompt = `
        你是一个专业的同人档案馆排版专家。请处理以下从 Postype 复制的原文（可能是纯文本或带 HTML 标签）：

        【核心任务】
        1. ${mode === 'full' ? '将韩文高品质翻译成中文，严禁机翻味，保留原作者情感。' : '保持原文语言，绝对不要翻译。'}
        2. 严格使用以下译名对照表：\n${nameMap}

        【排版与标签规则 - 必须严格遵守】
        1. 对话气泡：如果是民规说话，用 [bubble:L]内容[/bubble]；如果是圆佑说话，用 [bubble:R]内容[/bubble]。
        2. 心理活动/独白：用 [quote]内容[/quote] 括起来。
        3. 场景分割线：统一替换为 ---。
        4. 视频与多媒体：
           - 如果看到 bilibili 链接 (包含 BV 号)，必须转为 [bvid:BVxxxx] 格式。
           - 如果看到 YouTube 链接或其他视频 iframe，保留链接并用 [box]视频地址[/box] 括起来。
           - 绝对不要删除任何图片链接、占位符或视频地址！
        5. 行间距优化：清理多余的空白行，确保段落之间只有 1 个空行。

        直接输出处理好的纯净文本（带标签），不要包含任何Markdown代码块标记（如 \`\`\`html），不要说任何废话。
        原文内容如下：
        \n${aiInput}
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // 去除可能产生的 markdown 标记
      const cleanText = text.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
      
      setContent(cleanText);
      setStatus("处理完成，请在右侧检查并保存。");
    } catch (err: any) { 
      alert("AI 报错: " + err.message);
      setStatus(`错误: ${err.message}`);
    } finally { setIsAiLoading(false); }
  };

  // --- GitHub 发布逻辑 (原封不动，最稳版本) ---
  const fetchStories = async () => {
    try {
      const res = await fetch(`/stories/index.json?v=${Date.now()}`);
      const data = await res.json();
      setStories(data);
    } catch (err) { alert("获取列表失败"); }
  };
  useEffect(() => { if (view === 'list') fetchStories(); }, [view]);

  const insertTag = (e: React.MouseEvent, openTag: string, closeTag: string = '') => {
    e.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;
    const savedScrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const isBlock = openTag.includes('quote') || openTag.includes('bubble') || openTag.includes('bvid') || openTag.includes('---') || openTag.includes('box');
    let textToInsert = isBlock ? `\n${openTag}\n${selectedText || '内容'}\n${closeTag}\n` : `${openTag}${selectedText}${closeTag}`;
    setContent(content.substring(0, start) + textToInsert + content.substring(end));
    setTimeout(() => { textarea.focus(); textarea.scrollTop = savedScrollTop; }, 10);
  };

  const handlePublish = async () => {
    if (!token || !title || !content) return alert("信息填写不全");
    setIsPublishing(true); setStatus('同步至 GitHub...');
    try {
      const octokit = new Octokit({ auth: token });
      const storyId = editingId || Date.now().toString();
      const fileName = editingFileName || `story_${storyId}_${Date.now()}.txt`;
      let currentSha = undefined;
      if (editingFileName) {
          try { const { data: f } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${editingFileName}`, request: { cache: 'no-store' } }); // @ts-ignore
          currentSha = f.sha; } catch (e) {}
      }
      await octokit.rest.repos.createOrUpdateFileContents({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`, message: `Post: ${title}`, content: btoa(unescape(encodeURIComponent(content))), sha: currentSha, branch: BRANCH });
      const { data: idxF } = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, request: { cache: 'no-store' } }); // @ts-ignore
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
        } else {
          if (!s.chapters) { s.chapters = [{ title: "第 1 节", fileName: s.fileName }, { title: chapterTitle, fileName }]; delete s.fileName; }
          else s.chapters.push({ title: chapterTitle, fileName });
        }
      }
      await octokit.rest.repos.createOrUpdateFileContents({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/index.json`, // @ts-ignore
      sha: idxF.sha, message: `Update Index`, content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))), branch: BRANCH });
      setStatus('发布成功！自动跳转中...');
      setTimeout(() => { setView('list'); setEditingId(null); setEditingFileName(null); setStatus(''); setIsPublishing(false); }, 1500);
    } catch (err: any) { setStatus(`错误: ${err.message}`); setIsPublishing(false); }
  };

  const handleEdit = (story: any, fileName: string, cTitle: string = '') => {
    setEditingId(story.id); setEditingFileName(fileName); setTitle(story.title); setAuthor(story.author || ''); setPublishDate(story.date || new Date().toISOString().split('T')[0]); setSourceLink(story.sourceLink || ''); setChapterTitle(cTitle);
    setStatus('正在拉取文章内容...'); setView('create');
    const octokit = new Octokit({ auth: token });
    octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: `public/stories/${fileName}`, request: { cache: 'no-store' } }).then(({ data }: any) => {
      setContent(decodeURIComponent(escape(atob(data.content)))); setStatus('内容加载完毕'); setEditingFileSha(data.sha);
    }).catch(() => setStatus('拉取内容失败'));
  };

  const handleAddChapter = (story: any) => {
    setEditingId(story.id); setEditingFileName(null); setTitle(story.title); setAuthor(story.author || ''); setPublishDate(story.date || new Date().toISOString().split('T')[0]); setSourceLink(story.sourceLink || ''); setChapterTitle(''); setContent(''); setView('create'); setStatus('准备添加新章节');
  };

  return (
    <div className="min-h-screen p-4 max-w-[1440px] mx-auto font-sans text-sm text-slate-800 dark:text-slate-200">
      <header className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b dark:border-white/10 gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-black dark:hover:text-white transition-colors shrink-0"><ChevronLeft size={16}/> EXIT</button>
        <div className="flex gap-2 items-center ml-auto">
            <div className="flex items-center gap-2 bg-purple-500/5 px-3 py-1.5 rounded-full border border-purple-500/20"><Cpu size={14} className="text-purple-500"/><input type="text" value={modelId} onChange={e => { setModelId(e.target.value); localStorage.setItem('gemini_model', e.target.value); }} className="bg-transparent w-32 text-[10px] outline-none" placeholder="Model ID" /></div>
            <div className="flex items-center gap-2 bg-blue-500/5 px-3 py-1.5 rounded-full border border-blue-500/20"><Sparkles size={14} className="text-blue-500"/><input type="password" value={aiKey} onChange={e => { setAiKey(e.target.value); localStorage.setItem('gemini_key', e.target.value); }} className="bg-transparent w-32 text-[10px] outline-none" placeholder="Gemini Key" /></div>
            <div className="flex items-center gap-2 bg-slate-500/5 px-3 py-1.5 rounded-full border border-black/10"><Key size={14} className="opacity-40"/><input type="password" value={token} onChange={e => { setToken(e.target.value); localStorage.setItem('gh_token', e.target.value); }} className="bg-transparent w-32 text-[10px] outline-none" placeholder="GitHub Token" /></div>
            <button onClick={() => setView(view === 'create' ? 'list' : 'create')} className="bg-slate-900 text-white dark:bg-white dark:text-black px-5 py-1.5 rounded-full font-bold uppercase text-[10px] hover:scale-105 transition-all">
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
                        <div><span className="font-bold text-lg block">{s.title}</span><span className="text-[10px] opacity-40 uppercase">{s.date} · {s.author}</span></div>
                        <button onClick={() => handleAddChapter(s)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase hover:bg-blue-700 transition-all"><PlusCircle size={14}/> 续传/分P</button>
                    </div>
                    <div className="flex gap-2 flex-wrap border-t dark:border-white/5 pt-3">
                        {s.chapters ? s.chapters.map((c: any, i: number) => (
                            <button key={i} onClick={() => handleEdit(s, c.fileName, c.title)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-lg text-xs hover:border-blue-500 transition-all">{c.title}</button>
                        )) : (
                            <button onClick={() => handleEdit(s, s.fileName)} className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-lg text-xs hover:border-blue-500 transition-all text-blue-500 italic">单页内容 (点击编辑)</button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Step 1: 原文输入 */}
          <div className="space-y-4 flex flex-col sticky top-4">
            <div className="flex justify-between items-center text-blue-600 uppercase tracking-widest font-black">
               <h3 className="flex items-center gap-2"><Eraser size={18}/> Step 1: Input & Magic</h3>
               <div className="flex gap-2">
                  <button onClick={() => handleAIAssist('tags_only')} className="px-3 py-1.5 border border-blue-500 text-blue-500 rounded-full text-[10px] font-bold hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50" disabled={isAiLoading}>仅排版</button>
                  <button onClick={() => handleAIAssist('full')} className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-bold hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50" disabled={isAiLoading}>
                    {isAiLoading ? <span className="animate-pulse">处理中...</span> : <><Sparkles size={12}/> 翻译+排版</>}
                  </button>
               </div>
            </div>
            <div className="bg-slate-100 dark:bg-black/20 p-4 rounded-2xl border dark:border-white/5">
              <textarea value={nameMap} onChange={e => setNameMap(e.target.value)} className="w-full h-14 bg-white dark:bg-black/40 p-2 rounded-xl text-[10px] font-mono outline-none mb-4 border dark:border-white/5" placeholder="译名对照: 민규:玟奎" />
              <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} className="w-full h-[500px] bg-white dark:bg-black/40 p-4 rounded-xl outline-none text-sm font-serif leading-relaxed" placeholder="在此贴入 Postype 韩文原文（哪怕是乱糟糟的格式也没关系）..." />
            </div>
          </div>

          {/* Step 2: 最终编辑 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-slate-400 uppercase tracking-widest font-black">
               <h3 className="flex items-center gap-2"><CheckSquare size={18}/> Step 2: Final Calibration</h3>
               <button onClick={handleLocalSmartFix} className="px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-bold flex items-center gap-1 hover:bg-amber-500 hover:text-white transition-all"><Wand2 size={12}/> 本地一键纠错</button>
            </div>
            <div className="bg-white dark:bg-black/20 p-6 rounded-2xl border dark:border-white/10 space-y-4 shadow-xl shadow-xl">
               <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-2 text-xl font-black outline-none focus:border-blue-500 transition-all" placeholder="总标题..." />
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
               <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} className="w-full h-[400px] bg-slate-50 dark:bg-white/5 p-4 rounded-xl outline-none leading-relaxed text-base font-serif" placeholder="在此手动校对结果..." />
               
               {/* 状态提示栏 */}
               {status && (
                 <div className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                   {status}
                 </div>
               )}

               <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 rounded-full font-black tracking-widest uppercase bg-blue-600 text-white shadow-2xl active:scale-95 transition-all disabled:bg-slate-400">
                 {isPublishing ? '发布中...' : editingFileName ? 'Save Changes / 保存修改' : 'Post Story / 立即发布'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
