import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';

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
      <VoiceAgentWidget />
    </QueryClientProvider>,
  );
};

const openPanelAndGetSocket = (): FakeWebSocket => {
  fireEvent.click(screen.getByRole('button', { name: 'Open voice copilot' }));
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

describe('VoiceAgentWidget interruption handling (spec-059)', () => {
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
});
