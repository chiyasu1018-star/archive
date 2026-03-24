// 1. 更加智能的样式解析函数：处理 ** 内部有空格的情况
const applyInlineStyles = (text: string) => {
  if (!text) return '';
  return text
    // 匹配 ** 并在内部进行清理，确保 ** 加粗 ** 也能识别
    .replace(/\*\*\s*(.*?)\s*\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
    // 匹配 * 斜体 *
    .replace(/\*\s*(.*?)\s*\*/g, '<em class="italic opacity-80">$1</em>');
};

// ... (省略中间代码，直接看 article 渲染逻辑)

<article style={{ fontSize: `${fontSize}px`, lineHeight: '1.9' }} className="text-justify mb-24 font-serif text-[#333] dark:text-[#E0E0E0]">
  {(() => {
    let raw = currentStory.content || '';
    
    // 【智能优化一】：清理所有标签前后的冗余缩进、制表符和空格
    // 这样用户在后台怎么折腾空格，前台都不会崩
    raw = raw.replace(/^\s*(\[[\/]?\w+.*?\]|---)\s*$/gm, '$1');

    // 【智能优化二】：规范化换行，防止跨平台字符导致失效
    raw = raw.replace(/\r\n/g, '\n');

    // 解析正则：支持 box
    const blockRegex = /(\[quote\][\s\S]*?\[\/quote\]|\[box\][\s\S]*?\[\/box\]|\[bubble:[LR]\][\s\S]*?\[\/bubble\]|\[bvid:[a-zA-Z0-9]+\]|^---$)/gm;
    const parts = raw.split(blockRegex);
    
    return parts.map((part, idx) => {
        if (!part || !part.trim()) return null;

        // A. 引用 [quote]
        if (part.includes('[quote]')) {
            const inner = part.replace(/\[\/?quote\]/g, '').trim();
            return (
                <blockquote key={idx} className="my-10 pl-5 border-l-4 border-slate-300 dark:border-slate-700 italic text-slate-500 dark:text-slate-400 bg-slate-100/30 dark:bg-white/5 py-6 rounded-r-xl">
                    {inner.split('\n').map((l, i) => (
                      <p key={i} className={l.trim() ? "mb-2 last:mb-0" : "h-4"} dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) || '&nbsp;' }} />
                    ))}
                </blockquote>
            );
        }

        // B. 灰色方框 [box] - 优化区块间距与圆角
        if (part.includes('[box]')) {
          const inner = part.replace(/\[\/?box\]/g, '').trim();
          return (
              <div key={idx} className="my-10 p-8 bg-slate-100/60 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl text-sm leading-relaxed shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  {inner.split('\n').map((l, i) => (
                    <p key={i} className={l.trim() ? "mb-2 last:mb-0" : "h-4"} dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) || '&nbsp;' }} />
                  ))}
              </div>
          );
        }

        // C. 气泡 [bubble] - 优化间距对齐
        if (part.includes('[bubble:')) {
            const isRight = part.includes('[bubble:R]');
            const inner = part.replace(/\[bubble:[LR]\]/g, '').replace(/\[\/bubble\]/g, '').trim();
            return (
                <div key={idx} className={`flex ${isRight ? 'justify-end' : 'justify-start'} my-1`}>
                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm tracking-tight ${isRight ? 'bg-[#607d8b] text-white rounded-tr-none' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'}`}>
                        {inner.split('\n').map((l, i) => (
                          <p key={i} className="mb-0" dangerouslySetInnerHTML={{ __html: applyInlineStyles(l) || '&nbsp;' }} />
                        ))}
                    </div>
                </div>
            );
        }

        // D. 视频 [bvid]
        if (part.includes('[bvid:')) {
            const bvid = part.match(/\[bvid:([a-zA-Z0-9]+)\]/)?.[1];
            return (
                <div key={idx} className="my-10 aspect-video w-full overflow-hidden rounded-2xl shadow-2xl bg-black ring-1 ring-white/10">
                    <iframe src={`//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0`} className="w-full h-full border-none" allowFullScreen />
                </div>
            );
        }

        // E. 分割线 ---
        if (part.trim() === '---') {
            return <hr key={idx} className="my-16 border-t border-black/10 dark:border-white/10" />;
        }

        // F. 普通文本 - 增加智能段落合并
        return part.split('\n').map((line, lIdx) => {
            const cleanLine = line.trim();
            // 智能识别空行并给予不同高度
            if (!cleanLine) return <div key={lIdx} className="h-6" />;
            
            return (
                <p 
                    key={`${idx}-${lIdx}`} 
                    className="mb-5 min-h-[1.5em] transition-all" 
                    dangerouslySetInnerHTML={{ __html: applyInlineStyles(line) }} 
                />
            );
        });
    });
  })()}
</article>
