import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { useLogin } from '@/modules/auth/hooks';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { login, isPending, error } = useLogin();
  const router = useRouter();

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
        {error ? <Text className="text-sm text-text-primary">{error}</Text> : null}
        <Button
          label={isPending ? 'Ingresando' : 'Ingresar'}
          onPress={() => void onSubmit()}
          disabled={isPending || identifier.trim() === '' || password === ''}
        />
      </View>
    </View>
  );
}
