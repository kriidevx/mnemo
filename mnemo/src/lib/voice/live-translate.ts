import type { Session } from '@google/genai';
import { Modality } from '@google/genai';

import { getGenAI } from '../gemini';
import { MODELS } from '../models';
import { handoff } from '../orchestrator';

// Cross-language bridge on gemini-3.5-live-translate-preview: speak in any
// language, receive live translated text (and atoms via the normal Listener
// path on the source transcript). Used during voice capture when the user
// wants the running transcript unified into one language.

export interface LiveTranslateCallbacks {
  onSource: (text: string) => void;      // what was heard (original language)
  onTranslated: (text: string) => void;  // rolling translation
  onError: (msg: string) => void;
  onClose?: () => void;
}

export interface LiveTranslateSession {
  sendAudioChunk: (base64Pcm: string) => void;
  close: () => void;
}

export async function startLiveTranslate(
  targetLanguage: string,
  cb: LiveTranslateCallbacks
): Promise<LiveTranslateSession | null> {
  const ai = await getGenAI();
  if (!ai) {
    cb.onError('No API key set');
    return null;
  }
  let session: Session;
  try {
    handoff('input', 'antigravity', `open Live Translate session → ${targetLanguage}`, MODELS.liveTranslate, 'info');
    session = await ai.live.connect({
      model: MODELS.liveTranslate,
      config: {
        responseModalities: [Modality.TEXT],
        inputAudioTranscription: {},
        systemInstruction: `Translate everything the user says into ${targetLanguage}. Output only the translation, no commentary. The user may code-switch between Hindi, Kannada, Tamil, Telugu and English.`,
      },
      callbacks: {
        onmessage: (msg) => {
          const src = msg.serverContent?.inputTranscription?.text;
          if (src) cb.onSource(src);
          const parts = msg.serverContent?.modelTurn?.parts;
          const txt = parts?.map((p) => p.text ?? '').join('');
          if (txt) cb.onTranslated(txt);
        },
        onerror: (e) => cb.onError(e.message ?? 'live translate error'),
        onclose: () => cb.onClose?.(),
      },
    });
  } catch (err) {
    cb.onError(err instanceof Error ? err.message : String(err));
    return null;
  }
  return {
    sendAudioChunk: (b64) => session.sendRealtimeInput({ audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } }),
    close: () => session.close(),
  };
}
