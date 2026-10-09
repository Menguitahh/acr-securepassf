import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { SESSION_EXPIRED_MESSAGE } from '@/modules/auth/data';
import { useLogin } from '@/modules/auth/hooks';
import { useSessionStore } from '@/modules/auth/session-store';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { login, isPending, error } = useLogin();
  const router = useRouter();
  // Sin esto el guardia aparece en el login sin saber por que (#131).
  const expired = useSessionStore((state) => state.signOutReason === 'expired');
  const message = error ?? (expired ? SESSION_EXPIRED_MESSAGE : null);

  const onSubmit = async () => {
    const ok = await login(identifier, password);
    if (ok) router.replace('/');
  };

  return (
    <View className="flex-1 justify-center gap-8 bg-bg-base p-6">
      <Text className="text-2xl font-semibold text-text-primary">Securepass</Text>
      <View className="gap-4">
        <Input
          label="Email o telefono"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoComplete="username"
          editable={!isPending}
        />
        <Input
          label="Contrasena"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!isPending}
        />
        {message ? (
          <Text accessibilityRole="alert" className="text-sm text-text-primary">
            {message}
          </Text>
        ) : null}
        <Button
          label={isPending ? 'Ingresando' : 'Ingresar'}
          onPress={() => void onSubmit()}
          disabled={isPending || identifier.trim() === '' || password === ''}
        />
        <Button
          label="Olvidé mi contraseña"
          onPress={() => router.push('/(auth)/forgot-password')}
          disabled={isPending}
        />
      </View>
    </View>
  );
}
