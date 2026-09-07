import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { isSessionUser } from '@/modules/auth/lib';
import type { SessionUser } from '@/modules/auth/types';

const ACCESS_TOKEN_KEY = 'securepass.access-token';
const REFRESH_TOKEN_KEY = 'securepass.refresh-token';
const USER_KEY = 'securepass.user';

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function saveUser(user: SessionUser): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function saveSession(
  tokens: StoredTokens,
  user: SessionUser,
): Promise<void> {
  await Promise.all([saveTokens(tokens), saveUser(user)]);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function loadSession(): Promise<{
  tokens: StoredTokens;
  user: SessionUser;
} | null> {
  const [tokens, rawUser] = await Promise.all([loadTokens(), AsyncStorage.getItem(USER_KEY)]);
  if (!tokens || !rawUser) return null;

  let user: unknown;
  try {
    user = JSON.parse(rawUser);
  } catch {
    return null;
  }
  // Sesiones persistidas antes de securepassb#155 no traen el campo; se
  // rellena antes del narrow para que el tipo satisfaga SessionUser.
  if (
    typeof user === 'object' &&
    user !== null &&
    !('neighborhoodTimezone' in user)
  ) {
    (user as { neighborhoodTimezone: string | null }).neighborhoodTimezone = null;
  }
  if (!isSessionUser(user)) return null;
  return { tokens, user };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    AsyncStorage.removeItem(USER_KEY),
  ]);
}
