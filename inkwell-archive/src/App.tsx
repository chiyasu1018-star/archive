import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, User, Hash, ExternalLink, ArrowLeft, Loader2 } from 'lucide-react';

interface Story {
  id: string;
  title: string;
  author: string;
  date: string;
  fileName: string; // 对应 public/stories/ 下的文件名
  sourceLink: string;
  wordCount?: number; // 自动计算
  content?: string;   // 自动读取
}

const App: React.FC = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);

  // 1. 初始加载文章列表
  useEffect(() => {
    fetch('/stories/index.json')
      .then(res => res.json())
      .then(data => {
        setStories(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 2. 当点击某篇文章时，自动读取 TXT 并计算字数
  const readFullStory = async (story: Story) => {
    setReading(true);
    try {
      const response = await fetch(`/stories/${story.fileName}`);
      const text = await response.text();
      // 自动计算字数（排除空格和换行）
      const count = text.replace(/\s+/g, '').length;
      
      setSelectedStory({
        ...story,
        content: text,
        wordCount: count
      });
    } catch (err) {
      alert("读取文档失败，请检查文件名是否正确");
    } finally {
      setReading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#f4f1ea] font-serif">正在开启档案馆...</div>;

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#2c2c2c] p-6 font-serif">
      {!selectedStory ? (
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-16 border-b border-[#d1cec0] pb-8">
            <h1 className="text-4xl font-bold tracking-[0.2em]">华旺档案馆</h1>
            <p className="mt-4 text-gray-500 italic text-sm">全自动 TXT 档案管理系统</p>
          </header>
          
          <div className="grid gap-6">
            {stories.map(story => (
              <div 
                key={story.id}
                onClick={() => readFullStory(story)}
                className="group bg-white/50 p-8 border border-[#d1cec0] hover:bg-white transition-all cursor-pointer flex justify-between items-center"
              >
                <div>
                  <h2 className="text-2xl font-medium mb-2 group-hover:text-brown-600 transition-colors">{story.title}</h2>
                  <div className="flex gap-6 text-[10px] text-gray-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><User size={12}/> {story.author}</span>
                    <span className="flex items-center gap-1"><Calendar size={12}/> {story.date}</span>
                  </div>
                </div>
                <div className="text-gray-300 group-hover:text-gray-600">→</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          <button onClick={() => setSelectedStory(null)} className="mb-12 flex items-center gap-2 text-gray-400 hover:text-black transition-colors text-xs tracking-widest">
            <ArrowLeft size={16}/> BACK TO ARCHIVE
          </button>
          
          <article className="bg-white p-8 md:p-16 border border-[#d1cec0] shadow-sm relative">
            <h1 className="text-3xl font-bold mb-8 text-center">{selectedStory.title}</h1>
            <div className="mb-12 text-[10px] text-[#8c8c8c] border-y border-gray-100 py-6 flex flex-wrap justify-between px-2 tracking-tighter">
              <span>AUTHOR: {selectedStory.author}</span>
              <span>DATE: {selectedStory.date}</span>
              <span className="text-black font-bold">WORDS: {selectedStory.wordCount?.toLocaleString()} (自动识别)</span>
              <a href={selectedStory.sourceLink} target="_blank" rel="noreferrer" className="underline hover:text-black">ORIGINAL SOURCE →</a>
            </div>
            
            <div className="whitespace-pre-wrap leading-[2.4] text-[1.15rem] text-[#333] text-justify">
              {selectedStory.content}
            </div>
            
            <div className="mt-20 text-center text-[10px] text-gray-300 tracking-[0.5em] border-t border-gray-50 pt-8">
              END OF DATA
            </div>
          </article>
        </div>
      )}
      
      {reading && (
        <div className="fixed inset-0 bg-white/80 flex flex-col items-center justify-center z-50">
          <Loader2 className="animate-spin mb-2" />
          <span className="text-xs tracking-widest text-gray-500">正在扫描文档字数并排版...</span>
        </div>
      )}
    </div>
  );
};

export default App;
