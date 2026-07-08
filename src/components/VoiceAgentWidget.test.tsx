import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useCaptureStore } from '../store/captureStore';

import { VoiceAgentWidget } from './VoiceAgentWidget';

// ── Web-audio / realtime mocks ─────────────────────────────────────────────
// The widget schedules decoded PCM ahead of real time on an AudioContext and
// streams mic audio over a WebSocket; none of that exists in jsdom.

class FakeAudioBufferSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

const createdSources: FakeAudioBufferSource[] = [];

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return {
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }
  createBufferSource() {
    const source = new FakeAudioBufferSource();
    createdSources.push(source);
    return source;
  }
}

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = FakeWebSocket.OPEN;
  binaryType = 'blob';
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(url: string) {
    this.url = url;
    sockets.push(this);
  }
}

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  state = 'recording';
  stream: { getTracks: () => Array<{ stop: () => void }> };
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.state = 'inactive';
  });
  constructor(stream: FakeMediaRecorder['stream']) {
    this.stream = stream;
  }
}

const renderWidget = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <VoiceAgentWidget />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const openPanelAndGetSocket = (): FakeWebSocket => {
  // Trigger click to open panel
  fireEvent.click(screen.getByRole('button', { name: 'Open capture panel' }));
  
  // Connection should be lazy; expect no websocket connection on open
  expect(sockets).toHaveLength(0);

  // Focus input to trigger connection
  const input = screen.getByPlaceholderText('Type a message to capture...');
  fireEvent.focus(input);

  expect(sockets).toHaveLength(1);
  const ws = sockets[0];
  act(() => {
    ws.onopen?.();
  });
  return ws;
};

const playServerAudio = (ws: FakeWebSocket) => {
  const pcm = new Int16Array([0, 1000, -1000, 500]);
  act(() => {
    ws.onmessage?.({ data: pcm.buffer });
  });
};

describe('Capture panel verification', () => {
  let originalScrollIntoView: typeof window.HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    createdSources.length = 0;
    sockets.length = 0;
    originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
    // Reset state store
    useCaptureStore.setState({ isOpen: false });
  });

  afterEach(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.unstubAllGlobals();
  });

  it('stops scheduled audio when the server forwards a barge-in interruption', () => {
    renderWidget();
    const ws = openPanelAndGetSocket();

    playServerAudio(ws);
    expect(createdSources).toHaveLength(1);
    expect(createdSources[0].start).toHaveBeenCalled();

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'interrupted' }) });
    });

    expect(createdSources[0].stop).toHaveBeenCalled();
  });

  it('clears the audio queue when the mic is toggled off', async () => {
    renderWidget();
    const ws = openPanelAndGetSocket();

    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    await screen.findByRole('button', { name: 'Stop listening' });

    playServerAudio(ws);
    expect(createdSources).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }));
    await screen.findByRole('button', { name: 'Start listening' });

    expect(createdSources[0].stop).toHaveBeenCalled();
  });

  it('toggles panel open/closed and focuses input on Ctrl+K shortcut', async () => {
    renderWidget();
    expect(useCaptureStore.getState().isOpen).toBe(false);
    
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }));
    });
    expect(useCaptureStore.getState().isOpen).toBe(true);
    
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }));
    });
    expect(useCaptureStore.getState().isOpen).toBe(false);
  });

  it('hides the trigger button if the showLauncher preference is false in localStorage', () => {
    localStorage.setItem('lifestack:show-capture-launcher:null', 'false');
    
    renderWidget();
    expect(screen.queryByRole('button', { name: 'Open capture panel' })).toBeNull();
    
    localStorage.removeItem('lifestack:show-capture-launcher:null');
  });

  it('renders a confirmation card when a mutating tool response succeeds', async () => {
    renderWidget();
    const ws = openPanelAndGetSocket();

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: 'tool_response',
          name: 'create_todo_task',
          status: 'success',
          result: {
            entity_type: 'todo',
            entity_public_id: '123-uuid',
            summary: "Added todo 'Buy milk'",
          },
        }),
      });
    });

    expect(screen.getByText('Todo')).toBeVisible();
    expect(screen.getByText("Added todo 'Buy milk'")).toBeVisible();
    const viewLink = screen.getByRole('link', { name: 'View →' });
    expect(viewLink).toHaveAttribute('href', '/todo?id=123-uuid');
  });

  it('falls back to a generic card when entity_type is unknown', () => {
    renderWidget();
    const ws = openPanelAndGetSocket();

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: 'tool_response',
          name: 'log_some_random_thing',
          status: 'success',
          result: {
            entity_type: 'unknown_type',
            entity_public_id: '456-uuid',
            summary: 'Saved customized thing',
          },
        }),
      });
    });

    expect(screen.getByText('Item')).toBeVisible();
    expect(screen.getByText('Saved customized thing')).toBeVisible();
    const viewLink = screen.getByRole('link', { name: 'View →' });
    expect(viewLink).toHaveAttribute('href', '/dashboard');
  });

  it('renders an error alert when the tool execution fails', () => {
    renderWidget();
    const ws = openPanelAndGetSocket();

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: 'tool_response',
          name: 'create_todo_task',
          status: 'error',
          result: {
            message: 'Insufficient permissions to write todo',
          },
        }),
      });
    });

    expect(screen.getByText('Error: Insufficient permissions to write todo')).toBeVisible();
  });

  it('never leaks the tool name into the transcript when a successful response has no summary', () => {
    renderWidget();
    const ws = openPanelAndGetSocket();

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: 'tool_response',
          name: 'create_todo_task',
          status: 'success',
          result: {
            entity_type: 'todo',
            entity_public_id: '789-uuid',
          },
        }),
      });
    });

    expect(screen.getByText('Saved — view in app')).toBeVisible();
    expect(screen.queryByText(/create_todo_task/)).toBeNull();
  });
});
