import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import type { components } from '@securepass/contracts';

import { Card } from '@/common/components/card';
import { ErrorState } from '@/common/components/error-state';
import { ScreenHeader } from '@/common/components/screen-header';
import { Spinner } from '@/common/components/spinner';
import { useSessionStore } from '@/modules/auth/session-store';
import { useFamilyMembers, useUpdateFamilyMember } from '@/modules/family/hooks';
import { useMinors, useDeleteMinor } from '@/modules/family/minors-hooks';
import { computeAgeYears } from '@/modules/family/age';
import { messageForReactivation, messageForUpdateOutcome } from '@/modules/family/messages';
import { AddPersonModal } from '@/modules/family/components/add-person-modal';
import { GraduateMinorModal } from '@/modules/family/components/graduate-minor-modal';

type Feedback = { message: string; tone: 'success' | 'warning' | 'info' } | null;

type FamilyMember = components['schemas']['FamilyMemberResponse'];
type Minor = components['schemas']['MinorResponse'];

export default function FamilyMembersScreen() {
  const { lotId: rawLotId } = useLocalSearchParams<{ lotId: string }>();
  const lotId = rawLotId ?? '';

  const membersQ = useFamilyMembers(lotId);
  const minorsQ = useMinors(lotId);
  const user = useSessionStore((state) => state.user);
  const updateMember = useUpdateFamilyMember(lotId);
  const deleteMinor = useDeleteMinor(lotId);

  const lot = (user?.lots ?? []).find((item) => item.id === lotId);
  const isOwner = lot?.isOwner === true;

  const [feedback, setFeedback] = useState<Feedback>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [graduateTarget, setGraduateTarget] = useState<Minor | null>(null);

  const showFeedback = (message: string, tone: 'success' | 'warning' | 'info' = 'success') => {
    setFeedback({ message, tone });
  };

  if (membersQ.isError || minorsQ.isError) {
    const err = membersQ.error ?? minorsQ.error;
    return (
      <View className="flex-1 bg-bg-base">
        <ScreenHeader title={lotTitle(lot?.code)} back />
        <ErrorState
          message={`${err instanceof Error ? err.message : 'No se pudo cargar la unidad familiar.'} Volvé e intentá de nuevo.`}
        />
      </View>
    );
  }
  if (membersQ.isLoading || minorsQ.isLoading) {
    return <View className="flex-1 bg-bg-base"><Spinner /></View>;
  }

  const members = membersQ.data ?? [];
  const minors = minorsQ.data ?? [];

  const confirmRemoveMember = (memberId: string, fullName: string) => {
    Alert.alert(
      'Dar de baja',
      `¿Sacar a ${fullName} de la unidad familiar? Sus pases activos para este lote se revocan.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dar de baja',
          style: 'destructive',
          onPress: () =>
            updateMember.mutate(
              { userId: memberId, patch: { active: false } },
              {
                onSuccess: (result) => showFeedback(messageForUpdateOutcome(result), 'warning'),
              },
            ),
        },
      ],
    );
  };

  const confirmReactivateMember = (memberId: string, fullName: string) => {
    Alert.alert(
      'Reactivar acceso',
      `¿Devolver el acceso al lote a ${fullName}? El permiso para invitar arranca desactivado; podés cambiarlo con el switch después.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reactivar',
          onPress: () =>
            // Reset explicito de canInvite: la baja pudo haber sido por abuso
            // del permiso, devolverlo en silencio no es aceptable. El titular
            // habilita con el switch si corresponde. Ver #63.
            updateMember.mutate(
              { userId: memberId, patch: { active: true, canInvite: false } },
              {
                onSuccess: () => showFeedback(messageForReactivation(fullName), 'success'),
              },
            ),
        },
      ],
    );
  };

  const confirmDeleteMinor = (minor: Minor) => {
    Alert.alert(
      'Borrar del padrón',
      `¿Sacar a ${minor.fullName ?? 'este menor'} del padrón?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () =>
            deleteMinor.mutate(minor.id ?? '', {
              onSuccess: () =>
                showFeedback(`${minor.fullName ?? 'El menor'} borrado del padrón.`, 'warning'),
            }),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title={lotTitle(lot?.code)} back />
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-2 pb-12">

        {feedback ? (
          <FeedbackBanner
            feedback={feedback}
            onDismiss={() => setFeedback(null)}
          />
        ) : null}

        <SectionHeader
          title="Familiares"
          actionLabel={isOwner ? '+ Agregar' : null}
          onAction={() => setAddOpen(true)}
        />
        <Card>
          {members.length === 0 ? (
            <Text className="text-body leading-[22px] text-text-muted">
              Todavia no hay familiares con cuenta en este lote.
            </Text>
          ) : (
            <View className="gap-3">
              {members.map((m) => (
                <MemberRow
                  key={m.userId ?? ''}
                  member={m}
                  isOwner={isOwner}
                  onToggleInvite={(next) =>
                    updateMember.mutate(
                      { userId: m.userId ?? '', patch: { canInvite: next } },
                      { onSuccess: (r) => showFeedback(messageForUpdateOutcome(r), 'info') },
                    )
                  }
                  onRemove={() => confirmRemoveMember(m.userId ?? '', m.fullName ?? '')}
                  onReactivate={() =>
                    confirmReactivateMember(m.userId ?? '', m.fullName ?? 'Este familiar')
                  }
                />
              ))}
            </View>
          )}
        </Card>

        <SectionHeader title="Menores del padrón" />
        <Card>
          {minors.length === 0 ? (
            <Text className="text-body leading-[22px] text-text-muted">
              Sin menores en el padrón. Los menores de 16 no reciben cuenta ni QR;
              quedan registrados en el lote y se activan cuando cumplen la edad.
            </Text>
          ) : (
            <View className="gap-3">
              {minors.map((m) => (
                <MinorRow
                  key={m.id ?? ''}
                  minor={m}
                  isOwner={isOwner}
                  onGraduate={() => setGraduateTarget(m)}
                  onDelete={() => confirmDeleteMinor(m)}
                />
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

      {isOwner ? (
        <AddPersonModal
          visible={addOpen}
          onClose={() => setAddOpen(false)}
          lotId={lotId}
          onFeedback={showFeedback}
        />
      ) : null}
      {isOwner ? (
        // key={target.id}: remontar el modal cuando cambia el menor a
        // graduar, para que el prefill del useState inicial reciba el
        // relation correcto sin necesidad de un useEffect (que la lint
        // rule prohibe por cascading renders).
        <GraduateMinorModal
          key={graduateTarget?.id ?? 'none'}
          visible={graduateTarget !== null}
          onClose={() => setGraduateTarget(null)}
          lotId={lotId}
          minor={graduateTarget}
          onFeedback={showFeedback}
        />
      ) : null}
    </View>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string | null;
  onAction?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} className="active:opacity-60">
          <Text className="text-body font-semibold text-text-primary">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FeedbackBanner({
  feedback,
  onDismiss,
}: {
  feedback: NonNullable<Feedback>;
  onDismiss: () => void;
}) {
  const bg =
    feedback.tone === 'warning'
      ? 'bg-yellow-900/40 border-yellow-800'
      : feedback.tone === 'info'
        ? 'bg-bg-elevated border-border'
        : 'bg-green-900/40 border-green-800';
  return (
    <View className={`gap-2 rounded-xl border px-4 py-3 ${bg}`}>
      <Text className="text-body leading-[22px] text-text-primary">{feedback.message}</Text>
      <Pressable onPress={onDismiss} hitSlop={8} className="self-end active:opacity-60">
        <Text className="text-footnote text-text-muted">Cerrar</Text>
      </Pressable>
    </View>
  );
}

function MemberRow({
  member,
  isOwner,
  onToggleInvite,
  onRemove,
  onReactivate,
}: {
  member: FamilyMember;
  isOwner: boolean;
  onToggleInvite: (next: boolean) => void;
  onRemove: () => void;
  onReactivate: () => void;
}) {
  const inactive = member.active === false;
  const relation = member.relation && !member.isOwner ? ` · ${member.relation}` : '';

  return (
    <View className="gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="text-body font-semibold leading-[22px] text-text-primary">
            {member.fullName ?? 'Sin nombre'}
            {relation}
          </Text>
          <Text className="text-footnote leading-[18px] text-text-muted">
            {inactive ? 'Inactivo' : (member.email ?? member.phone ?? '')}
          </Text>
        </View>
        {member.isOwner ? (
          <Text className="rounded-full bg-bg-elevated px-2.5 py-1 text-footnote text-text-muted">
            Titular
          </Text>
        ) : inactive ? null : isOwner ? (
          <Switch
            value={member.canInvite ?? false}
            onValueChange={onToggleInvite}
            trackColor={{ false: '#27272a', true: '#fafafa' }}
            thumbColor={(member.canInvite ?? false) ? '#09090b' : '#a1a1aa'}
          />
        ) : (
          // US-60: modo lectura. Icono readonly para que el familiar vea
          // quien puede invitar, sin poder tocarlo.
          <Text className="rounded-full bg-bg-elevated px-2.5 py-1 text-footnote text-text-muted">
            {member.canInvite ? 'Puede invitar' : 'No invita'}
          </Text>
        )}
      </View>
      {isOwner && !member.isOwner ? (
        inactive ? (
          <Pressable onPress={onReactivate} hitSlop={8} className="self-start active:opacity-60">
            <Text className="text-footnote font-semibold leading-[18px] text-text-primary">
              Reactivar
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={onRemove} hitSlop={8} className="self-start active:opacity-60">
            <Text className="text-footnote leading-[18px] text-text-muted">Dar de baja</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

function MinorRow({
  minor,
  isOwner,
  onGraduate,
  onDelete,
}: {
  minor: Minor;
  isOwner: boolean;
  onGraduate: () => void;
  onDelete: () => void;
}) {
  const age = minor.birthDate ? safeAge(minor.birthDate) : null;
  const readyToGraduate = age !== null && age >= 16;
  const relation = minor.relation ? ` · ${minor.relation}` : '';

  return (
    <View className="gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="text-body font-semibold leading-[22px] text-text-primary">
            {minor.fullName ?? 'Sin nombre'}
            {relation}
          </Text>
          <Text className="text-footnote leading-[18px] text-text-muted">
            {age !== null ? `${age} años` : 'Edad desconocida'}
            {minor.documentNumber ? ` · DNI ${minor.documentNumber}` : ''}
            {minor.notes ? ` · ${minor.notes}` : ''}
          </Text>
        </View>
      </View>
      {readyToGraduate ? (
        <View className="flex-row items-center gap-2">
          <Text className="rounded-full bg-yellow-900/60 px-2.5 py-1 text-footnote text-yellow-100">
            Cumplió 16
          </Text>
          {isOwner ? (
            <Pressable onPress={onGraduate} hitSlop={8} className="active:opacity-60">
              <Text className="text-footnote font-semibold text-text-primary">Activar cuenta</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {isOwner ? (
        <Pressable onPress={onDelete} hitSlop={8} className="self-start active:opacity-60">
          <Text className="text-footnote leading-[18px] text-text-muted">Borrar del padrón</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function safeAge(birthDate: string): number | null {
  try {
    return computeAgeYears(birthDate);
  } catch {
    return null;
  }
}

function lotTitle(code: string | undefined): string {
  return code ? `Lote ${code}` : 'Unidad familiar';
}
