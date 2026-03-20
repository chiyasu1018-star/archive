/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Book, 
  ChevronLeft, 
  Moon, 
  Sun, 
  Type, 
  ArrowUp, 
  Clock, 
  Hash, 
  User,
  BookOpen,
  Home
} from 'lucide-react';

// --- Types ---

interface Story {
  id: string;
  title: string;
  author: string;
  date: string;
  wordCount: number;
  sourceLink: string;
  content: string;
}

// --- Constants ---

const STORIES: Story[] = [
  {
    id: '1',
    title: '月光下的图书馆',
    author: '김작가',
    date: '2024-03-15',
    wordCount: 1250,
    sourceLink: 'https://posty.pe/example1',
    content: `这是一个关于月光和书籍的故事。

在那个被遗忘的角落，书页在微风中轻轻翻动。

每一行文字都承载着一段不为人知的往事。`
  },
  {
    id: '2',
    title: '发条之城',
    author: '이작가',
    date: '2024-02-28',
    wordCount: 840,
    sourceLink: 'https://posty.pe/example2',
    content: `齿轮在转动，蒸汽在升腾。

这座城市从不休息，也从不入睡。

在金属的轰鸣声中，有人在寻找失落的灵魂。`
  },
  {
    id: '3',
    title: '影之旋律',
    author: '박작가',
    date: '2024-01-10',
    wordCount: 2100,
    sourceLink: 'https://posty.pe/example3',
    content: `旋律在阴影中穿梭，如同幽灵一般。

那是来自深渊的歌声，凄美而动人。

听，那是时间在哭泣。`
  }
];

// --- Components ---

export default function App() {
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [fontSize, setFontSize] = useState(18); // px
  const [isDarkMode, setIsDarkMode] = useState(false);

  const increaseFontSize = () => setFontSize(prev => Math.min(prev + 2, 28));
  const decreaseFontSize = () => setFontSize(prev => Math.max(prev - 2, 14));
  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'dark bg-[#121212] text-[#E0E0E0]' : 'bg-[#F5F5F5] text-[#333333]'} font-serif selection:bg-black/5 bg-noise`}>
      
      {/* Navigation / Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-sm transition-colors duration-500 ${isDarkMode ? 'bg-black/30 border-white/10' : 'bg-white/30 border-black/5'} border-b`}>
        <div className="flex items-center gap-4">
          {currentStory ? (
            <button 
              onClick={() => setCurrentStory(null)}
              className={`flex items-center gap-2 text-xs uppercase tracking-widest font-sans font-bold transition-opacity ${isDarkMode ? 'text-white/60 hover:text-white' : 'opacity-60 hover:opacity-100'}`}
            >
              <ChevronLeft size={16} />
              Back to Home
            </button>
          ) : (
            <h1 className={`text-sm uppercase tracking-widest font-sans font-semibold transition-opacity ${isDarkMode ? 'text-white/30' : 'text-black/30'}`}>
              <span className={`text-[0.7rem] align-middle tracking-[2px] mr-2 ${isDarkMode ? 'text-white/90' : 'text-black/80'}`}>hwawang /</span>
              Archive
            </h1>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleDarkMode}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-yellow-400' : 'hover:bg-black/5 text-slate-700'}`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {currentStory && (
            <div className="flex items-center gap-2">
              <button 
                onClick={decreaseFontSize} 
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} 
                title="A-"
              >
                <span className="text-xs font-sans font-bold">A-</span>
              </button>
              <button 
                onClick={increaseFontSize} 
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} 
                title="A+"
              >
                <span className="text-lg font-sans font-bold">A+</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="pt-20 pb-20 px-6 max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          {!currentStory ? (
            <motion.div
              key="archive"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="space-y-8"
            >
              {/* Hero Section */}
              <header className="text-center pt-12 px-5 pb-4">
                <h1 className={`font-serif text-[1.8rem] font-bold tracking-[0.15em] m-0 ${isDarkMode ? 'text-white/90' : 'text-[#1a1a1a]'}`}>
                  花汪导航
                </h1>
                
                <div className={`mt-4 tracking-[0.2em] text-[0.9rem] uppercase ${isDarkMode ? 'text-white/40' : 'text-[#888888]'}`}>
                  녘랜 Archive
                </div>

              </header>

              {/* Story List (Magazine Style) */}
              <section className="flex flex-col max-w-[800px] mx-auto px-4">
                {STORIES.map((story) => (
                  <motion.button
                    key={story.id}
                    whileHover={{ x: 8 }}
                    onClick={() => setCurrentStory(story)}
                    className={`grid grid-cols-[1fr_auto] items-center py-8 px-2 border-b transition-all text-left group ${
                      isDarkMode 
                        ? 'border-white/10 bg-transparent hover:border-white/20' 
                        : 'border-[#eeeeee] bg-transparent hover:border-[#dddddd]'
                    }`}
                  >
                    <h3 className={`col-span-full text-[1.4rem] font-medium tracking-tight mb-2 transition-colors ${
                      isDarkMode ? 'text-white/90 group-hover:text-white' : 'text-[#222222] group-hover:text-black'
                    }`}>
                      {story.title}
                    </h3>
                    <span className={`text-[0.95rem] italic font-serif ${isDarkMode ? 'text-white/50' : 'text-[#555555]'}`}>
                      {story.author}
                    </span>
                    <span className={`text-[0.85rem] font-mono text-right ${isDarkMode ? 'text-white/30' : 'text-[#aaaaaa]'}`}>
                      {story.date.replace(/-/g, '.')} | {story.wordCount.toLocaleString()} words
                    </span>
                  </motion.button>
                ))}
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="reader"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-[700px] mx-auto"
            >
              {/* Reader Header */}
              <header className={`mb-16 text-left border-b ${isDarkMode ? 'border-white/10' : 'border-black/5'} pb-12`}>
                <h2 className="text-4xl md:text-5xl font-light leading-tight mb-8">
                  {currentStory.title}
                </h2>
                <div className={`space-y-2 text-[11px] uppercase tracking-widest font-sans font-bold ${isDarkMode ? 'text-white/40' : 'opacity-50'}`}>
                  <p>Original Author: {currentStory.author}</p>
                  <p>Date: {currentStory.date.replace(/-/g, '.')}</p>
                  <p>Word Count: {currentStory.wordCount.toLocaleString()} words</p>
                </div>
                <div className="mt-8">
                  <a 
                    href={currentStory.sourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-widest font-sans font-bold transition-all ${isDarkMode ? 'text-white/40 hover:text-white' : 'opacity-40 hover:opacity-100'}`}
                  >
                    Original Source (Postype) →
                  </a>
                </div>
              </header>

              {/* Content */}
              <article 
                className="mx-auto transition-all duration-300"
                style={{ 
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.8',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {currentStory.content}
              </article>

              {/* Reader Footer */}
              <footer className="mt-24 pt-12 border-t border-black/5 flex flex-col items-start">
                <div className="text-[10px] opacity-30 uppercase tracking-[0.2em]">End of Transmission</div>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Contact Footer */}
      <footer className="footer-contact">
        <p>如有疑问请联系微博：<span className="highlight-id">@冰冻苹果咖</span></p>
      </footer>

      {/* Global Footer */}
      <footer className={`py-16 px-6 border-t ${isDarkMode ? 'border-white/10' : 'border-[#e0e0e0]'} text-center font-mono tracking-[-0.2px]`}>
        <div className="max-w-2xl mx-auto space-y-4 text-[11px] leading-relaxed text-[#999999]">
          <p>本站仅作为 녘랜 (花汪) 同好交流使用。所有内容版权归 Postype 原作者所有。</p>
          <p>This site is intended for personal translation and exhibition purposes only. All rights belong to the original author.</p>
          <p className="pt-4 opacity-40 uppercase tracking-widest">
            © 2026 Archive
          </p>
        </div>
      </footer>
    </div>
  );
}
