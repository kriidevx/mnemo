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

// Voice Journal (prototype): centered waveform, white round mic button with
// state-colored ring, HEARD transcript card, session-extracted atoms below.

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
        setError('Could not process audio — check API key in Studio → Setup.');
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Voice Journal</Text>
        <Text style={styles.subtitle}>
          {recording
            ? 'Listening — speak freely, any language'
            : phase === 'processing'
              ? 'Structuring your memories…'
              : 'Hindi, Kannada, Tamil, Telugu, English — ek saath bhi chalega'}
        </Text>

        <View style={styles.waveWrap}>
          <Waveform active={recording} />
        </View>

        <Pressable
          onPress={recording ? stop : start}
          disabled={phase === 'processing'}
          style={({ pressed }) => [
            styles.micBtn,
            { borderColor: recording ? C.danger : C.blue },
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

        {sessionAtoms.length > 0 ? <Text style={styles.feedTitle}>Extracted this session</Text> : null}
        {sessionAtoms.map((a) => (
          <AtomCard key={a.id} atom={a} eff={a.confidence} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 32 },
  title: { color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  subtitle: { color: C.textSecondary, fontSize: 12.5, textAlign: 'center', marginTop: 5, paddingHorizontal: 40, lineHeight: 17 },
  waveWrap: { marginTop: 22, marginBottom: 4 },
  micBtn: {
    alignSelf: 'center',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: C.card,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  micTxt: { color: C.text, fontSize: 15, fontWeight: '700' },
  error: { color: C.danger, fontSize: 12, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 },
  transcriptBox: {
    marginHorizontal: 20,
    marginTop: 22,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  transcriptLabel: { color: C.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 5 },
  transcript: { color: C.text, fontSize: 14.5, lineHeight: 20 },
  feedTitle: {
    color: C.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginHorizontal: 22,
    marginTop: 20,
    marginBottom: 8,
  },
});
