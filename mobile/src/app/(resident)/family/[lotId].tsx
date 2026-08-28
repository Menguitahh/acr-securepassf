import { useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import type { components } from '@securepass/contracts';

import { Card } from '@/common/components/card';
import { ErrorState } from '@/common/components/error-state';
import { ScreenHeader } from '@/common/components/screen-header';
import { Spinner } from '@/common/components/spinner';
import { useSessionStore } from '@/modules/auth/session-store';
import { useFamilyMembers, useUpdateFamilyMember } from '@/modules/family/hooks';

export default function FamilyMembersScreen() {
  const { lotId } = useLocalSearchParams<{ lotId: string }>();
  const { data, isLoading, isError, error } = useFamilyMembers(lotId);
  const user = useSessionStore((state) => state.user);
  const updateMember = useUpdateFamilyMember(lotId ?? '');

  const lot = (user?.lots ?? []).find((item) => item.id === lotId);
  const isOwner = lot?.isOwner === true;

  if (isError) {
    return (
      <View className="flex-1 bg-bg-base">
        <ScreenHeader title={lotTitle(lot?.code)} back />
        <ErrorState
          message={`${error instanceof Error ? error.message : 'No se pudo cargar la unidad familiar.'} Volvé e intentá de nuevo.`}
        />
      </View>
    );
  }
  if (isLoading) return <View className="flex-1 bg-bg-base"><Spinner /></View>;

  const members = data ?? [];

  const confirmRemove = (memberId: string, fullName: string) => {
    Alert.alert(
      'Dar de baja',
      `¿Sacar a ${fullName} de la unidad familiar? Sus pases activos para este lote se revocan.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dar de baja',
          style: 'destructive',
          onPress: () => updateMember.mutate({ userId: memberId, patch: { active: false } }),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title={lotTitle(lot?.code)} back />
      <View className="flex-1 gap-8 px-6 pt-2">
        <View className="gap-3">
          <Card>
            <View className="gap-3">
              {members.length === 0 ? (
                <Text className="text-body leading-[22px] text-text-muted">
                  Todavia no hay miembros en este lote.
                </Text>
              ) : (
                members.map((member) => (
                  <MemberRow
                    key={member.userId ?? ''}
                    member={member}
                    isOwner={isOwner}
                    onToggleInvite={(next) =>
                      updateMember.mutate({
                        userId: member.userId ?? '',
                        patch: { canInvite: next },
                      })
                    }
                    onRemove={() => confirmRemove(member.userId ?? '', member.fullName ?? '')}
                  />
                ))
              )}
            </View>
          </Card>
        </View>

        {isOwner ? (
          // TODO(WBS-113): reescribir el formulario de alta para el contrato v2
          // (WBS-110). Cambios: pasa a pedir fullName + DNI + birthDate + email
          // (obligatorio si edad >= 16) + relation + canInvite; el back valida
          // AGE_UNDER_16 (redirect al padron de menores de WBS-111) y
          // EMAIL_REQUIRED; usar `outcome` del response para mostrar
          // "reactivaste a alguien dado de baja" vs "agregaste nuevo". El hook
          // useAddFamilyMember ya compila contra el tipo v2 en modules/family/hooks.ts.
          <View className="gap-3">
            <Card>
              <View className="gap-2">
                <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
                  Agregar miembro
                </Text>
                <Text className="text-body leading-[22px] text-text-primary">
                  Formulario en construcción (WBS-113). El backend ya acepta el
                  alta por DNI y edad; la pantalla la reescribimos en el próximo
                  PR del mobile de familia.
                </Text>
              </View>
            </Card>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MemberRow({
  member,
  isOwner,
  onToggleInvite,
  onRemove,
}: {
  member: components['schemas']['FamilyMemberResponse'];
  isOwner: boolean;
  onToggleInvite: (next: boolean) => void;
  onRemove: () => void;
}) {
  const inactive = member.active === false;

  return (
    <View className="gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="text-body font-semibold leading-[22px] text-text-primary">
            {member.fullName ?? 'Sin nombre'}
          </Text>
          <Text className="text-footnote leading-[18px] text-text-muted">
            {inactive ? 'Inactivo' : (member.email ?? member.phone ?? '')}
          </Text>
        </View>
        {member.isOwner ? (
          <Text className="rounded-full bg-bg-elevated px-2.5 py-1 text-footnote text-text-muted">
            Titular
          </Text>
        ) : isOwner && !inactive ? (
          <Switch
            value={member.canInvite ?? false}
            onValueChange={onToggleInvite}
            trackColor={{ false: '#27272a', true: '#fafafa' }}
            thumbColor={(member.canInvite ?? false) ? '#09090b' : '#a1a1aa'}
          />
        ) : null}
      </View>
      {isOwner && !member.isOwner && !inactive ? (
        <Pressable onPress={onRemove} hitSlop={8} className="self-start active:opacity-60">
          <Text className="text-footnote leading-[18px] text-text-muted">Dar de baja</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function lotTitle(code: string | undefined): string {
  return code ? `Lote ${code}` : 'Unidad familiar';
}
