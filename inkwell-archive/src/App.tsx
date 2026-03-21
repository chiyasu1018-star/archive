/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Moon, 
  Sun, 
  ShieldAlert,
  Loader2,
  Heart
} from 'lucide-react';

// --- Types ---

interface Story {
  id: string;
  title: string;
  author: string;
  date: string;
  fileName: string;
  sourceLink: string;
  wordCount?: number;
  content?: string;
}

export default function App() {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [fontSize, setFontSize] = useState(18); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  
  // 核心状态控制
  const [hasConfirmedAge, setHasConfirmedAge] = useState(false);
  const [isHonest, setIsHonest] = useState(false); // 用户选择 NO 后的状态

  useEffect(() => {
    fetch('/stories/index.json')
      .then(res => res.json())
      .then(data => {
        setStories(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadFullStory = async (story: Story) => {
    if (story.content) {
      setCurrentStory(story);
      return;
    }
    setReading(true);
    try {
      const response = await fetch(`/stories/${story.fileName}`);
      const text = await response.text();
      const count = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length;
      const updatedStory = { ...story, content: text, wordCount: count };
      setCurrentStory(updatedStory);
      setStories(prev => prev.map(s => s.id === story.id ? updatedStory : s));
    } catch (err) {
      alert("读取失败，请确认 public/stories/ 下的文件是否存在");
    } finally {
      setReading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-serif opacity-30 tracking-[0.3em]">INITIALIZING...</div>;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'dark bg-[#121212] text-[#E0E0E0]' : 'bg-[#F5F5F5] text-[#333333]'} font-serif selection:bg-black/5 bg-noise`}>
      
      <AnimatePresence mode="wait">
        {!hasConfirmedAge ? (
          /* --- 第一界面：18+ 确认页 --- */
          <motion.div 
            key="age-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center"
          >
            <AnimatePresence mode="wait">
              {!isHonest ? (
                /* 初始询问状态 */
                <motion.div 
                  key="question"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  className="max-w-md w-full"
                >
                  <ShieldAlert className="mx-auto mb-8 opacity-20" size={48} />
                  <h1 className="text-2xl font-bold tracking-[0.3em] mb-4 uppercase">Content Warning</h1>
                  <div className="space-y-4 mb-12">
                    <p className="text-xs leading-relaxed opacity-60 tracking-widest">
                      本站包含 R18 受限内容，仅供成年同好交流使用。
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-40">
                      Are you over 18 years of age?
                    </p>
                  </div>

                  <div className="flex flex-col gap-4 items-center">
                    <button 
                      onClick={() => setHasConfirmedAge(true)}
                      className={`w-48 py-3 border rounded-full text-[10px] font-bold tracking-[0.3em] uppercase transition-all ${
                        isDarkMode ? 'border-white/20 hover:bg-white hover:text-black' : 'border-black/20 hover:bg-black hover:text-white'
                      }`}
                    >
                      YES / 进入
                    </button>
                    <button 
                      onClick={() => setIsHonest(true)} 
                      className="text-[10px] uppercase tracking-[0.2em] opacity-30 hover:opacity-100 transition-opacity"
                    >
                      NO / 未满
