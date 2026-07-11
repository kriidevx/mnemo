import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAudioPlayer } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';

import { ATOM_COLORS, C } from '@/constants/mnemo-theme';
import {
  dailyDigest,
  downloadGemmaModel,
  gemmaModelStatus,
  generateBrief,
  generateRecapVideo,
  generateWeekDeck,
  getApiKey,
  loadGemma,
  readAloud,
  setApiKey,
  translateMyDay,
  type Brief,
  type DailyDigest,
  type RecapResult,
  type WeekSlide,
} from '@/lib/mnemo';
import { pcmBase64ToWavFile } from '@/lib/voice/wav';

// Studio (prototype): segmented Brief Me / My Week + language chips, extended
// with Tools (recap video, translate day, digest) and Setup (API key, Gemma).

const LANGS = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu'];
const TABS = [
  { key: 'brief', label: 'Brief Me' },
  { key: 'week', label: 'My Week' },
  { key: 'tools', label: 'Tools' },
  { key: 'setup', label: 'Setup' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function StudioScreen() {
  const [tab, setTab] = useState<TabKey>('brief');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState('English');

  const [person, setPerson] = useState('Priya');
  const [brief, setBrief] = useState<Brief | null | 'none'>(null);
  const [slides, setSlides] = useState<WeekSlide[] | null>(null);
  const [recap, setRecap] = useState<RecapResult | null>(null);
  const [dayText, setDayText] = useState<string | null>(null);
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState('');
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [dlPct, setDlPct] = useState<number | null>(null);

  const guard = async (name: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(name);
    setError(null);
    try {
      await fn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(null);
    }
  };

  const playNarration = async (b64: string) => {
    try {
      const path = await pcmBase64ToWavFile(b64);
      const player = createAudioPlayer({ uri: path });
      player.play();
    } catch {
      setError('Narration playback failed');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Studio</Text>
        <Text style={styles.subtitle}>Turn lived memory into finished work</Text>

        <View style={styles.segments}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.segment, tab === t.key && styles.segmentActive]}>
              <Text style={[styles.segmentTxt, tab === t.key && styles.segmentTxtActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langRow}>
          {LANGS.map((l) => (
            <Pressable key={l} onPress={() => setLang(l)} style={[styles.langChip, lang === l && styles.langActive]}>
              <Text style={[styles.langTxt, lang === l && styles.langTxtActive]}>{l}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'brief' ? (
          <View style={styles.pane}>
            <View style={styles.inline}>
              {['Priya', 'Rohan'].map((name) => (
                <Pressable key={name} onPress={() => setPerson(name)} style={[styles.personChip, person === name && styles.personChipActive]}>
                  <Text style={[styles.personTxt, person === name && styles.personTxtActive]}>{name}</Text>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              <Btn
                label={busy === 'brief' ? '…' : 'Generate'}
                onPress={() => guard('brief', async () => setBrief((await generateBrief(person.trim(), lang)) ?? 'none'))}
              />
            </View>
            <View style={styles.inline}>
              <TextInput
                value={person}
                onChangeText={setPerson}
                style={[styles.input, { flex: 1 }]}
                placeholder="Person"
                placeholderTextColor={C.textTertiary}
              />
            </View>
            {brief === 'none' ? <Text style={styles.muted}>Nothing notable about {person} — Mnemo won't invent.</Text> : null}
            {brief && brief !== 'none' ? (
              <View style={styles.card}>
                <Text style={styles.resultTitle}>{brief.title}</Text>
                <Text style={styles.body}>{brief.lastInteraction}</Text>
                {brief.openPromises.length ? <Bullets label="Open promises" items={brief.openPromises} color={C.amber} /> : null}
                {brief.decisions.length ? <Bullets label="Decisions" items={brief.decisions} color={ATOM_COLORS.decision.accent} /> : null}
                {brief.talkingPoints.length ? <Bullets label="Talking points" items={brief.talkingPoints} color={ATOM_COLORS.task.accent} /> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === 'week' ? (
          <View style={styles.pane}>
            <Btn
              full
              label={busy === 'week' ? 'Building deck…' : 'Generate deck'}
              onPress={() => guard('week', async () => setSlides((await generateWeekDeck(lang)).slides))}
            />
            {busy === 'week' ? <ActivityIndicator color={C.ink} style={{ marginTop: 10 }} /> : null}
            {slides && slides.length === 0 ? <Text style={styles.muted}>No memories this week yet.</Text> : null}
            {slides && slides.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckRow}>
                {slides.map((s, i) => (
                  <View key={i} style={styles.slide}>
                    {s.imageB64 ? (
                      <Image source={{ uri: `data:image/png;base64,${s.imageB64}` }} style={styles.slideImg} />
                    ) : (
                      <View style={[styles.slideImg, styles.slideImgEmpty]} />
                    )}
                    <Text style={styles.slideHead}>{s.heading}</Text>
                    <Text style={styles.slideBody} numberOfLines={4}>{s.body}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        {tab === 'tools' ? (
          <View style={styles.pane}>
            <Section title="Recap Video" hint="Omni Flash animates your week, narrated in your language">
              <Btn full label={busy === 'recap' ? 'Directing… (1-3 min)' : 'Create recap'} onPress={() => guard('recap', async () => setRecap(await generateRecapVideo(lang)))} />
              {busy === 'recap' ? <ActivityIndicator color={C.ink} style={{ marginTop: 10 }} /> : null}
              {recap ? (
                <View style={styles.result}>
                  {recap.script ? <Text style={styles.body}>{recap.script}</Text> : null}
                  {recap.videoUri ? <RecapVideo uri={recap.videoUri} /> : null}
                  {!recap.videoUri && recap.sceneImagesB64?.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckRow}>
                      {recap.sceneImagesB64.map((img, i) => (
                        <Image key={i} source={{ uri: `data:image/png;base64,${img}` }} style={styles.scene} />
                      ))}
                    </ScrollView>
                  ) : null}
                  {recap.audioB64 ? <Btn full label={`Play narration (${lang})`} onPress={() => playNarration(recap.audioB64!)} /> : null}
                  {recap.failedSteps.length ? <Text style={styles.muted}>Degraded: {recap.failedSteps.join(', ')}</Text> : null}
                </View>
              ) : null}
            </Section>

            <Section title="Translate My Day" hint="Your multilingual day, unified into one language">
              <Btn full label={busy === 'day' ? 'Bridging…' : `Summarize in ${lang}`} onPress={() => guard('day', async () => setDayText(await translateMyDay(lang)))} />
              {dayText === '' ? <Text style={styles.muted}>Nothing captured today yet.</Text> : null}
              {dayText ? (
                <View style={styles.result}>
                  <Text style={styles.body}>{dayText}</Text>
                  <Btn full label="Read aloud" onPress={() => guard('tts', async () => playNarration(await readAloud(dayText)))} />
                </View>
              ) : null}
            </Section>

            <Section title="Daily Digest" hint="Today's memory card — works offline">
              <Btn full label={busy === 'digest' ? '…' : 'Compile today'} onPress={() => guard('digest', async () => setDigest(await dailyDigest(lang)))} />
              {digest ? (
                <View style={styles.result}>
                  <Text style={styles.resultTitle}>{digest.headline}</Text>
                  <Text style={styles.body}>{digest.body}</Text>
                  <Text style={styles.muted}>{digest.generatedBy === 'flash-cloud' ? 'Generated in the cloud' : 'Generated on-device (offline)'}</Text>
                </View>
              ) : null}
            </Section>
          </View>
        ) : null}

        {tab === 'setup' ? (
          <View style={styles.pane}>
            <Section title="Gemini API key" hint="Stored on device only">
              <View style={styles.inline}>
                <TextInput
                  value={keyDraft}
                  onChangeText={setKeyDraft}
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Paste API key…"
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Btn
                  label="Save"
                  onPress={() =>
                    guard('key', async () => {
                      await setApiKey(keyDraft);
                      setKeyDraft('');
                      setKeyStatus('Key saved.');
                    })
                  }
                />
              </View>
              <Btn full label="Check key status" onPress={() => guard('check', async () => setKeyStatus((await getApiKey()) ? 'Key present ✓' : 'No key set'))} />
              {keyStatus ? <Text style={styles.muted}>{keyStatus}</Text> : null}
            </Section>

            <Section title="On-Device Gemma" hint="Offline extraction — the airplane-mode brain">
              <Btn
                full
                label="Check model status"
                onPress={() =>
                  guard('gemma-status', async () => {
                    const s = await gemmaModelStatus();
                    setModelStatus(
                      !s.nativeModule
                        ? 'Native module missing — use the APK build, not Expo Go.'
                        : s.loaded
                          ? 'Gemma loaded — offline extraction live ✓'
                          : s.modelFile
                            ? 'Weights found on device — will load on first offline capture ✓'
                            : `No weights yet. adb push target:\n${s.adbPushTarget}`
                    );
                  })
                }
              />
              {modelStatus ? <Text style={styles.muted}>{modelStatus}</Text> : null}
              <View style={styles.inline}>
                <TextInput
                  value={modelUrl}
                  onChangeText={setModelUrl}
                  style={[styles.input, { flex: 1 }]}
                  placeholder="GGUF URL (Hugging Face)…"
                  placeholderTextColor={C.textTertiary}
                  autoCapitalize="none"
                />
                <Btn
                  label={dlPct != null ? `${Math.round(dlPct * 100)}%` : 'Download'}
                  onPress={() =>
                    guard('gemma-dl', async () => {
                      if (!modelUrl.trim()) throw new Error('Paste a GGUF download URL first');
                      setDlPct(0);
                      const r = await downloadGemmaModel(modelUrl.trim(), setDlPct);
                      setDlPct(null);
                      if (!r.ok) throw new Error(r.error ?? 'download failed');
                      setModelStatus('Weights downloaded ✓');
                    })
                  }
                />
              </View>
              <Btn
                full
                label="Load Gemma into memory now"
                onPress={() =>
                  guard('gemma-load', async () => {
                    const ok = await loadGemma();
                    setModelStatus(ok ? 'Gemma loaded — offline extraction live ✓' : 'Load failed — check weights + APK build');
                  })
                }
              />
            </Section>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecapVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  return <VideoView player={player} style={styles.video} contentFit="cover" />;
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
      {children}
    </View>
  );
}

function Btn({ label, onPress, full }: { label: string; onPress: () => void; full?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, full && styles.btnFull, pressed && { opacity: 0.7 }]}>
      <Text style={styles.btnTxt}>{label}</Text>
    </Pressable>
  );
}

function Bullets({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <View style={styles.bullets}>
      <Text style={[styles.bulletLabel, { color }]}>{label.toUpperCase()}</Text>
      {items.map((it, i) => (
        <Text key={i} style={styles.bulletItem}>
          <Text style={{ color }}>• </Text>
          {it}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  title: { color: C.text, fontSize: 22, fontWeight: '800', marginTop: 12, marginHorizontal: 20 },
  subtitle: { color: C.textSecondary, fontSize: 12.5, marginHorizontal: 20, marginTop: 3 },
  segments: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.045)',
    borderRadius: 14,
    padding: 4,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 11 },
  segmentActive: {
    backgroundColor: C.card,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentTxt: { fontSize: 13, fontWeight: '700', color: C.textSecondary },
  segmentTxtActive: { color: C.text },
  langRow: { gap: 6, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 2 },
  langChip: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 12, paddingVertical: 6 },
  langActive: { borderColor: C.ink, backgroundColor: 'rgba(0,0,0,0.04)' },
  langTxt: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
  langTxtActive: { color: C.text },
  error: { color: C.danger, fontSize: 12, marginHorizontal: 20, marginTop: 10 },
  pane: { marginTop: 16, marginHorizontal: 20, gap: 10 },
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  personChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.separator,
  },
  personChipActive: { borderColor: C.ink },
  personTxt: { fontSize: 13, fontWeight: '600', color: C.text },
  personTxtActive: { fontWeight: '800' },
  input: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 10,
    color: C.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  btn: {
    backgroundColor: C.ink,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnFull: { alignSelf: 'stretch' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 8,
  },
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 10,
  },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  sectionHint: { color: C.textTertiary, fontSize: 12, marginTop: -6 },
  result: { gap: 8, marginTop: 4 },
  resultTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  body: { color: C.text, fontSize: 13.5, lineHeight: 19 },
  muted: { color: C.textTertiary, fontSize: 12 },
  bullets: { gap: 3, marginTop: 6 },
  bulletLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  bulletItem: { color: C.text, fontSize: 13.5, lineHeight: 19 },
  deckRow: { gap: 12, paddingVertical: 8 },
  slide: { width: 200, backgroundColor: C.card, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: C.cardBorder },
  slideImg: { width: '100%', height: 96, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)' },
  slideImgEmpty: { borderWidth: 1, borderColor: C.separator },
  slideHead: { color: C.text, fontSize: 13.5, fontWeight: '700', marginTop: 9 },
  slideBody: { color: C.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 4 },
  scene: { width: 160, height: 90, borderRadius: 10 },
  video: { width: '100%', height: 200, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.08)' },
});
