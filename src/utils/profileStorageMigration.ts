import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyProfileId, type ProfileId } from '../config/profiles';

const SELECTED_USER_KEY = 'selected_user';
const MIGRATION_DONE_KEY = 'profile_id_migration_v1';

const LEGACY_EMOJI_PAIRS: [string, ProfileId][] = [
  ['diana', 'profile_1'],
  ['estefania', 'profile_2'],
];

export async function runProfileStorageMigrationIfNeeded(): Promise<void> {
  const done = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
  if (done === 'true') return;

  const rawUser = await AsyncStorage.getItem(SELECTED_USER_KEY);
  const migrated = migrateLegacyProfileId(rawUser);
  if (migrated && rawUser !== migrated) {
    await AsyncStorage.setItem(SELECTED_USER_KEY, migrated);
  }

  for (const [legacy, profileId] of LEGACY_EMOJI_PAIRS) {
    const legacyKey = `user_emoji_${legacy}`;
    const newKey = `user_emoji_${profileId}`;
    const legacyEmoji = await AsyncStorage.getItem(legacyKey);
    const newEmoji = await AsyncStorage.getItem(newKey);
    if (legacyEmoji && !newEmoji) {
      await AsyncStorage.setItem(newKey, legacyEmoji);
    }
    if (legacyEmoji) {
      await AsyncStorage.removeItem(legacyKey);
    }
  }

  await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'true');
}

export function parseStoredProfile(raw: string | null): ProfileId | null {
  return migrateLegacyProfileId(raw);
}
