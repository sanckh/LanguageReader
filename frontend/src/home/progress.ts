import { weeklyChange } from './weeklyChange';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VocabularySnapshot } from '../interfaces/home';

export async function recordVocabulary(
  userId: string,
  language: string,
  known: number,
): Promise<number | null> {
  const key = `home-progress:${userId}:${language}`;
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  try {
    const raw: unknown = JSON.parse((await AsyncStorage.getItem(key)) ?? '[]');
    const history: VocabularySnapshot[] = Array.isArray(raw)
      ? raw.filter(
          (row) =>
            row && typeof row.day === 'string' && Number.isFinite(row.known),
        )
      : [];
    const delta = weeklyChange(history, known, now);
    await AsyncStorage.setItem(
      key,
      JSON.stringify(
        [...history.filter((row) => row.day !== day), { day, known }].slice(
          -35,
        ),
      ),
    );
    return delta;
  } catch {
    return null;
  }
}
