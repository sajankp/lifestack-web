import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Mic, 
  MicOff, 
  Bot, 
  Sparkles, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  CornerDownLeft
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system' | 'event';
  type: 'text' | 'tool_call' | 'tool_response' | 'error';
  content: string;
  timestamp: Date;
  status?: 'success' | 'error';
  toolName?: string;
}

type RealtimeAgentMessage = {
  type: 'transcript' | 'tool_call' | 'tool_response' | 'error';
  content?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  status?: 'success' | 'error';
  result?: { message?: string };
  message?: string;
};

export const VoiceAgentWidget: React.FC = () => {
  const queryClient = useQueryClient();
  const launcherSize = 56;
  const viewportMargin = 24;
  const panelWidth = 384;
  const panelHeight = 600;
  
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [inputText, setInputText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [launcherPos, setLauncherPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(viewportMargin, window.innerWidth - launcherSize - viewportMargin),
    y: Math.max(viewportMargin, window.innerHeight - launcherSize - viewportMargin),
  }));
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Auto-scroll transcript to the bottom on new messages
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const handleResize = () => {
      setLauncherPos((prev) => ({
        x: Math.min(Math.max(viewportMargin, prev.x), window.innerWidth - launcherSize - viewportMargin),
        y: Math.min(Math.max(viewportMargin, prev.y), window.innerHeight - launcherSize - viewportMargin),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    isDraggingRef.current = false;
    dragOffsetRef.current = {
      x: event.clientX - launcherPos.x,
      y: event.clientY - launcherPos.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragOffsetRef.current) return;
    isDraggingRef.current = true;
    const nextX = event.clientX - dragOffsetRef.current.x;
    const nextY = event.clientY - dragOffsetRef.current.y;
    setLauncherPos({
      x: Math.min(Math.max(viewportMargin, nextX), window.innerWidth - launcherSize - viewportMargin),
      y: Math.min(Math.max(viewportMargin, nextY), window.innerHeight - launcherSize - viewportMargin),
    });
  };

  const endDrag = () => {
    dragOffsetRef.current = null;
    window.setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
  };

  // Construct WebSocket URL dynamically
  const getWebSocketUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/v1';
    const absoluteUrl = apiUrl.startsWith('/') ? `${window.location.origin}${apiUrl}` : apiUrl;
    return absoluteUrl.replace(/^http/, 'ws') + '/capture/agent/ws';
  };

  // Safe AudioContext initializer
  const initAudioContext = () => {
    const AudioContextCtor = window.AudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContextCtor({
        sampleRate: 24000
      });
      nextPlayTimeRef.current = 0;
    } else if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
  };

  // Clear current audio queue (for barge-in/interruption)
  const clearAudioQueue = () => {
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch {
        // Ignore if source is already stopped.
      }
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
  };

  // Queue and play 24kHz raw mono PCM chunk
  const playAudioChunk = (pcmData: ArrayBuffer) => {
    if (!audioCtxRef.current) return;

    const int16Array = new Int16Array(pcmData, 0, Math.floor(pcmData.byteLength / 2));
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = audioCtxRef.current.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtxRef.current.destination);

    const now = audioCtxRef.current.currentTime;
    if (nextPlayTimeRef.current < now) {
      nextPlayTimeRef.current = now;
    }
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;

    // Track active sources to support barge-in
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
    };
  };

  // Parse server messages
  const handleServerMessage = (msg: RealtimeAgentMessage) => {
    if (msg.type === 'transcript') {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'agent' && lastMsg.type === 'text') {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...lastMsg,
            content: lastMsg.content + (msg.content ?? '')
          };
          return updated;
        } else {
          return [...prev, {
            id: Math.random().toString(),
            role: 'agent',
            type: 'text',
            content: msg.content ?? '',
            timestamp: new Date()
          }];
        }
      });
    } 
    
    else if (msg.type === 'tool_call') {
      // Barge-in: interrupt current voice playback
      clearAudioQueue();

      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'event',
        type: 'tool_call',
        content: `Voice agent is running ${msg.name}...`,
        timestamp: new Date(),
        toolName: msg.name
      }]);
    } 
    
    else if (msg.type === 'tool_response') {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'event',
        type: 'tool_response',
        content: msg.status === 'success' 
          ? `Executed ${msg.name} successfully.` 
          : `Error executing ${msg.name}: ${msg.result?.message || 'Unknown error'}`,
        timestamp: new Date(),
        status: msg.status,
        toolName: msg.name
      }]);

      if (msg.status === 'success') {
        // Automatically refresh all relevant dashboards/lists
        void queryClient.invalidateQueries({ queryKey: ['todos'] });
        void queryClient.invalidateQueries({ queryKey: ['transactions'] });
        void queryClient.invalidateQueries({ queryKey: ['transactions-summary'] });
        void queryClient.invalidateQueries({ queryKey: ['budgets'] });
        void queryClient.invalidateQueries({ queryKey: ['investing'] });
        void queryClient.invalidateQueries({ queryKey: ['finance'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    } 
    
    else if (msg.type === 'error') {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'system',
        type: 'error',
        content: msg.message ?? 'Unknown error',
        timestamp: new Date()
      }]);
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    setConnectionStatus('connecting');
    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setConnectionStatus('connected');
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          role: 'system',
          type: 'text',
          content: 'Connected. Tap the microphone to talk.',
          timestamp: new Date()
        }]);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          playAudioChunk(event.data);
        } else {
          try {
            const msg = JSON.parse(event.data);
            handleServerMessage(msg);
          } catch (err) {
            console.error('Failed parsing server message:', err);
          }
        }
      };

      ws.onerror = (err) => {
        console.error('WS Error:', err);
        setConnectionStatus('error');
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          role: 'system',
          type: 'text',
          content: `Session closed (${event.code}).`,
          timestamp: new Date()
        }]);
        stopRecording();
      };
    } catch (err) {
      console.error('Failed to establish WebSocket connection:', err);
      setConnectionStatus('error');
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'system',
        type: 'error',
        content: 'Failed to connect: ' + (err as Error).message,
        timestamp: new Date()
      }]);
    }
  };

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    setIsStarting(true);
    try {
      initAudioContext();
      clearAudioQueue();

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }

      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            const buffer = await event.data.arrayBuffer();
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(buffer);
            }
          } catch (e) {
            console.error('Failed to send audio chunk:', e);
          }
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

    } catch (err) {
      console.error('Mic access failed:', err);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'system',
        type: 'error',
        content: 'Could not access mic: ' + (err as Error).message,
        timestamp: new Date()
      }]);
    } finally {
      setIsStarting(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isStarting) return;
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    initAudioContext();

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }

    const textVal = inputText.trim();
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      role: 'user',
      type: 'text',
      content: textVal,
      timestamp: new Date()
    }]);

    // Send control message to backend
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'text',
        content: textVal
      }));
    }

    setInputText('');
    clearAudioQueue();
  };

  const toggleOpen = () => {
    if (!isOpen) {
      setIsOpen(true);
      initAudioContext();
      connectWebSocket();
    } else {
      setIsOpen(false);
      stopRecording();
      clearAudioQueue();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      clearAudioQueue();
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {/* Persistent Floating Mic Button */}
      <button
        onClick={() => {
          if (!isDraggingRef.current) {
            toggleOpen();
          }
        }}
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`fixed z-50 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-slate-900 border transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(30,41,59,0.5)] ${
          isRecording 
            ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]' 
            : 'border-slate-800 hover:border-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]'
        }`}
        style={{ left: launcherPos.x, top: launcherPos.y }}
        id="voice-agent-trigger"
        title="Voice Copilot"
        disabled={isStarting}
      >
        {isRecording ? (
          <div className="relative flex h-full w-full items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/20 opacity-75"></span>
            <Mic className="h-6 w-6 text-rose-500 animate-pulse" />
          </div>
        ) : (
          <Sparkles className="h-6 w-6 text-cyan-400" />
        )}
      </button>

      {/* Floating Copilot Drawer Panel */}
      <div
        className={`fixed z-50 flex h-[600px] w-96 flex-col rounded-2xl border border-slate-800 bg-slate-950/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-in-out origin-bottom-right ${
          isOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'
        }`}
        style={{
          left: Math.min(
            Math.max(viewportMargin, launcherPos.x + launcherSize - panelWidth),
            window.innerWidth - panelWidth - viewportMargin
          ),
          top: Math.min(
            Math.max(viewportMargin, launcherPos.y - panelHeight - 10),
            window.innerHeight - panelHeight - viewportMargin
          ),
        }}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-cyan-400" />
            <h2 className="font-semibold text-white tracking-tight">Voice Copilot</h2>
            <div className="flex items-center gap-1.5 ml-2">
              <span className={`h-2 w-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
                connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
                'bg-slate-600'
              }`}></span>
              <span className="text-[10px] text-slate-400 capitalize">{connectionStatus}</span>
            </div>
          </div>
          <button
            onClick={toggleOpen}
            className="rounded p-1 text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Message Transcripts */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <Bot className="h-12 w-12 text-slate-700 animate-bounce" />
              <p className="text-sm font-medium">Hello! I am your personal OS voice copilot.</p>
              <p className="text-xs text-slate-600 max-w-[240px]">
                You can ask me to:
                <br />• "Add a task to buy groceries"
                <br />• "Spent 15 dollars on food"
                <br />• "Log 1200 dollars brokerage balance"
              </p>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-none bg-blue-600/80 border border-blue-500/30 px-3.5 py-2 text-sm text-white shadow-sm">
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              );
            }

            if (msg.role === 'agent') {
              return (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-950 border border-cyan-800">
                    <Bot className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="max-w-[80%] rounded-2xl rounded-tl-none bg-slate-900 border border-slate-800/60 px-3.5 py-2 text-sm text-slate-200">
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              );
            }

            if (msg.role === 'event') {
              const isSuccess = msg.status === 'success';
              const isError = msg.status === 'error';
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className={`max-w-[90%] flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-sm bg-slate-900/60 ${
                    isSuccess ? 'border-emerald-500/20 text-emerald-400' :
                    isError ? 'border-rose-500/20 text-rose-400' :
                    'border-slate-800 text-slate-400'
                  }`}>
                    {msg.type === 'tool_call' ? (
                      <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                    )}
                    <span className="break-words font-medium">{msg.content}</span>
                  </div>
                </div>
              );
            }

            // System notifications
            return (
              <div key={msg.id} className="flex justify-center">
                <div className={`rounded-lg px-2.5 py-1 text-[11px] font-medium bg-slate-900/40 border ${
                  msg.type === 'error' ? 'border-rose-500/10 text-rose-400/80' : 'border-slate-800/40 text-slate-500'
                }`}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={transcriptEndRef} />
        </div>

        {/* CSS-based Voice Activity Waveform */}
        {isRecording && (
          <div className="flex items-center justify-center gap-1 py-2 border-t border-slate-900 bg-slate-950/50">
            <span className="text-[10px] text-slate-400 mr-2 uppercase tracking-wider animate-pulse">Listening</span>
            <div className="flex items-end gap-0.5 h-4">
              <span className="w-0.5 bg-cyan-400 rounded-full animate-[pulse_0.6s_infinite_alternate]" style={{ height: '30%' }}></span>
              <span className="w-0.5 bg-cyan-400 rounded-full animate-[pulse_0.4s_infinite_alternate_0.1s]" style={{ height: '70%' }}></span>
              <span className="w-0.5 bg-cyan-400 rounded-full animate-[pulse_0.7s_infinite_alternate_0.2s]" style={{ height: '100%' }}></span>
              <span className="w-0.5 bg-cyan-400 rounded-full animate-[pulse_0.5s_infinite_alternate_0.3s]" style={{ height: '50%' }}></span>
              <span className="w-0.5 bg-cyan-400 rounded-full animate-[pulse_0.6s_infinite_alternate_0.4s]" style={{ height: '20%' }}></span>
            </div>
          </div>
        )}

        {/* Panel Footer / Controls */}
        <div className="border-t border-slate-800/80 bg-slate-900/30 p-4 space-y-3.5">
          <div className="flex items-center justify-center">
            {/* Mic Toggle Button */}
            <button
              onClick={toggleRecording}
              disabled={isStarting || connectionStatus !== 'connected'}
              className={`flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 ${
                isRecording 
                  ? 'bg-rose-500/10 border-rose-500 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-cyan-500 hover:text-cyan-400'
              }`}
            >
              {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
          </div>

          {/* Text Fallback Input */}
          <form onSubmit={handleSendText} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={connectionStatus === 'connected' ? 'Type a message instead...' : 'Connecting...'}
                disabled={connectionStatus !== 'connected'}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || connectionStatus !== 'connected'}
                className="absolute right-2 top-1.5 rounded-lg bg-slate-900 border border-slate-800 p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
              >
                <CornerDownLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
