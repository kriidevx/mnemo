import { getGenAI } from '../gemini';
import { MODELS } from '../models';
import { handoff, runPipeline } from '../orchestrator';
import { atomsToContext, queryPerson, weekAtoms, type RankedAtom } from './reasoner';

// AGENT 3 — THE GENERATOR (Act).
// Synthesizes memory atoms into finished artifacts on explicit command.
// Every mode is an Antigravity pipeline with per-step timeout + fallback.

export interface Brief {
  title: string;
  lastInteraction: string;
  openPromises: string[];
  decisions: string[];
  talkingPoints: string[];
  raw?: string;
}

/** MODE 1 — "Brief Me": structured meeting brief from atoms about a person. */
export async function generateBrief(person: string, language = 'English'): Promise<Brief | null> {
  const atoms = queryPerson(person);
  if (atoms.length === 0) {
    // Honesty over hallucination — the Check-loop rule.
    handoff('generator', 'user', `nothing notable about ${person}`, undefined, 'info');
    return null;
  }
  const ai = await getGenAI();
  if (!ai) throw new Error('No API key set — add it in Settings');
  handoff('generator', 'flash-cloud', `generate brief for ${person} (${atoms.length} atoms)`);
  const res = await ai.models.generateContent({
    model: MODELS.flash,
    contents: `You are the Generator agent of Mnemo. From these memory atoms about "${person}", produce a meeting brief IN ${language}. Use ONLY facts in the atoms — never invent. If atoms conflict, mention both with a "verify" note.

ATOMS:
${atomsToContext(atoms.slice(0, 15))}

Return JSON: {"title": "...", "lastInteraction": "1-2 sentences", "openPromises": ["..."], "decisions": ["..."], "talkingPoints": ["..."]}`,
    config: { responseMimeType: 'application/json', temperature: 0.3 },
  });
  try {
    const b = JSON.parse(res.text ?? '{}') as Brief;
    handoff('flash-cloud', 'generator', 'brief ready', b.title);
    return b;
  } catch {
    return { title: `Brief: ${person}`, lastInteraction: res.text ?? '', openPromises: [], decisions: [], talkingPoints: [], raw: res.text ?? undefined };
  }
}

// ---------- MODE 2 — "My Week" deck ----------

export interface WeekSlide {
  heading: string;
  body: string;
  imagePrompt: string;
  imageB64?: string; // NB2 Lite output
}

export async function generateWeekDeck(language = 'English'): Promise<{ slides: WeekSlide[]; failedSteps: string[] }> {
  const atoms = weekAtoms();
  if (atoms.length === 0) return { slides: [], failedSteps: [] };

  const { result, failedSteps } = await runPipeline<{ slides: WeekSlide[] }>('My Week deck', [
    {
      name: 'write narrative (Flash)',
      agent: 'flash-cloud',
      timeoutMs: 45_000,
      run: async () => {
        const ai = await getGenAI();
        if (!ai) throw new Error('No API key');
        const res = await ai.models.generateContent({
          model: MODELS.flash,
          contents: `From these memory atoms of the user's past 7 days, write a 5-slide weekly narrative IN ${language}. Slide 1: week at a glance (key numbers/people/decisions). Slides 2-3: top threads. Slide 4: open promises with deadlines. Slide 5: next week's carry-forward. Each slide gets an "imagePrompt": a minimal flat-illustration prompt themed to that slide's content (no text in image).

ATOMS:
${atomsToContext(atoms.slice(0, 25))}

JSON: {"slides":[{"heading":"...","body":"2-3 sentences","imagePrompt":"..."}]}`,
          config: { responseMimeType: 'application/json', temperature: 0.4 },
        });
        const parsed = JSON.parse(res.text ?? '{}');
        return { slides: (parsed.slides ?? []) as WeekSlide[] };
      },
    },
    {
      name: 'generate slide visuals (NB2 Lite)',
      agent: 'nb2-lite',
      timeoutMs: 60_000,
      // Fallback: deck ships text-only — degraded, not dead.
      fallback: (acc) => ({ slides: acc.slides ?? [] }),
      run: async (acc) => {
        const ai = await getGenAI();
        if (!ai) throw new Error('No API key');
        const slides = [...(acc.slides ?? [])];
        // NB2 Lite is sub-4s/image — parallel burst is the whole point of PS3-grade usage.
        const images = await Promise.allSettled(
          slides.map((s) =>
            ai.models.generateContent({
              model: MODELS.nb2lite,
              contents: `Minimal flat vector illustration, warm palette, no text, 16:9: ${s.imagePrompt}`,
            })
          )
        );
        images.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const part = r.value.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
            if (part?.inlineData?.data) slides[i] = { ...slides[i], imageB64: part.inlineData.data };
          }
        });
        handoff('nb2-lite', 'generator', `${images.filter((r) => r.status === 'fulfilled').length}/${slides.length} slide visuals generated`);
        return { slides };
      },
    },
  ]);
  return { slides: result.slides ?? [], failedSteps };
}

// ---------- MODE 3 — "Recap Video" (Omni Flash + TTS) ----------

export interface RecapResult {
  script?: string;
  sceneImagesB64?: string[];
  videoUri?: string;
  audioB64?: string; // TTS narration (PCM/wav base64)
  failedSteps: string[];
}

export async function generateRecapVideo(language = 'Hindi'): Promise<RecapResult> {
  const atoms = weekAtoms();
  if (atoms.length === 0) return { failedSteps: ['no atoms this week'] };

  const { result, failedSteps } = await runPipeline<{
    script: string;
    scenePrompts: string[];
    sceneImagesB64: string[];
    videoUri: string;
    audioB64: string;
  }>('Recap video', [
    {
      name: 'write recap script (Flash)',
      agent: 'flash-cloud',
      timeoutMs: 45_000,
      run: async () => {
        const ai = await getGenAI();
        if (!ai) throw new Error('No API key');
        const res = await ai.models.generateContent({
          model: MODELS.flash,
          contents: `Write a 30-second spoken recap of this week IN ${language} (natural, warm, first person "your week") from these memory atoms, plus 3 visual scene prompts (flat illustration style, no text) matching the narrative beats.

ATOMS:
${atomsToContext(atoms.slice(0, 20))}

JSON: {"script": "...", "scenePrompts": ["...", "...", "..."]}`,
          config: { responseMimeType: 'application/json', temperature: 0.5 },
        });
        const parsed = JSON.parse(res.text ?? '{}');
        return { script: parsed.script ?? '', scenePrompts: parsed.scenePrompts ?? [] };
      },
    },
    {
      name: 'scene stills (NB2 Lite)',
      agent: 'nb2-lite',
      timeoutMs: 45_000,
      fallback: () => ({ sceneImagesB64: [] }),
      run: async (acc) => {
        const ai = await getGenAI();
        if (!ai) throw new Error('No API key');
        const settled = await Promise.allSettled(
          (acc.scenePrompts ?? []).map((p) =>
            ai.models.generateContent({ model: MODELS.nb2lite, contents: `Cinematic flat illustration, 16:9, no text: ${p}` })
          )
        );
        const imgs: string[] = [];
        for (const r of settled) {
          if (r.status === 'fulfilled') {
            const d = r.value.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
            if (d) imgs.push(d);
          }
        }
        return { sceneImagesB64: imgs };
      },
    },
    {
      name: 'animate scenes (Omni Flash)',
      agent: 'omni-flash',
      timeoutMs: 240_000,
      // Fallback: stills + narration become a slideshow recap — degraded, still demoable.
      fallback: () => ({ videoUri: '' }),
      run: async (acc) => {
        const ai = await getGenAI();
        if (!ai) throw new Error('No API key');
        const firstImage = acc.sceneImagesB64?.[0];
        handoff('generator', 'omni-flash', 'generate recap video', `${acc.sceneImagesB64?.length ?? 0} reference stills`);
        // Omni Flash long-running video op via generateVideos-style API.
        let op = await (ai.models as any).generateVideos({
          model: MODELS.omni,
          prompt: `A warm 15-second animated weekly-recap montage. Narrative: ${acc.script?.slice(0, 500)}. Smooth transitions between scenes, flat illustration style.`,
          ...(firstImage ? { image: { imageBytes: firstImage, mimeType: 'image/png' } } : {}),
        });
        const started = Date.now();
        while (!op.done && Date.now() - started < 210_000) {
          await new Promise((r) => setTimeout(r, 8000));
          op = await (ai.operations as any).getVideosOperation({ operation: op });
        }
        const uri = op.response?.generatedVideos?.[0]?.video?.uri ?? '';
        if (!uri) throw new Error('Omni returned no video');
        handoff('omni-flash', 'generator', 'video ready', uri.slice(0, 60));
        return { videoUri: uri };
      },
    },
    {
      name: `narrate in ${language} (Flash TTS)`,
      agent: 'tts',
      timeoutMs: 60_000,
      fallback: () => ({ audioB64: '' }),
      run: async (acc) => {
        const ai = await getGenAI();
        if (!ai) throw new Error('No API key');
        const res = await ai.models.generateContent({
          model: MODELS.tts,
          contents: acc.script ?? '',
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          } as any,
        });
        const audio = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data ?? '';
        if (!audio) throw new Error('TTS returned no audio');
        handoff('tts', 'generator', `narration ready (${language})`);
        return { audioB64: audio };
      },
    },
  ]);

  return {
    script: result.script,
    sceneImagesB64: result.sceneImagesB64,
    videoUri: result.videoUri,
    audioB64: result.audioB64,
    failedSteps,
  };
}
