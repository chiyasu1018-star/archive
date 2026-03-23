<article style={{ fontSize: `${fontSize}px`, lineHeight: '1.9' }} className="text-justify mb-24 font-serif">
  {currentStory.content?.split('\n').map((line, lineIdx) => {
    const trimmedLine = line.trim();

    // 1. 分割线
    if (trimmedLine === '---') return <hr key={lineIdx} className="my-12 border-t border-black/10 dark:border-white/10" />;

    // 2. 灰色竖线引用 [quote]
    if (line.includes('[quote]') && line.includes('[/quote]')) {
      const content = line.replace('[quote]', '').replace('[/quote]', '');
      return <blockquote key={lineIdx} className="my-6 pl-4 border-l-4 border-slate-300 dark:border-slate-700 italic text-slate-500 dark:text-slate-400">{content}</blockquote>;
    }

    // 3. 对话气泡 [bubble:L/R]
    if (line.includes('[bubble:')) {
      const isRight = line.includes('[bubble:R]');
      const content = line.replace(/\[bubble:[LR]\]/, '').replace('[/bubble]', '');
      return (
        <div key={lineIdx} className={`flex ${isRight ? 'justify-end' : 'justify-start'} my-6`}>
          <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
            isRight 
              ? 'bg-[#607d8b] text-white rounded-tr-none shadow-sm' 
              : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
          }`}>
            {content}
          </div>
        </div>
      );
    }

    // 4. B站视频 [bvid:xxx]
    if (line.includes('[bvid:')) {
      const bvid = line.match(/\[bvid:([a-zA-Z0-9]+)\]/)?.[1];
      if (bvid) return (
        <div key={lineIdx} className="my-8 aspect-video w-full overflow-hidden rounded-xl shadow-xl bg-black">
          <iframe src={`//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0`} className="w-full h-full border-none" allowFullScreen />
        </div>
      );
    }

    // 5. 行内格式（加粗和斜体）
    const formattedLine = line
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic opacity-80">$1</em>');

    return (
      <p 
        key={lineIdx} 
        className="mb-4 min-h-[1.5em]"
        dangerouslySetInnerHTML={{ __html: formattedLine || '&nbsp;' }} 
      />
    );
  })}
</article>
