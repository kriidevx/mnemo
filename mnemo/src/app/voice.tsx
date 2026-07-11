import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { AtomCard } from '@/components/atom-card';
import { Waveform } from '@/components/waveform';
import { C } from '@/constants/mnemo-theme';
import {
  ensureMicPermission,
  extractFromAudio,
  prepareRecordingMode,
  recordingToBase64,
  RecordingPresets,
  useAudioRecorder,
  useMemoryStore,
  type MemoryAtom,
} from '@/lib/mnemo';

// MODE 6 — Voice Journal. Speak in any language (code-switching welcome);
// one multimodal Flash call transcribes + extracts; atoms drop into the feed.

type Phase = 'idle' | 'recording' | 'processing';

export default function VoiceScreen() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [sessionAtoms, setSessionAtoms] = useState<MemoryAtom[]>([]);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    const ok = await ensureMicPermission();
    if (!ok) {
      setError('Microphone permission needed.');
      return;
    }
    await prepareRecordingMode();
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const stop = async () => {
    setPhase('processing');
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('No recording captured');
      const { base64, mimeType } = await recordingToBase64(recorder.uri);
      const { atoms, transcript: t } = await extractFromAudio(base64, mimeType);
      setTranscript(t);
      if (atoms.length) {
        useMemoryStore.getState().addAtoms(atoms);
        setSessionAtoms((prev) => [...atoms, ...prev]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (!t) {
        setError('Could not process audio — check API key in Studio → Settings.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed');
    } finally {
      setPhase('idle');
    }
  };

  const recording = phase === 'recording';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Voice Journal</Text>
      <Text style={styles.subtitle}>
        {recording ? 'Listening — speak freely, any language' : phase === 'processing' ? 'Structuring your memories…' : 'Hindi, Kannada, Tamil, Telugu, English — ek saath bhi chalega'}
      </Text>

      <View style={styles.waveWrap}>
        <Waveform active={recording} />
      </View>

      <Pressable
        onPress={recording ? stop : start}
        disabled={phase === 'processing'}
        style={({ pressed }) => [
          styles.micBtn,
          recording && styles.micActive,
          (pressed || phase === 'processing') && { opacity: 0.7 },
        ]}>
        <Text style={styles.micTxt}>{recording ? 'Stop' : phase === 'processing' ? '…' : 'Speak'}</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {transcript ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>HEARD</Text>
          <Text style={styles.transcript}>{transcript}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.feed}>
        {sessionAtoms.length > 0 ? (
          <Text style={styles.feedTitle}>Extracted this session</Text>
        ) : null}
        {sessionAtoms.map((a) => (
          <AtomCard key={a.id} atom={a} eff={a.confidence} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  title: { color: C.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 12, letterSpacing: 0.3 },
  subtitle: { color: C.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: 32 },
  waveWrap: { marginTop: 28, marginBottom: 12 },
  micBtn: {
    alignSelf: 'center',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(28,28,30,0.9)',
    borderWidth: 1.5,
    borderColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: { borderColor: '#FF453A', backgroundColor: 'rgba(255,69,58,0.12)' },
  micTxt: { color: C.text, fontSize: 16, fontWeight: '700' },
  error: { color: '#FF453A', fontSize: 12, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 },
  transcriptBox: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: 'rgba(28,28,30,0.8)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: C.separator,
  },
  transcriptLabel: { color: C.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  transcript: { color: C.text, fontSize: 15, lineHeight: 21 },
  feed: { paddingTop: 12, paddingBottom: 24 },
  feedTitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginHorizontal: 20,
    marginBottom: 6,
  },
});
