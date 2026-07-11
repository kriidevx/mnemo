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

import { C } from '@/constants/mnemo-theme';
import {
  dailyDigest,
  financialLedger,
  generateBrief,
  generateRecapVideo,
  generateWeekDeck,
  getApiKey,
  readAloud,
  setApiKey,
  translateMyDay,
  type Brief,
  type DailyDigest,
  type RecapResult,
  type WeekSlide,
} from '@/lib/mnemo';
import { pcmBase64ToWavFile } from '@/lib/voice/wav';

// The Generator studio — Brief Me, My Week, Recap Video, Translate My Day,
// Financial Ledger, Daily Digest + settings. Every artifact from lived memory.

const LANGS = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu'];

export default function StudioScreen() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState('English');

  const [person, setPerson] = useState('Priya');
  const [brief, setBrief] = useState<Brief | null | 'none'>(null);
  const [slides, setSlides] = useState<WeekSlide[] | null>(null);
  const [recap, setRecap] = useState<RecapResult | null>(null);
  const [dayText, setDayText] = useState<string | null>(null);
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyStatus, setKeyStatus] = useState<string | null>(null);

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

  const ledger = showLedger ? financialLedger() : null;
  const oweTotal = ledger?.iOwe.reduce((s, a) => s + (a.entities.money?.amount ?? 0), 0) ?? 0;
  const owedTotal = ledger?.owedToMe.reduce((s, a) => s + (a.entities.money?.amount ?? 0), 0) ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Studio</Text>
        <Text style={styles.subtitle}>Turn lived memory into finished work</Text>

        <View style={styles.langRow}>
          {LANGS.map((l) => (
            <Pressable key={l} onPress={() => setLang(l)} style={[styles.langChip, lang === l && styles.langActive]}>
              <Text style={[styles.langTxt, lang === l && styles.langTxtActive]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* ---- Brief Me ---- */}
        <Section title="Brief Me" hint="Meeting brief from everything you remember about them">
          <View style={styles.inline}>
            <TextInput value={person} onChangeText={setPerson} style={[styles.input, { flex: 1 }]} placeholder="Person" placeholderTextColor={C.textTertiary} />
            <Btn label={busy === 'brief' ? '…' : 'Generate'} onPress={() => guard('brief', async () => setBrief((await generateBrief(person.trim(), lang)) ?? 'none'))} />
          </View>
          {brief === 'none' ? <Text style={styles.muted}>Nothing notable about {person} — Mnemo won't invent.</Text> : null}
          {brief && brief !== 'none' ? (
            <View style={styles.result}>
              <Text style={styles.resultTitle}>{brief.title}</Text>
              <Text style={styles.body}>{brief.lastInteraction}</Text>
              {brief.openPromises.length ? <Bullets label="Open promises" items={brief.openPromises} color="#FFA000" /> : null}
              {brief.decisions.length ? <Bullets label="Decisions" items={brief.decisions} color="#4A90D9" /> : null}
              {brief.talkingPoints.length ? <Bullets label="Talking points" items={brief.talkingPoints} color="#2BB8A8" /> : null}
            </View>
          ) : null}
        </Section>

        {/* ---- My Week ---- */}
        <Section title="My Week" hint="Visual narrative deck — NB2 Lite slide art">
          <Btn full label={busy === 'week' ? 'Building deck…' : 'Generate deck'} onPress={() => guard('week', async () => setSlides((await generateWeekDeck(lang)).slides))} />
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
        </Section>

        {/* ---- Recap Video ---- */}
        <Section title="Recap Video" hint="Omni Flash animates your week, narrated in your language">
          <Btn full label={busy === 'recap' ? 'Directing… (1-3 min)' : 'Create recap'} onPress={() => guard('recap', async () => setRecap(await generateRecapVideo(lang)))} />
          {busy === 'recap' ? <ActivityIndicator color="#FFA000" style={{ marginTop: 10 }} /> : null}
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

        {/* ---- Translate My Day ---- */}
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

        {/* ---- Financial Ledger ---- */}
        <Section title="Financial Memory" hint="On-device only — money never touches the cloud">
          <Btn full label={showLedger ? 'Hide ledger' : 'Open ledger'} onPress={() => setShowLedger((s) => !s)} />
          {ledger ? (
            <View style={styles.result}>
              <View style={styles.ledgerTotals}>
                <View>
                  <Text style={styles.ledgerLabel}>YOU OWE</Text>
                  <Text style={[styles.ledgerNum, { color: '#FF6B5E' }]}>₹{oweTotal.toLocaleString('en-IN')}</Text>
                </View>
                <View>
                  <Text style={styles.ledgerLabel}>OWED TO YOU</Text>
                  <Text style={[styles.ledgerNum, { color: '#34C759' }]}>₹{owedTotal.toLocaleString('en-IN')}</Text>
                </View>
              </View>
              {[...ledger.iOwe.map((a) => ({ a, dir: '→' })), ...ledger.owedToMe.map((a) => ({ a, dir: '←' }))].map(({ a, dir }) => (
                <View key={a.id} style={styles.ledgerRow}>
                  <Text style={[styles.ledgerDir, { color: dir === '→' ? '#FF6B5E' : '#34C759' }]}>{dir}</Text>
                  <Text style={styles.ledgerContent} numberOfLines={2}>{a.content}</Text>
                  {a.entities.money?.amount ? (
                    <Text style={styles.ledgerAmt}>₹{a.entities.money.amount.toLocaleString('en-IN')}</Text>
                  ) : null}
                </View>
              ))}
              {ledger.iOwe.length + ledger.owedToMe.length === 0 ? <Text style={styles.muted}>No financial memories yet.</Text> : null}
            </View>
          ) : null}
        </Section>

        {/* ---- Daily Digest ---- */}
        <Section title="Daily Digest" hint="Today's memory card — works offline">
          <Btn full label={busy === 'digest' ? '…' : "Compile today"} onPress={() => guard('digest', async () => setDigest(await dailyDigest(lang)))} />
          {digest ? (
            <View style={styles.result}>
              <Text style={styles.resultTitle}>{digest.headline}</Text>
              <Text style={styles.body}>{digest.body}</Text>
              <Text style={styles.muted}>{digest.generatedBy === 'flash-cloud' ? 'Generated in the cloud' : 'Generated on-device (offline)'}</Text>
            </View>
          ) : null}
        </Section>

        {/* ---- Settings ---- */}
        <Section title="Settings" hint="Gemini API key (stored on device)">
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
  title: { color: C.text, fontSize: 24, fontWeight: '800', marginTop: 12, marginHorizontal: 20 },
  subtitle: { color: C.textSecondary, fontSize: 13, marginHorizontal: 20, marginTop: 2 },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginTop: 14 },
  langChip: { borderRadius: 16, borderWidth: 1, borderColor: C.separator, paddingHorizontal: 13, paddingVertical: 6 },
  langActive: { borderColor: '#FFA000', backgroundColor: 'rgba(255,160,0,0.12)' },
  langTxt: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  langTxtActive: { color: '#FFA000' },
  error: { color: '#FF453A', fontSize: 12, marginHorizontal: 20, marginTop: 10 },
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: 'rgba(28,28,30,0.85)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 0.5,
    borderColor: C.separator,
    gap: 10,
  },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  sectionHint: { color: C.textTertiary, fontSize: 12, marginTop: -6 },
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    padding: 10,
    color: C.text,
    fontSize: 14,
    borderWidth: 0.5,
    borderColor: C.separator,
  },
  btn: {
    backgroundColor: 'rgba(255,160,0,0.14)',
    borderColor: 'rgba(255,160,0,0.5)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnFull: { alignSelf: 'stretch' },
  btnTxt: { color: '#FFA000', fontWeight: '700', fontSize: 14 },
  result: { gap: 8, marginTop: 4 },
  resultTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  body: { color: C.text, fontSize: 14, lineHeight: 21 },
  muted: { color: C.textTertiary, fontSize: 12 },
  bullets: { gap: 3 },
  bulletLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 2 },
  bulletItem: { color: C.text, fontSize: 14, lineHeight: 20 },
  deckRow: { gap: 10, paddingVertical: 4 },
  slide: { width: 220, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, padding: 10, borderWidth: 0.5, borderColor: C.separator },
  slideImg: { width: '100%', height: 110, borderRadius: 10, backgroundColor: '#0A0A0C' },
  slideImgEmpty: { borderWidth: 0.5, borderColor: C.separator },
  slideHead: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 8 },
  slideBody: { color: C.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  scene: { width: 160, height: 90, borderRadius: 10 },
  video: { width: '100%', height: 200, borderRadius: 14, backgroundColor: '#0A0A0C' },
  ledgerTotals: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6 },
  ledgerLabel: { color: C.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
  ledgerNum: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'center', marginTop: 2 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: C.separator },
  ledgerDir: { fontSize: 16, fontWeight: '800' },
  ledgerContent: { color: C.text, fontSize: 13, flex: 1 },
  ledgerAmt: { color: C.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
