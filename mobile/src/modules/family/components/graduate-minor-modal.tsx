import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, ScrollView, Switch, Text, View } from 'react-native';

import type { components } from '@securepass/contracts';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { ModalHeader } from '@/common/components/modal-header';
import { isProblemDetail, problemCode } from '@/common/api/problem';
import { isValidEmail } from '@/modules/family/email';
import { useGraduateMinor } from '@/modules/family/minors-hooks';
import { messageForAddOutcome, messageForConflictCode } from '@/modules/family/messages';

/**
 * WBS-113: modal para graduar un menor a familiar con cuenta.
 *
 * Datos que aporta el titular: email (obligatorio, va a activacion),
 * relation (opcional, prefill del padron), canInvite (explicito).
 * `dniOverride` visible SOLO si el menor del padron no tiene DNI cargado
 * — en ese caso es obligatorio (WBS-110 requiere DNI para crear la cuenta).
 */

type Minor = components['schemas']['MinorResponse'];

type Props = {
  visible: boolean;
  onClose: () => void;
  lotId: string;
  minor: Minor | null;
  onFeedback: (message: string, tone: 'success' | 'warning' | 'info') => void;
};

export function GraduateMinorModal({ visible, onClose, lotId, minor, onFeedback }: Props) {
  // Prefill de relation: si el padron lo tiene, arranca cargado y editable
  // (no como placeholder en el label — silencioso). El caller garantiza
  // que este componente se remonta por `key={minor.id}` cuando cambia el
  // target, asi que el estado inicial no queda pegado entre menores.
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState(() => minor?.relation ?? '');
  const [canInvite, setCanInvite] = useState(true);
  const [dniOverride, setDniOverride] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const graduate = useGraduateMinor(lotId);
  const isPending = graduate.isPending;

  const dniInPadron = minor?.documentNumber ?? '';
  const needsDniOverride = dniInPadron.trim() === '';

  const close = () => {
    setEmail('');
    setRelation(minor?.relation ?? '');
    setCanInvite(true);
    setDniOverride('');
    setFormError(null);
    onClose();
  };

  const submit = () => {
    if (!minor?.id) return;
    setFormError(null);
    if (email.trim().length === 0) {
      setFormError('Email requerido para activar la cuenta.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setFormError('Email invalido. Revisá el formato.');
      return;
    }
    if (needsDniOverride && dniOverride.trim().length === 0) {
      setFormError('El menor no tiene DNI en el padrón. Ingresá el DNI para crear la cuenta.');
      return;
    }
    const trimmedRelation = relation.trim();
    graduate.mutate(
      {
        minorId: minor.id,
        body: {
          email: email.trim(),
          canInvite,
          ...(trimmedRelation !== '' ? { relation: trimmedRelation } : {}),
          ...(needsDniOverride ? { dniOverride: dniOverride.trim() } : {}),
        },
      },
      {
        onSuccess: (result) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const member = result.member;
          const tone =
            member?.outcome === 'REACTIVATED_PERMISSION'
              ? 'warning'
              : member?.outcome === 'ALREADY_MEMBER'
                ? 'info'
                : 'success';
          const msg = member
            ? `${minor.fullName ?? 'El menor'} graduado. ${messageForAddOutcome(member)}`
            : `${minor.fullName ?? 'El menor'} graduado.`;
          onFeedback(msg, tone);
          close();
        },
        onError: (err) => {
          const code = problemCode(err);
          if (code === 'USER_SUSPENDED' || code === 'USER_DELETED') {
            setFormError(messageForConflictCode(code));
            return;
          }
          if (code === 'EMAIL_REQUIRED') {
            setFormError('Email requerido para activar la cuenta.');
            return;
          }
          const detail = isProblemDetail(err)
            ? (err.detail ?? 'No se pudo graduar al menor.')
            : (err as Error)?.message ?? 'No se pudo graduar al menor.';
          setFormError(detail);
        },
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-bg-base">
        <ModalHeader title="Activar cuenta" onClose={close} />

        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-4">
          <Text className="text-body leading-[22px] text-text-primary">
            Vas a activar la cuenta de{' '}
            <Text className="font-semibold">{minor?.fullName ?? ''}</Text>
            {minor?.birthDate ? ` (nacido/a el ${new Date(minor.birthDate).toLocaleDateString('es-AR')})` : ''}.
            {' '}Se le envía un email de activación y sale del padrón de menores.
          </Text>

          <View className="gap-3">
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isPending}
            />
            {needsDniOverride ? (
              <Input
                label="DNI"
                value={dniOverride}
                onChangeText={setDniOverride}
                keyboardType="number-pad"
                editable={!isPending}
              />
            ) : (
              <Text className="text-footnote text-text-muted">DNI: {dniInPadron}</Text>
            )}
            <Input
              label="Parentesco (opcional)"
              value={relation}
              onChangeText={setRelation}
              editable={!isPending}
            />
            <View className="flex-row items-center justify-between pt-2">
              <View className="flex-1 pr-3">
                <Text className="text-body leading-[22px] text-text-primary">Puede invitar</Text>
                <Text className="text-footnote text-text-muted">
                  Si prendés esto, va a poder crear invitaciones para este lote.
                </Text>
              </View>
              <Switch
                value={canInvite}
                onValueChange={setCanInvite}
                trackColor={{ false: '#27272a', true: '#fafafa' }}
                thumbColor={canInvite ? '#09090b' : '#a1a1aa'}
                disabled={isPending}
              />
            </View>
          </View>

          {formError ? (
            <Text className="text-body leading-[22px] text-text-primary">{formError}</Text>
          ) : null}

          <Button
            label={isPending ? 'Activando' : 'Activar cuenta'}
            onPress={submit}
            disabled={isPending}
            variant="primary"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
