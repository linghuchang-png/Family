
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { STORIES } from './constants';
import StoryPlayer from './components/StoryPlayer';
import TranscriptionTool from './components/TranscriptionTool';
import { Story } from './types';
import { GeminiService } from './services/gemini';

const App: React.FC = () => {
  const [stories, setStories] = useState<Story[]>(STORIES);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [view, setView] = useState<'home' | 'story' | 'intro'>('home');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 });

  const gemini = useMemo(() => new GeminiService(), []);
  const storiesRef = useRef<Story[]>(stories);
  const enrichmentQueueRef = useRef<string[]>([]);
  const isEnrichingRef = useRef(false);

  useEffect(() => {
    storiesRef.current = stories;
  }, [stories]);

  const openApiKeyDialog = async () => {
    if (typeof (window as any).aistudio?.openSelectKey === 'function') {
      await (window as any).aistudio.openSelectKey();
      return true;
    }
    return false;
  };

  const enrichNextStory = async () => {
    // Process one story at a time to minimize rate limits and ensure stability
    if (enrichmentQueueRef.current.length === 0 || isEnrichingRef.current) {
      return;
    }
    
    isEnrichingRef.current = true;
    const storyId = enrichmentQueueRef.current.shift()!;
    
    try {
      const story = storiesRef.current.find(s => s.id === storyId);
      
      if (story) {
        const needsImage = !story.imageUrl;
        const needsAudio = !story.audioBase64;

        if (needsImage || needsAudio) {
          let imgResult = story.imageUrl;
          let audResult = story.audioBase64;

          // Sequential asset generation for maximum stability
          if (needsImage) {
            try {
              imgResult = await gemini.generatePoster(story.posterPrompt);
            } catch (err: any) {
              console.error(`Poster gen failed for ${storyId}:`, err);
              if (err.message === "PAID_KEY_REQUIRED" || JSON.stringify(err).includes("limit: 0")) {
                await openApiKeyDialog();
              }
            }
          }

          // Delay between requests
          await new Promise(r => setTimeout(r, 2000));

          if (needsAudio) {
            try {
              audResult = await gemini.textToSpeech(story.content);
            } catch (err: any) {
              console.error(`Audio gen failed for ${storyId}:`, err);
              if (err.message === "PAID_KEY_REQUIRED" || JSON.stringify(err).includes("limit: 0")) {
                await openApiKeyDialog();
              }
            }
          }

          setStories(prev => prev.map(s => 
            s.id === storyId ? { ...s, imageUrl: imgResult, audioBase64: audResult } : s
          ));
        }
      }
    } catch (e: any) {
      console.error(`Enrichment loop error:`, e);
    } finally {
      setEnrichmentProgress(p => ({ ...p, current: Math.min(p.current + 1, p.total) }));
      isEnrichingRef.current = false;
      
      // Wait before next story
      await new Promise(r => setTimeout(r, 3000));
      enrichNextStory();
    }
  };

  const handleRegenerateStories = async () => {
    setIsRegenerating(true);
    setEnrichmentProgress({ current: 0, total: 10 });
    enrichmentQueueRef.current = [];
    
    try {
      const newStories = await gemini.generateStories();
      if (newStories && newStories.length > 0) {
        setStories(newStories);
        storiesRef.current = newStories;
        enrichmentQueueRef.current = newStories.map(s => s.id);
        enrichNextStory();
      }
    } catch (err: any) {
      console.error("Story generation failed:", err);
      if (err.message === "PAID_KEY_REQUIRED" || JSON.stringify(err).includes("limit: 0")) {
        await openApiKeyDialog();
      } else {
        alert("创作新故事时遇到了点麻烦，请检查网络后再试哦。");
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleStoryEnd = () => {
    if (!selectedStory) return;
    const currentIndex = stories.findIndex(s => s.id === selectedStory.id);
    if (currentIndex < stories.length - 1) {
      const nextStory = stories[currentIndex + 1];
      if (nextStory.audioBase64) {
        setSelectedStory(nextStory);
      }
    }
  };

  useEffect(() => {
    const unreadyIds = stories.filter(s => !s.imageUrl || !s.audioBase64).map(s => s.id);
    if (unreadyIds.length > 0) {
      enrichmentQueueRef.current = unreadyIds;
      setEnrichmentProgress({ current: stories.length - unreadyIds.length, total: stories.length });
      enrichNextStory();
    }
  }, []);

  return (
    <div className="min-h-screen pb-20 selection:bg-amber-200">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => setView('home')} className="flex items-center space-x-2 group">
          <div className="w-10 h-10 bg-amber-400 rounded-2xl flex items-center justify-center shadow-lg group-active:scale-90 transition-all">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          </div>
          <span className="font-black text-xl text-slate-800">宝贝睡前小故事</span>
        </button>
        <div className="flex items-center space-x-4">
          <button 
            onClick={openApiKeyDialog}
            className="text-xs font-bold text-slate-400 hover:text-amber-500 transition-colors bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100"
          >
            设置付费 Key
          </button>
          {view === 'home' && (
            <button 
              onClick={handleRegenerateStories}
              disabled={isRegenerating}
              className="px-5 py-2.5 bg-slate-900 text-white text-xs font-black rounded-full shadow-lg active:scale-95 disabled:opacity-50 transition-all flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>换一批新故事</span>
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {view === 'home' && (
          <div className="space-y-12 max-w-4xl mx-auto">
            <section className="text-center space-y-4">
              <h2 className="text-5xl font-black text-slate-900 leading-tight">莯莯依依, <span className="text-amber-500">你们好</span>!</h2>
              {enrichmentProgress.current < enrichmentProgress.total && (
                <div className="inline-flex flex-col items-center space-y-2">
                  <div className="inline-flex items-center space-x-3 bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-amber-800 text-sm font-black">
                      爸爸正在慢慢画画讲故事... ({enrichmentProgress.current}/{enrichmentProgress.total})
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium italic">温馨提示：为了最好的体验，请确保使用了启用了结算的 API Key 哦</p>
                </div>
              )}
            </section>

            {isRegenerating ? (
              <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] shadow-xl border-4 border-amber-100 border-dashed animate-pulse">
                <span className="text-6xl mb-6">✍️</span>
                <p className="text-amber-900 text-xl font-black">正在为宝贝们构思更有趣的故事...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {stories.map((story, index) => (
                  <button
                    key={story.id + index}
                    onClick={() => { setSelectedStory(story); setView('story'); }}
                    className="group relative flex flex-col items-start bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all text-left overflow-hidden"
                  >
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-100 font-black text-4xl group-hover:bg-amber-50 group-hover:text-amber-100 transition-colors">
                      {index + 1}
                    </div>
                    <div className="w-16 h-16 mb-6 bg-amber-50 rounded-3xl flex items-center justify-center text-3xl group-hover:scale-110 transition-all">
                      {story.theme.includes('意外') ? '💨' : story.theme.includes('想象') ? '☁️' : story.theme.includes('互动') ? '👥' : story.theme.includes('解谜') ? '🕵️' : '📖'}
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2 leading-tight">{story.title}</h3>
                    <div className="text-slate-400 font-bold flex items-center space-x-2">
                      <span>{story.theme}</span>
                      {story.audioBase64 ? (
                        <span className="text-green-500 bg-green-50 px-2 py-0.5 rounded-full text-[10px] animate-bounce">● 爸爸讲好啦</span>
                      ) : (
                        <span className="text-amber-400 text-[10px]">○ 准备中...</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <TranscriptionTool />
          </div>
        )}

        {view === 'story' && selectedStory && (
          <div className="animate-fadeIn">
             <button onClick={() => setView('home')} className="mb-8 flex items-center space-x-3 text-slate-400 hover:text-slate-900 font-black transition-all group">
               <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7"/></svg>
               </div>
               <span>返回故事书</span>
             </button>
             <StoryPlayer story={selectedStory} onStoryEnd={handleStoryEnd} />
          </div>
        )}
      </main>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default App;
