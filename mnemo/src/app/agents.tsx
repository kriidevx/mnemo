import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '@/constants/mnemo-theme';
import { useHandoffLog, type HandoffEntry } from '@/lib/mnemo';

// The judges' window — live multi-agent orchestration feed. Every handoff,
// escalation, conflict mediation, and fallback the Antigravity layer performs.

const LEVEL_STYLE: Record<HandoffEntry['level'], { color: string; label: string }> = {
  info: { color: C.textSecondary, label: 'INFO' },
  handoff: { color: '#4A90D9', label: 'HANDOFF' },
  escalation: { color: '#FFA000', label: 'ESCALATE' },
  conflict: { color: '#FF453A', label: 'CONFLICT' },
  error: { color: '#FF453A', label: 'ERROR' },
  fallback: { color: '#FFD60A', label: 'FALLBACK' },
};

const AGENT_LABEL: Record<string, string> = {
  input: 'Input',
  listener: 'Listener',
  reasoner: 'Reasoner',
  generator: 'Generator',
  antigravity: 'Antigravity',
  'gemma-local': 'Gemma (device)',
  'flash-cloud': 'Flash (cloud)',
  'nb2-lite': 'NB2 Lite',
  'omni-flash': 'Omni Flash',
  tts: 'TTS',
  store: 'Memory Graph',
  user: 'You',
};

export default function AgentsScreen() {
  const entries = useHandoffLog((s) => s.entries);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Agent Orchestration</Text>
      <Text style={styles.subtitle}>
        Listener → Reasoner → Generator, coordinated by the Interactions API. Live.
      </Text>
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>No activity yet — capture a memory and watch the agents work.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const lv = LEVEL_STYLE[item.level];
            return (
              <View style={[styles.row, { borderLeftColor: lv.color }]}>
                <View style={styles.rowHead}>
                  <Text style={[styles.level, { color: lv.color }]}>{lv.label}</Text>
                  <Text style={styles.time}>
                    {new Date(item.ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.route}>
                  {AGENT_LABEL[item.from] ?? item.from}
                  <Text style={{ color: lv.color }}>  →  </Text>
                  {AGENT_LABEL[item.to] ?? item.to}
                </Text>
                <Text style={styles.action}>{item.action}</Text>
                {item.detail ? (
                  <Text style={styles.detail} numberOfLines={2}>
                    {item.detail}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  title: { color: C.text, fontSize: 24, fontWeight: '800', marginTop: 12, marginHorizontal: 20 },
  subtitle: { color: C.textSecondary, fontSize: 13, marginHorizontal: 20, marginTop: 2, marginBottom: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTxt: { color: C.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  list: { paddingBottom: 24 },
  row: {
    marginHorizontal: 16,
    marginVertical: 4,
    backgroundColor: 'rgba(28,28,30,0.8)',
    borderRadius: 14,
    borderLeftWidth: 3,
    padding: 12,
  },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  level: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  time: { color: C.textTertiary, fontSize: 10, fontVariant: ['tabular-nums'] },
  route: { color: C.text, fontSize: 13, fontWeight: '700' },
  action: { color: C.textSecondary, fontSize: 13, marginTop: 2 },
  detail: { color: C.textTertiary, fontSize: 11, marginTop: 3, fontStyle: 'italic' },
});
