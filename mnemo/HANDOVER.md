# Mnemo — UI Handover

The entire logic layer is done and typechecked. Every screen imports from **one place**:

```ts
import { ... } from '@/lib/mnemo';
```

Design your HTML freely — this doc maps each screen to the functions it calls.

## Reference components already built (steal the patterns)

- `src/components/atom-card.tsx` — glass card: confidence → opacity tier, type → color, ✓ confirm / ✗ dismiss / long-press correct
- `src/components/dynamic-island.tsx` — top pill, `useIsland().show(title, atoms)`, auto-dismiss 8s
- `src/constants/mnemo-theme.ts` — atom colors, language labels, opacity tiers

## Screen → API map

### 1. Memory feed (home)
```ts
const atoms = useMemoryStore((s) => s.atoms);       // reactive
const live = liveAtoms(atoms);                       // decay applied, archived filtered, has .eff
const health = memoryHealth(atoms);                  // {total, avgConfidence, langs}
useMemoryStore.getState().confirmAtom(id);           // swipe right (+0.1)
useMemoryStore.getState().dismissAtom(id);           // swipe left (archive)
useMemoryStore.getState().correctAtom(id, newText);  // long-press edit → conf 0.95
```

### 2. Capture (text input)
```ts
const { atoms, engine, escalated } = await extractAtoms(text, 'manual');
useMemoryStore.getState().addAtoms(atoms);
```
`engine` tells you the badge: `gemma-local` (⚡ on-device) / `flash-cloud` (☁) / `heuristic-offline` (~).
Works fully offline (heuristic path) — never throws.

### 3. Voice journal
Record-then-extract (simplest, reliable):
```ts
await ensureMicPermission(); await prepareRecordingMode();
const rec = useAudioRecorder(RecordingPresets.HIGH_QUALITY);  // in component
await rec.prepareToRecordAsync(); rec.record();
// ...stop:
await rec.stop();
const { base64, mimeType } = await recordingToBase64(rec.uri!);
const { atoms, transcript } = await extractFromAudio(base64, mimeType);
useMemoryStore.getState().addAtoms(atoms);
```
Live streaming (Flash Live, atoms appear while speaking):
```ts
const session = await startLiveJournal({
  onTranscript: (text, finished) => {...},
  onAtoms: (atoms) => useMemoryStore.getState().addAtoms(atoms),
  onError: (msg) => {...},
});
session?.sendAudioChunk(base64Pcm16k); // feed mic PCM chunks
session?.close();
```

### 4. Context triggers (Dynamic Island demo)
```ts
const ranked = queryPerson('Aarav');           // ranked by recency × confidence × type priority
useIsland.getState().show('Opening WhatsApp → Aarav', ranked);
const urgent = expiringPromises();             // red-glow cards
const clash = conflicts();                     // conflicting atoms, render dashed/faded
```

### 5. Generate — Brief Me
```ts
const brief = await generateBrief('Swapna', 'English');
// null = no atoms → show "Nothing notable" (honesty, never hallucinate)
// {title, lastInteraction, openPromises[], decisions[], talkingPoints[]}
```

### 6. Generate — My Week deck
```ts
const { slides, failedSteps } = await generateWeekDeck('English');
// slides: {heading, body, imagePrompt, imageB64?}  imageB64 = NB2 Lite visual
// render <Image source={{uri: `data:image/png;base64,${s.imageB64}`}} />
// failedSteps nonempty → banner "visuals unavailable, text-only deck"
```

### 7. Generate — Recap video (Omni + TTS)
```ts
const r = await generateRecapVideo('Hindi');
// r.videoUri  → play with expo-video (append ?key=API_KEY if download needs auth)
// r.audioB64  → TTS narration (PCM/wav base64) — play with expo-audio
// r.sceneImagesB64 → fallback slideshow if videoUri empty
// r.failedSteps → which pipeline stages degraded
```
Takes 1-4 min. Show pipeline progress from the handoff log (below).

### 8. Translate My Day + read aloud
```ts
const summary = await translateMyDay('Kannada');
const audioB64 = await readAloud(summary);
```

### 9. Scan & Remember (camera)
```ts
// get base64 from expo-image-picker / camera
const atoms = await scanAndRemember(base64, 'image/jpeg');
useMemoryStore.getState().addAtoms(atoms);
```

### 10. Orchestration log (the judges' window — REQUIRED screen)
```ts
const entries = useHandoffLog((s) => s.entries);  // reactive, newest first
// {ts, from, to, action, detail, level: info|handoff|escalation|conflict|error|fallback}
// color by level: escalation=orange, conflict=red, fallback=yellow, handoff=blue
```
Every extraction, escalation, conflict, pipeline step logs here automatically. Render as live feed.

### 11. Settings
```ts
await setApiKey(key);                 // persisted; or EXPO_PUBLIC_GEMINI_API_KEY in .env
const s = await gemmaModelStatus();   // {nativeModule, modelFile, loaded, path}
// s.path shows where to push the gguf: adb push gemma-4-e2b-it.gguf <path>
await loadGemma();
```

### Demo fixtures
```ts
seedDemo();    // loads the PRD demo narrative (Aarav ₹4200, Swapna launch, conflict pair)
wipeMemory();  // clean slate
```

## Rules that survive into UI
- Confidence drives opacity: ≥0.9 solid · 0.7 frosted · 0.5 hazy · <0.5 ghost
- Type colors in `mnemo-theme.ts` (promise amber, decision blue, financial green…)
- ₹ amounts: `n.toLocaleString('en-IN')`
- Empty results say "nothing notable" — never invent
- llama.rn needs a dev build (`npx expo run:android`) — Expo Go silently falls back to cloud/heuristic, app still works
