
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Story } from '../types';
import { base64ToUint8Array, decodeAudioData } from '../services/gemini';

interface StoryPlayerProps {
  story: Story;
  onStoryEnd?: () => void;
}

const StoryPlayer: React.FC<StoryPlayerProps> = ({ story, onStoryEnd }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const wakeLockRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const storyIdRef = useRef<string>(story.id);

  // Sync ref for the decoding effect
  useEffect(() => {
    storyIdRef.current = story.id;
  }, [story.id]);

  // Initialize or get the AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  }, []);

  // Screen Wake Lock Logic
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err: any) {
        console.warn(`Wake Lock Error: ${err.message}`);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const cleanupSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null; 
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch (e) {}
      gainNodeRef.current = null;
    }
    releaseWakeLock();
  }, []);

  // Decode audio data whenever story.audioBase64 becomes available
  useEffect(() => {
    let isCancelled = false;
    if (story.audioBase64) {
      setIsDecoding(true);
      const ctx = getAudioContext();
      const bytes = base64ToUint8Array(story.audioBase64);
      decodeAudioData(bytes, ctx).then(buffer => {
        if (!isCancelled && storyIdRef.current === story.id) {
          setAudioBuffer(buffer);
          setIsDecoding(false);
        }
      }).catch(err => {
        if (!isCancelled) {
          console.error("Decoding error", err);
          setIsDecoding(false);
        }
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [story.audioBase64, story.id, getAudioContext]);

  const stopAudio = useCallback(() => {
    cleanupSource();
    pausedAtRef.current = 0;
    setIsPlaying(false);
  }, [cleanupSource]);

  const playAudio = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    
    if (!audioBuffer || storyIdRef.current !== story.id) return;
    
    cleanupSource();
    await requestWakeLock();

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = audioBuffer;
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.1);
    
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    const offset = pausedAtRef.current;
    source.start(0, offset);
    startTimeRef.current = ctx.currentTime - offset;
    
    sourceNodeRef.current = source;
    gainNodeRef.current = gainNode;
    setIsPlaying(true);

    source.onended = () => {
      if (sourceNodeRef.current === source) {
        const playedDuration = ctx.currentTime - startTimeRef.current;
        if (playedDuration >= audioBuffer.duration - 0.2) {
          setIsPlaying(false);
          pausedAtRef.current = 0;
          releaseWakeLock();
          if (onStoryEnd) onStoryEnd();
        }
      }
    };
  }, [audioBuffer, story.id, getAudioContext, cleanupSource, onStoryEnd]);

  const pauseAudio = useCallback(() => {
    const ctx = getAudioContext();
    if (!isPlaying || !sourceNodeRef.current || !gainNodeRef.current) return;
    
    const now = ctx.currentTime;
    gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
    gainNodeRef.current.gain.linearRampToValueAtTime(0, now + 0.1);
    pausedAtRef.current = now - startTimeRef.current;
    
    setTimeout(() => {
      if (sourceNodeRef.current) {
        cleanupSource();
        setIsPlaying(false);
      }
    }, 100);
  }, [isPlaying, getAudioContext, cleanupSource]);

  const skipForward = useCallback(() => {
    if (!audioBuffer) return;
    const ctx = getAudioContext();
    const wasPlaying = isPlaying;
    const currentPos = wasPlaying ? ctx.currentTime - startTimeRef.current : pausedAtRef.current;
    cleanupSource();
    pausedAtRef.current = Math.min(currentPos + 10, audioBuffer.duration);
    if (wasPlaying) playAudio(); else setIsPlaying(false);
  }, [audioBuffer, getAudioContext, isPlaying, cleanupSource, playAudio]);

  const skipBackward = useCallback(() => {
    if (!audioBuffer) return;
    const ctx = getAudioContext();
    const wasPlaying = isPlaying;
    const currentPos = wasPlaying ? ctx.currentTime - startTimeRef.current : pausedAtRef.current;
    cleanupSource();
    pausedAtRef.current = Math.max(currentPos - 10, 0);
    if (wasPlaying) playAudio(); else setIsPlaying(false);
  }, [audioBuffer, getAudioContext, isPlaying, cleanupSource, playAudio]);

  // Initial cleanup on unmount
  useEffect(() => {
    return () => cleanupSource();
  }, [cleanupSource]);

  // Handle story changes
  useEffect(() => {
    cleanupSource();
    setAudioBuffer(null);
    pausedAtRef.current = 0;
    setIsPlaying(false);
    
    // Auto-play logic if the new story already has audio ready
    if (story.audioBase64) {
      const timer = setTimeout(() => {
        if (storyIdRef.current === story.id) {
          // Playback will be triggered by the audioBuffer effect once it's set
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [story.id, cleanupSource]);

  // Auto-play when audio buffer becomes available for the current story
  useEffect(() => {
    if (audioBuffer && storyIdRef.current === story.id && !isPlaying && pausedAtRef.current === 0) {
       playAudio();
    }
  }, [audioBuffer, story.id, playAudio]);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-8 animate-fadeIn">
      <div className="relative aspect-[4/3] rounded-[2.5rem] overflow-hidden shadow-2xl bg-slate-100 ring-8 ring-white">
        {story.imageUrl ? (
          <img src={`data:image/png;base64,${story.imageUrl}`} alt={story.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-3 bg-slate-50">
            <div className="w-10 h-10 border-4 border-amber-300 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold text-sm">正在绘制精美插画...</p>
          </div>
        )}
      </div>

      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{story.title}</h1>
        <div className="inline-block px-4 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-black uppercase tracking-widest">
          {story.theme}
        </div>
        <div className="text-left bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 leading-relaxed text-slate-700 whitespace-pre-wrap text-xl font-medium">
          {story.content}
        </div>
      </div>

      <div className="sticky bottom-8 bg-white/90 backdrop-blur-2xl border border-white p-6 rounded-[3rem] shadow-2xl flex flex-col items-center">
        {!audioBuffer ? (
          <div className="flex items-center space-x-3 py-4 text-slate-400 font-bold">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div>
            <span>{isDecoding ? "正在准备爸爸的声音..." : "声音加载中..."}</span>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between px-4">
            <button onClick={skipBackward} className="p-4 text-slate-400 hover:text-slate-900 transition-all active:scale-90" aria-label="Rewind">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"/></svg>
            </button>
            <div className="flex items-center space-x-6">
              <button onClick={stopAudio} className="p-3 text-slate-300 hover:text-red-400" aria-label="Stop">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              </button>
              {isPlaying ? (
                <button onClick={pauseAudio} className="w-24 h-24 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all" aria-label="Pause">
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
              ) : (
                <button onClick={playAudio} className="w-24 h-24 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all" aria-label="Play">
                  <svg className="w-12 h-12 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
              )}
              <div className="w-14" />
            </div>
            <button onClick={skipForward} className="p-4 text-slate-400 hover:text-slate-900 transition-all active:scale-90" aria-label="Forward">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryPlayer;
