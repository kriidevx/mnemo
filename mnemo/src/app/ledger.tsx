import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAtomSheet } from '@/components/atom-sheet';
import { C } from '@/constants/mnemo-theme';
import { financialLedger, useMemoryStore } from '@/lib/mnemo';

// Financial Memory (prototype "Ledger" tab): owe/owed totals + ledger rows.
// Entirely on-device — money never touches the cloud.

export default function LedgerScreen() {
  const atoms = useMemoryStore((s) => s.atoms);
  const openSheet = useAtomSheet((s) => s.open);
  // log: false — financialLedger's handoff() writes a store; not allowed mid-render.
  const { iOwe, owedToMe, unclassified } = useMemo(() => financialLedger(atoms, false), [atoms]);

  const oweTotal = iOwe.reduce((sum, a) => sum + (a.entities.money?.amount ?? 0), 0);
  const owedTotal = owedToMe.reduce((sum, a) => sum + (a.entities.money?.amount ?? 0), 0);
  const rows = [
    ...iOwe.map((a) => ({ a, dir: '→' as const, color: C.danger })),
    ...owedToMe.map((a) => ({ a, dir: '←' as const, color: C.success })),
    ...unclassified.map((a) => ({ a, dir: '·' as const, color: C.textTertiary })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Financial Memory</Text>
        <Text style={styles.subtitle}>On-device only — money never touches the cloud</Text>

        <View style={styles.totals}>
          <View style={styles.totalCol}>
            <Text style={styles.totalLabel}>YOU OWE</Text>
            <Text style={[styles.totalNum, { color: C.danger }]}>₹{oweTotal.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalCol}>
            <Text style={styles.totalLabel}>OWED TO YOU</Text>
            <Text style={[styles.totalNum, { color: C.success }]}>₹{owedTotal.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ledger</Text>
        {rows.length === 0 ? (
          <Text style={styles.empty}>
            No financial memories yet. Mention money in a capture — "I owe Rohan ₹460" — and it lands here.
          </Text>
        ) : (
          rows.map(({ a, dir, color }) => (
            <Pressable
              key={a.id}
              onPress={() => openSheet(a.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Text style={[styles.dir, { color }]}>{dir}</Text>
              <Text style={styles.content} numberOfLines={2}>{a.content}</Text>
              {a.entities.money?.amount != null ? (
                <Text style={styles.amount}>₹{a.entities.money.amount.toLocaleString('en-IN')}</Text>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 28 },
  title: { color: C.text, fontSize: 22, fontWeight: '800', marginTop: 12, marginHorizontal: 20 },
  subtitle: { color: C.textSecondary, fontSize: 12.5, marginHorizontal: 20, marginTop: 3 },
  totals: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  totalCol: { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 },
  totalDivider: { width: 1, backgroundColor: C.cardBorder },
  totalLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: C.textTertiary },
  totalNum: { fontSize: 24, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  sectionTitle: {
    color: C.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginHorizontal: 22,
    marginTop: 18,
    marginBottom: 8,
  },
  empty: { color: C.textSecondary, fontSize: 13.5, lineHeight: 19, marginHorizontal: 22, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  dir: { fontSize: 16, fontWeight: '800' },
  content: { flex: 1, fontSize: 13.5, color: C.text, lineHeight: 18 },
  amount: { fontSize: 14, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.7 },
});
