import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { LogoutButton } from '@/common/components/logout-button';
import { ScreenHeader } from '@/common/components/screen-header';
import { ROLE_LABELS } from '@/modules/auth/data';
import { initials } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';

export default function ProfileScreen() {
  const user = useSessionStore((state) => state.user);
  const router = useRouter();

  if (!user) return null;

  const rolesLabel = user.roles.map((role) => ROLE_LABELS[role] ?? role).join(', ');

  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Perfil" back />
      <Animated.View
        entering={FadeInDown.duration(300).reduceMotion(ReduceMotion.System)}
        className="flex-1 gap-8 px-6 pt-4"
      >
        <View className="items-center gap-3 pt-2">
          <View className="h-16 w-16 items-center justify-center rounded-full border border-border bg-bg-elevated">
            <Text className="text-title font-semibold leading-[28px] text-text-primary">
              {initials(user.fullName)}
            </Text>
          </View>
          <Text className="text-title font-semibold leading-[28px] text-text-primary">
            {user.fullName}
          </Text>
        </View>

        <View className="gap-3 rounded-lg border border-border bg-bg-surface p-5">
          <ProfileRow label="Rol" value={rolesLabel} />
        </View>

        <View className="gap-3 rounded-lg border border-border bg-bg-surface p-5">
          <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
            Lotes
          </Text>
          {user.lots.length === 0 ? (
            <Text className="text-body leading-[22px] text-text-muted">Sin lote asignado.</Text>
          ) : (
            user.lots.map((lot) => (
              <Pressable
                key={lot.id ?? lot.code}
                accessibilityRole="button"
                accessibilityLabel={`Unidad familiar del lote ${lot.code ?? ''}`}
                onPress={() =>
                  router.push({
                    pathname: '/(resident)/family/[lotId]',
                    params: { lotId: lot.id ?? '' },
                  })
                }
                className="flex-row items-center justify-between active:opacity-70"
              >
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-body leading-[22px] text-text-primary">
                    {lot.code ?? lot.id}
                  </Text>
                  <Text className="text-footnote leading-[18px] text-text-muted">
                    {lot.isOwner ? 'Titular' : 'Miembro'}
                  </Text>
                </View>
                <Text className="text-body leading-[22px] text-text-muted">{'>'}</Text>
              </Pressable>
            ))
          )}
        </View>

        <View className="mt-auto pb-10">
          <LogoutButton />
        </View>
      </Animated.View>
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-1">
      <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
        {label}
      </Text>
      <Text className="text-body leading-[22px] text-text-primary">{value}</Text>
    </View>
  );
}
