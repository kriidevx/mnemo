import { create } from 'zustand';
import { MODELS } from './models';

// The Antigravity Interactions API layer. Routes tasks between the three agents,
// logs every handoff so orchestration is VISIBLE to judges, mediates conflicts,
// and escalates low-confidence on-device extractions to cloud.

export type AgentName =
  | 'input'
  | 'listener'
  | 'reasoner'
  | 'generator'
  | 'antigravity'
  | 'gemma-local'
  | 'flash-cloud'
  | 'nb2-lite'
  | 'omni-flash'
  | 'tts'
  | 'store'
  | 'user';

export interface HandoffEntry {
  id: string;
  ts: number;
  from: AgentName;
  to: AgentName;
  action: string;
  detail?: string;
  level: 'info' | 'handoff' | 'escalation' | 'conflict' | 'error' | 'fallback';
}

interface HandoffLogState {
  entries: HandoffEntry[];
  log: (e: Omit<HandoffEntry, 'id' | 'ts'>) => void;
  clear: () => void;
}

export const useHandoffLog = create<HandoffLogState>((set) => ({
  entries: [],
  log: (e) =>
    set((s) => ({
      entries: [
        { ...e, id: Math.random().toString(36).slice(2), ts: Date.now() },
        ...s.entries,
      ].slice(0, 200),
    })),
  clear: () => set({ entries: [] }),
}));

/** Shorthand used across agents. */
export function handoff(
  from: AgentName,
  to: AgentName,
  action: string,
  detail?: string,
  level: HandoffEntry['level'] = 'handoff'
) {
  useHandoffLog.getState().log({ from, to, action, detail, level });
}

/**
 * Task splitting for multi-stage pipelines (e.g. recap video).
 * Each step waits for the previous, with timeout + fallback — mirrors the
 * Antigravity orchestration flow. Returns partial results on failure so
 * the Generator can degrade gracefully instead of dying.
 */
export async function runPipeline<T extends Record<string, unknown>>(
  pipelineName: string,
  steps: {
    name: string;
    agent: AgentName;
    run: (acc: Partial<T>) => Promise<Partial<T>>;
    timeoutMs?: number;
    fallback?: (acc: Partial<T>) => Partial<T>;
  }[]
): Promise<{ result: Partial<T>; failedSteps: string[] }> {
  handoff('antigravity', 'antigravity', `split task: ${pipelineName}`, `${steps.length} steps`, 'info');
  let acc: Partial<T> = {};
  const failedSteps: string[] = [];
  for (const step of steps) {
    handoff('antigravity', step.agent, `step: ${step.name}`);
    try {
      const out = await withTimeout(step.run(acc), step.timeoutMs ?? 120_000);
      acc = { ...acc, ...out };
      handoff(step.agent, 'antigravity', `done: ${step.name}`);
    } catch (err) {
      failedSteps.push(step.name);
      const msg = err instanceof Error ? err.message : String(err);
      if (step.fallback) {
        handoff(step.agent, 'antigravity', `failed: ${step.name} → fallback`, msg, 'fallback');
        acc = { ...acc, ...step.fallback(acc) };
      } else {
        handoff(step.agent, 'antigravity', `failed: ${step.name} (no fallback, continuing)`, msg, 'error');
      }
    }
  }
  return { result: acc, failedSteps };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

export const ANTIGRAVITY_MODEL = MODELS.antigravity;
