import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleGenAI } from '@google/genai';

const KEY_STORAGE = 'mnemo.gemini_api_key';

let cachedKey: string | null = null;
let client: GoogleGenAI | null = null;

export async function getApiKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (envKey) {
    cachedKey = envKey;
    return envKey;
  }
  const stored = await AsyncStorage.getItem(KEY_STORAGE);
  cachedKey = stored;
  return stored;
}

export async function setApiKey(key: string): Promise<void> {
  cachedKey = key.trim() || null;
  client = null;
  if (cachedKey) await AsyncStorage.setItem(KEY_STORAGE, cachedKey);
  else await AsyncStorage.removeItem(KEY_STORAGE);
}

/** Lazy singleton — never construct at module scope (env may be absent at bundle eval). */
export async function getGenAI(): Promise<GoogleGenAI | null> {
  if (client) return client;
  const key = await getApiKey();
  if (!key) return null;
  client = new GoogleGenAI({ apiKey: key });
  return client;
}

export async function cloudAvailable(): Promise<boolean> {
  return (await getApiKey()) != null;
}
