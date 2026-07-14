import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { trackEvent } from '../lib/analytics';
import { Link } from 'react-router-dom';
import { 
  Mic, 
  MicOff, 
  Bot, 
  Plus, 
  X, 
  Loader2, 
  AlertCircle, 
  CornerDownLeft,
  Settings,
  HelpCircle,
  CheckSquare,
  CreditCard,
} from 'lucide-react';
import { VoiceAgentFailureAlert } from './VoiceAgentFailureAlert';
import { useCaptureStore } from '../store/captureStore';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace';
import { ToggleSwitch } from './ui/toggle-switch';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system' | 'event';
  type: 'text' | 'tool_call' | 'tool_response' | 'error';
  content: string;
  timestamp: Date;
  status?: 'success' | 'error';
  toolName?: string;
  toolCallId?: string;
  entityType?: string;
  entityPublicId?: string;
  summary?: string;
}

type RealtimeAgentMessage = {
  type: 'transcript' | 'tool_call' | 'tool_response' | 'error' | 'interrupted'
    | 'session_resumption' | 'session_state';
  content?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  status?: 'success' | 'error';
  result?: {
    message?: string;
    entity_type?: string;
    entity_public_id?: string;
    summary?: string;
  };
  message?: string;
  // spec-079 Stage B: transport resilience
  handle?: string;
  state?: 'closing';
  time_left?: string;
};

// spec-079 Stage B: cap auto-reconnect so a persistently-down backend doesn't
// loop forever; the user can still retry manually.
const MAX_RECONNECT_ATTEMPTS = 5;

const CONFIRMATION_CARD_REGISTRY: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; getRoute: (id?: string) => string }
> = {
  todo: {
    icon: CheckSquare,
    label: 'Todo',
    getRoute: (id) => id ? `/todo?id=${id}` : '/todo',
  },
  recurring_todo: {
    icon: CheckSquare,
    label: 'Recurring Todo',
    getRoute: () => '/todo?tab=recurring',
  },
  transaction: {
    icon: CreditCard,
    label: 'Spending',
    getRoute: () => '/spending?tab=transactions',
  },
};

export const VoiceAgentWidget: React.FC = () => {
  const queryClient = useQueryClient();
  const isOpen = useCaptureStore((state) => state.isOpen);
  const setIsOpen = useCaptureStore((state) => state.setIsOpen);
  const { activeWorkspaceId } = useActiveWorkspace(true);

  const launcherSize = 56;
  const viewportMargin = 24;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const isMobileViewport = viewportWidth < 640;
  const panelWidth = isMobileViewport ? Math.max(320, viewportWidth - viewportMargin * 2) : 384;
  const panelHeight = isMobileViewport ? Math.min(560, Math.max(420, viewportHeight * 0.72)) : 600;
  const launcherStorageKey = 'voice-agent-launcher-pos-v1';

  const clampLauncherPos = (position: { x: number; y: number }) => {
    if (typeof window === 'undefined') return position;
    return {
      x: Math.min(
        Math.max(viewportMargin, position.x),
        window.innerWidth - launcherSize - viewportMargin
      ),
      y: Math.min(
        Math.max(viewportMargin, position.y),
        window.innerHeight - launcherSize - viewportMargin
      ),
    };
  };

  const getDefaultLauncherPos = () =>
    clampLauncherPos({
      x: typeof window === 'undefined' ? viewportMargin : window.innerWidth - launcherSize - viewportMargin,
      y: typeof window === 'undefined' ? viewportMargin : window.innerHeight - launcherSize - viewportMargin,
    });

  const snapLauncherPos = (position: { x: number; y: number }) => {
    if (typeof window === 'undefined') return position;
    const clamped = clampLauncherPos(position);

    const left = clamped.x - viewportMargin;
    const right = window.innerWidth - launcherSize - viewportMargin - clamped.x;
    const top = clamped.y - viewportMargin;
    const bottom = window.innerHeight - launcherSize - viewportMargin - clamped.y;

    const nearest = Math.min(left, right, top, bottom);
    if (nearest === left) return { x: viewportMargin, y: clamped.y };
    if (nearest === right) return { x: window.innerWidth - launcherSize - viewportMargin, y: clamped.y };
    if (nearest === top) return { x: clamped.x, y: viewportMargin };
    return { x: clamped.x, y: window.innerHeight - launcherSize - viewportMargin };
  };
  
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [inputText, setInputText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showLauncher, setShowLauncher] = useState(true);

  const [launcherPos, setLauncherPos] = useState<{ x: number; y: number }>(() => {
    const defaultPos = getDefaultLauncherPos();
    if (typeof window === 'undefined') return defaultPos;
    try {
      const saved = window.localStorage.getItem(launcherStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { x?: number; y?: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return clampLauncherPos({ x: parsed.x, y: parsed.y });
        }
      }
    } catch {
      // Ignore
    }
    return defaultPos;
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const pendingSendRef = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // spec-079 Stage B: transport resilience. The latest Gemini session-resumption
  // handle is round-tripped back on reconnect so the conversation context
  // survives a dropped socket; the other refs drive backoff and distinguish a
  // user-initiated close from an unexpected drop (only the latter reconnects).
  const resumptionHandleRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);

  // Sync preference
  useEffect(() => {
    const key = `lifestack:show-capture-launcher:${activeWorkspaceId}`;
    setShowLauncher(window.localStorage.getItem(key) !== 'false');
  }, [activeWorkspaceId]);

  // Listen to custom settings update event to update trigger button visibility instantly
  useEffect(() => {
    const handlePrefChange = () => {
      const key = `lifestack:show-capture-launcher:${activeWorkspaceId}`;
      setShowLauncher(window.localStorage.getItem(key) !== 'false');
    };
    window.addEventListener('lifestack:show-capture-launcher-change', handlePrefChange);
    window.addEventListener('storage', handlePrefChange);
    return () => {
      window.removeEventListener('lifestack:show-capture-launcher-change', handlePrefChange);
      window.removeEventListener('storage', handlePrefChange);
    };
  }, [activeWorkspaceId]);

  // Global keyboard shortcut Ctrl/Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Focus the input when panel is opened
  useEffect(() => {
    if (isOpen) {
      setShowSettings(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Auto-scroll transcript to the bottom on new messages
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, showSettings]);

  useEffect(() => {
    const handleResize = () => {
      setLauncherPos((prev) => clampLauncherPos(prev));
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
    setLauncherPos(clampLauncherPos({ x: nextX, y: nextY }));
  };

  const endDrag = () => {
    const snappedPos = snapLauncherPos(launcherPos);
    setLauncherPos(snappedPos);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(launcherStorageKey, JSON.stringify(snappedPos));
      } catch (e) {
        console.warn('Failed to save voice agent position to localStorage:', e);
      }
    }
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

      const toolCallId = `tool-${Date.now()}-${Math.random()}`;
      setMessages(prev => [...prev, {
        id: toolCallId,
        role: 'event',
        type: 'tool_call',
        content: `working…`,
        timestamp: new Date(),
        toolName: msg.name,
        toolCallId,
      }]);
    } 
    
    else if (msg.type === 'tool_response') {
      const isSuccess = msg.status === 'success';
      const entityType = msg.result?.entity_type;
      const entityPublicId = msg.result?.entity_public_id;
      const summary = msg.result?.summary;

      setMessages(prev => {
        let matchedIndex = -1;
        for (let index = prev.length - 1; index >= 0; index -= 1) {
          if (prev[index].type === 'tool_call' && prev[index].toolName === msg.name) {
            matchedIndex = index;
            break;
          }
        }
        const next = matchedIndex < 0
          ? prev
          : prev.filter((_, index) => index !== matchedIndex);

        if (!isSuccess || entityType) {
          return [...next, {
            id: Math.random().toString(),
            role: 'event',
            type: 'tool_response',
            content: isSuccess
              ? (summary || 'Saved — view in app')
              : `Error: ${msg.result?.message || 'Unknown error'}`,
            timestamp: new Date(),
            status: msg.status,
            toolName: msg.name,
            entityType,
            entityPublicId,
            summary,
          }];
        }
        return next;
      });

      if (isSuccess) {
        // Automatically refresh all relevant dashboards/lists
        void queryClient.invalidateQueries({ queryKey: queryKeys.todo.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.spending.transactions() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.spending.summary() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.spending.budgets() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.investing.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      }
    } 
    
    else if (msg.type === 'interrupted') {
      clearAudioQueue();
    }

    else if (msg.type === 'session_resumption') {
      // Store the latest handle so an unexpected drop can resume with context.
      resumptionHandleRef.current = msg.handle ?? null;
    }

    else if (msg.type === 'session_state') {
      // Gemini warned it is about to close this session (goAway). Surface it;
      // the impending close event drives the actual reconnect.
      if (msg.state === 'closing') {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          role: 'system',
          type: 'text',
          content: 'Renewing the live session…',
          timestamp: new Date()
        }]);
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

  // spec-079 Stage B: reconnect after an unexpected drop with exponential
  // backoff, carrying the resumption handle so context is preserved.
  const scheduleReconnect = () => {
    if (reconnectTimerRef.current !== null) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus('error');
      setConnectionError('Reconnection failed after several attempts. Tap retry to start over.');
      return;
    }
    const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 8000);
    reconnectAttemptsRef.current += 1;
    setConnectionStatus('connecting');
    setConnectionError(`Connection lost — reconnecting (attempt ${reconnectAttemptsRef.current})…`);
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      connectWebSocket();
    }, delay);
  };

  const connectWebSocket = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    // A fresh connect attempt is not an intentional teardown; allow reconnects.
    intentionalCloseRef.current = false;
    setConnectionStatus('connecting');
    setConnectionError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const wsUrl = new URL(getWebSocketUrl());
      wsUrl.searchParams.set('timezone', timezone);
      // Resume the prior conversation context when reconnecting after a drop.
      if (resumptionHandleRef.current) {
        wsUrl.searchParams.set('resume', resumptionHandleRef.current);
      }
      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        const wasReconnect = reconnectAttemptsRef.current > 0;
        if (!wasReconnect) {
          trackEvent('capture_session_started');
        }
        setConnectionStatus('connected');
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          role: 'system',
          type: 'text',
          content: wasReconnect
            ? 'Reconnected — continuing your session.'
            : 'Connected. Tap the microphone to talk or type a message.',
          timestamp: new Date()
        }]);

        // Flush any pending text sends
        while (pendingSendRef.current.length > 0) {
          const msg = pendingSendRef.current.shift();
          if (msg) {
            ws.send(JSON.stringify({ type: 'text', content: msg }));
          }
        }
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          playAudioChunk(event.data);
        } else {
          try {
            const msg = JSON.parse(event.data);
            handleServerMessage(msg);
          } catch (err) {
            console.error('Failed parsing server message:', err instanceof Error ? err.message : 'Unknown error');
            setConnectionError('Capture received an unreadable response. Retry the session.');
          }
        }
      };

      ws.onerror = (err) => {
        console.error('WS Error:', err instanceof Error ? err.message : 'Unknown error');
        setConnectionStatus('error');
        setConnectionError('Capture could not connect to the live session.');
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        stopRecording();
        // Auto-reconnect on an unexpected drop (spec-079 Stage B). A clean close
        // (1000) or a user-initiated teardown is left alone; a policy-violation
        // close (4003) means the server rejected the session, so retrying the
        // same way would just loop.
        const isUnexpected =
          !intentionalCloseRef.current && event.code !== 1000 && event.code !== 4003;
        if (isUnexpected) {
          scheduleReconnect();
          return;
        }
        setConnectionStatus('disconnected');
        if (event.code !== 1000 && !intentionalCloseRef.current) {
          setConnectionError(`Capture disconnected unexpectedly (${event.code}).`);
        }
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          role: 'system',
          type: 'text',
          content: `Session closed (${event.code}).`,
          timestamp: new Date()
        }]);
      };
    } catch (err) {
      console.error('Failed to establish WebSocket connection:', err instanceof Error ? err.message : 'Unknown error');
      setConnectionStatus('error');
      setConnectionError('Capture could not start a live session.');
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
            console.error('Failed to send audio chunk:', e instanceof Error ? e.message : 'Unknown error');
          }
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

    } catch (err) {
      console.error('Mic access failed:', err instanceof Error ? err.message : 'Unknown error');
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
    clearAudioQueue();
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
    const textVal = inputText.trim();
    if (!textVal) return;
    initAudioContext();

    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      role: 'user',
      type: 'text',
      content: textVal,
      timestamp: new Date()
    }]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'text',
        content: textVal
      }));
    } else {
      pendingSendRef.current.push(textVal);
      connectWebSocket();
    }

    setInputText('');
    clearAudioQueue();
  };

  // spec-079 Stage B: intentional teardown — suppress auto-reconnect and cancel
  // any pending backoff timer.
  const teardownConnection = () => {
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const toggleOpen = () => {
    if (!isOpen) {
      setIsOpen(true);
      initAudioContext();
    } else {
      setIsOpen(false);
      stopRecording();
      clearAudioQueue();
      teardownConnection();
    }
  };

  const retryConnection = () => {
    stopRecording();
    clearAudioQueue();
    teardownConnection();
    // Manual retry starts a fresh session — drop any stale resumption handle.
    resumptionHandleRef.current = null;
    connectWebSocket();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      clearAudioQueue();
      teardownConnection();
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Persistent Floating Mic Button */}
      {showLauncher && (
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
          title="Capture"
          aria-label={isOpen ? 'Close capture panel' : 'Open capture panel'}
          disabled={isStarting}
        >
          {isRecording ? (
            <div className="relative flex h-full w-full items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/20 opacity-75"></span>
              <Mic className="h-6 w-6 text-rose-500 animate-pulse" />
            </div>
          ) : (
            <div className="relative flex h-6 w-6 items-center justify-center">
              <Mic className="h-5 w-5 text-cyan-400" />
              <Plus className="absolute -bottom-1 -right-1 h-3 w-3 text-cyan-300" />
            </div>
          )}
        </button>
      )}

      {/* Floating Copilot Drawer Panel */}
      <div
        className={`fixed z-50 flex flex-col rounded-2xl border border-slate-800 bg-slate-950/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-in-out ${
          isMobileViewport ? 'origin-bottom' : 'origin-bottom-right'
        } ${
          isOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'
        }`}
        style={
          isMobileViewport
            ? {
                left: viewportMargin,
                width: panelWidth,
                height: panelHeight,
                top: Math.max(viewportMargin, viewportHeight - panelHeight - launcherSize - viewportMargin),
              }
            : {
                left: Math.min(
                  Math.max(viewportMargin, launcherPos.x + launcherSize - panelWidth),
                  viewportWidth - panelWidth - viewportMargin
                ),
                top: Math.min(
                  Math.max(viewportMargin, launcherPos.y - panelHeight - 10),
                  viewportHeight - panelHeight - viewportMargin
                ),
                width: panelWidth,
                height: panelHeight,
              }
        }
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-cyan-400" />
            <h2 className="font-semibold text-white tracking-tight">Capture</h2>
            <div className="flex items-center gap-1.5 ml-2">
              <span className={`h-2 w-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
                connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
                'bg-slate-600'
              }`}></span>
              <span className="text-[10px] text-slate-400 capitalize">{connectionStatus}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors"
              aria-label="Capture settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={toggleOpen}
              className="rounded p-1 text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors"
              aria-label="Close capture panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {connectionError ? (
          <VoiceAgentFailureAlert
             message={connectionError}
             onRetry={retryConnection}
             onDismiss={() => setConnectionError(null)}
          />
        ) : null}

        {showSettings ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Capture Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Back to capture
              </button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <ToggleSwitch
                testId="panel-capture-launcher-toggle"
                checked={showLauncher}
                onChange={(checked) => {
                  setShowLauncher(checked);
                  if (activeWorkspaceId) {
                    window.localStorage.setItem(`lifestack:show-capture-launcher:${activeWorkspaceId}`, String(checked));
                    window.dispatchEvent(new Event('lifestack:show-capture-launcher-change'));
                  }
                }}
                label={
                  <div className="flex flex-col text-left">
                    <span className="font-medium text-slate-200">Floating Launcher</span>
                    <span className="text-[11px] text-slate-400 leading-tight">Show floating capture launcher button on screen</span>
                  </div>
                }
              />
            </div>
          </div>
        ) : (
          <>
            {/* Scrollable Message Transcripts */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
                  <Bot className="h-12 w-12 text-slate-700 animate-bounce" />
                  <p className="text-sm font-medium">Hello! I am your personal capture assistant.</p>
                  <p className="text-xs text-slate-600 max-w-[240px]">
                    You can ask me to:
                    <br />• "Add a task to buy groceries"
                    <br />• "Spent 15 dollars on food from my wallet"
                    <br />• "How is my portfolio doing?"
                  </p>
                </div>
              )}

              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-tr-none bg-cyan-600/80 border border-cyan-500/30 px-3.5 py-2 text-sm text-white shadow-sm">
                        <p className="leading-relaxed text-left">{msg.content}</p>
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
                        <p className="leading-relaxed text-left">{msg.content}</p>
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'event') {
                  const isSuccess = msg.status === 'success';
                  
                  if (msg.type === 'tool_call') {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-900/20 px-2.5 py-1 rounded-lg">
                          <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                          <span>working…</span>
                        </div>
                      </div>
                    );
                  }
                  
                  if (msg.type === 'tool_response') {
                    if (isSuccess) {
                      const registryEntry = CONFIRMATION_CARD_REGISTRY[msg.entityType || ''] || {
                        icon: HelpCircle,
                        label: 'Item',
                        getRoute: () => '/dashboard',
                      };
                      const Icon = registryEntry.icon;
                      const cardText = msg.summary || 'Saved — view in app';
                      return (
                        <div key={msg.id} className="flex justify-center my-2 w-full">
                          <div className="w-[90%] rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-md flex items-center justify-between" data-testid="confirmation-card">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400 shrink-0">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex flex-col text-left min-w-0">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{registryEntry.label}</span>
                                <span className="text-xs text-slate-200 font-medium truncate">{cardText}</span>
                              </div>
                            </div>
                            <Link
                              to={registryEntry.getRoute(msg.entityPublicId)}
                              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors shrink-0 ml-2"
                            >
                              View →
                            </Link>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={msg.id} className="flex justify-center my-2 w-full">
                          <div className="w-[90%] rounded-xl border border-rose-500/20 bg-rose-950/30 p-3 text-xs text-rose-400 font-medium flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                            <span className="text-left">{msg.content}</span>
                          </div>
                        </div>
                      );
                    }
                  }
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
                  disabled={isStarting}
                  aria-label={isRecording ? 'Stop listening' : 'Start listening'}
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
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      connectWebSocket();
                    }}
                    onFocus={() => {
                      connectWebSocket();
                    }}
                    placeholder="Type a message to capture..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={!inputText.trim()}
                    className="absolute right-2 top-1.5 rounded-lg bg-slate-900 border border-slate-800 p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </>
  );
};
