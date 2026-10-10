import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoutButton } from '@/common/components/logout-button';
import { useCurrentShift } from '@/modules/shifts/hooks';
import { elapsedMinutes, formatElapsed, isOpenShift } from '@/modules/shifts/lib';

const MINUTE_MS = 60_000;

// Encabezado de la garita: el turno a la izquierda (lleva a la pantalla de
// Turno) y "Salir" a la derecha, lejos de las acciones de abajo para que no
// se toque por error.
export function GuardHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shift = useCurrentShift();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(id);
  }, []);

  const current = isOpenShift(shift.data) ? shift.data : null;
  const open = current !== null;
  const minutes = current ? elapsedMinutes(current.startedAt, now) : null;
  // #204: sin red y sin turno guardado no se sabe si hay turno.
  const unknown = shift.isError && shift.data === undefined;
  const label = open
    ? `Turno · ${minutes === null ? 'abierto' : formatElapsed(minutes)}`
    : unknown
      ? 'Turno sin confirmar'
      : 'Sin turno';

  return (
    <View
      className="flex-row items-center justify-between gap-3 bg-bg-base px-4 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? `${label}. Ver turno` : 'Sin turno. Abrir turno'}
        onPress={() => router.push('/(guard)/shifts')}
        className="min-h-12 flex-row items-center gap-2 rounded-full border border-border bg-bg-surface px-4 active:opacity-70"
      >
        <Ionicons name="time-outline" size={20} color="#fafafa" />
        <Text className="text-base font-semibold text-text-primary">{label}</Text>
        <Ionicons name="chevron-forward" size={16} color="#a1a1aa" />
      </Pressable>
      <LogoutButton compact />
    </View>
  );
}
