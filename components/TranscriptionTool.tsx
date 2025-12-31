
import React, { useState, useRef, useEffect } from 'react';
import { GeminiService, encodeBase64 } from '../services/gemini';

const TranscriptionTool: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const gemini = new GeminiService();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleTranscribe(blob);
        // Stop stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      // Use FileReader to convert Blob to Base64 (ignoring the WebM header for simplicity since Gemini 3 handles many formats, 
      // but the prompt specified PCM for transcription in some contexts - here we use standard blob conversion)
      const reader = new FileReader();
      reader.readAsArrayBuffer(blob);
      reader.onloadend = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        const base64 = encodeBase64(bytes);
        const text = await gemini.transcribeAudio(base64);
        setTranscription(prev => prev + (prev ? '\n' : '') + text);
        setIsTranscribing(false);
      };
    } catch (err) {
      console.error("Transcription failed", err);
      setIsTranscribing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">给宝贝的留言板</h3>
        <button 
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`px-6 py-2 rounded-full font-bold transition-all flex items-center space-x-2 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/></svg>
          <span>{isRecording ? '正在录音...' : '按住说话'}</span>
        </button>
      </div>

      <div className="bg-slate-50 min-h-[100px] rounded-2xl p-4 text-slate-600 text-sm italic">
        {isTranscribing ? (
          <div className="flex items-center space-x-2 text-amber-500">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span>正在转换文字...</span>
          </div>
        ) : (
          transcription || "点击右侧按钮，记录下宝贝想说的话或者想听的故事主题..."
        )}
      </div>
      
      {transcription && (
        <button onClick={() => setTranscription('')} className="text-xs text-red-400 font-bold hover:underline">清空记录</button>
      )}
    </div>
  );
};

export default TranscriptionTool;
