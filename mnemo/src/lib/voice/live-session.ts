import type { Session } from '@google/genai';
import { Modality } from '@google/genai';

import { getGenAI } from '../gemini';
import { extractAtoms } from '../agents/listener';
import type { MemoryAtom } from '../memory/types';
import { MODELS } from '../models';
import { handoff } from '../orchestrator';

// MODE 6 — Voice Journal via Gemini Flash Live.
// Real-time streaming: mic PCM chunks in → incremental transcription out →
// Listener extracts atoms per finalized utterance. Interruption-native:
// "wait, that's wrong" mid-stream just becomes newer, higher-priority input.

export interface LiveJournalCallbacks {
  onTranscript: (text: string, finished: boolean) => void;
  onAtoms: (atoms: MemoryAtom[]) => void;
  onError: (msg: string) => void;
  onClose?: () => void;
}

export interface LiveJournal {
  /** Send a 16-bit PCM 16kHz mono base64 chunk from the mic. */
  sendAudioChunk: (base64Pcm: string) => void;
  close: () => void;
}

export async function startLiveJournal(cb: LiveJournalCallbacks): Promise<LiveJournal | null> {
  const ai = await getGenAI();
  if (!ai) {
    cb.onError('No API key set');
    return null;
  }

  let session: Session;
  let utteranceBuffer = '';

  const flushUtterance = async () => {
    const text = utteranceBuffer.trim();
    utteranceBuffer = '';
    if (!text) return;
    cb.onTranscript(text, true);
    // Hand transcription to the Listener — atoms appear in real time as the user speaks.
    handoff('flash-cloud', 'listener', 'live utterance finalized', text.slice(0, 60));
    const { atoms } = await extractAtoms(text, 'voice_input');
    if (atoms.length) cb.onAtoms(atoms);
  };

  try {
    handoff('input', 'antigravity', 'open Flash Live session (voice journal)', MODELS.flashLive, 'info');
    session = await ai.live.connect({
      model: MODELS.flashLive,
      config: {
        responseModalities: [Modality.TEXT],
        inputAudioTranscription: {},
        systemInstruction:
          'You are a silent transcription relay. The user is voice-journaling, possibly code-switching between Hindi, Kannada, Tamil, Telugu and English. Do not reply conversationally.',
      },
      callbacks: {
        onmessage: (msg) => {
          const t = msg.serverContent?.inputTranscription?.text;
          if (t) {
            utteranceBuffer += t;
            cb.onTranscript(utteranceBuffer, false);
          }
          if (msg.serverContent?.turnComplete) void flushUtterance();
        },
        onerror: (e) => cb.onError(e.message ?? 'live session error'),
        onclose: () => {
          void flushUtterance();
          cb.onClose?.();
        },
      },
    });
  } catch (err) {
    cb.onError(err instanceof Error ? err.message : String(err));
    return null;
  }

  return {
    sendAudioChunk: (base64Pcm) =>
      session.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } }),
    close: () => {
      handoff('antigravity', 'flash-cloud', 'close live session', undefined, 'info');
      session.close();
    },
  };
}
