import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { useForgotPassword } from '@/modules/auth/hooks';
import { isValidEmail } from '@/modules/family/email';

// US-53 (#212): el enlace llega por mail y la contrasena nueva se elige en
// la pagina web de activacion. El mensaje es el mismo exista o no la cuenta.
export function ForgotPasswordView() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const forgot = useForgotPassword();

  const submit = () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setFormError('Email inválido. Revisá el formato.');
      return;
    }
    setFormError(null);
    forgot.mutate(trimmed, { onError: (err) => setFormError(err.message) });
  };

  if (forgot.isSuccess) {
    return (
      <View className="flex-1 justify-center gap-6 bg-bg-base p-6">
        <Text className="text-2xl font-semibold text-text-primary">Revisá tu correo</Text>
        <Text className="text-body leading-[22px] text-text-muted">
          Si {email.trim()} tiene una cuenta, te mandamos un enlace para elegir una contraseña nueva.
          Si no llega en unos minutos, revisá la carpeta de spam.
        </Text>
        <Button label="Volver al ingreso" variant="primary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center gap-8 bg-bg-base p-6">
      <View className="gap-2">
        <Text className="text-2xl font-semibold text-text-primary">Recuperar contraseña</Text>
        <Text className="text-body leading-[22px] text-text-muted">
          Cargá el email de tu cuenta y te mandamos un enlace para elegir una contraseña nueva.
        </Text>
      </View>
      <View className="gap-4">
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!forgot.isPending}
        />
        {formError ? (
          <Text accessibilityRole="alert" className="text-sm text-text-primary">
            {formError}
          </Text>
        ) : null}
        <Button
          label={forgot.isPending ? 'Enviando' : 'Enviar enlace'}
          variant="primary"
          onPress={submit}
          disabled={forgot.isPending || email.trim() === ''}
        />
        <Button label="Volver al ingreso" onPress={() => router.back()} disabled={forgot.isPending} />
      </View>
    </View>
  );
}
