import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { problemCode } from '@/common/api/problem';
import { useAddWorker } from '@/modules/worker/hooks';
import {
  FORM_ERROR_MESSAGES,
  toHHmm,
  validateWorkerForm,
} from '@/modules/worker/lib';
import {
  messageForAddOutcome,
  messageForConflictCode,
  toneForOutcome,
} from '@/modules/worker/messages';
import { WorkerScheduleFields } from '@/modules/worker/components/worker-schedule-fields';

type Props = {
  visible: boolean;
  onClose: () => void;
  lotId: string;
  onFeedback: (message: string, tone: 'success' | 'warning' | 'info') => void;
};

function defaultFrom(): Date {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d;
}

function defaultUntil(): Date {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  return d;
}

export function AddWorkerModal({ visible, onClose, lotId, onFeedback }: Props) {
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [from, setFrom] = useState<Date | null>(defaultFrom());
  const [until, setUntil] = useState<Date | null>(defaultUntil());
  const [formError, setFormError] = useState<string | null>(null);

  const addWorker = useAddWorker(lotId);
  const isPending = addWorker.isPending;

  const reset = () => {
    setFullName('');
    setDni('');
    setEmail('');
    setService('');
    setWeekdays([1, 2, 3, 4, 5]);
    setFrom(defaultFrom());
    setUntil(defaultUntil());
    setFormError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    setFormError(null);
    const err = validateWorkerForm({
      fullName,
      dni,
      email,
      service,
      weekdays,
      dailyFrom: from,
      dailyUntil: until,
    });
    if (err) {
      setFormError(FORM_ERROR_MESSAGES[err]);
      return;
    }
    // validateWorkerForm garantiza no-null despues de un pass limpio,
    // pero TS no lo puede inferir a traves del closure.
    if (!from || !until) return;
    addWorker.mutate(
      {
        fullName: fullName.trim(),
        dni: dni.trim(),
        email: email.trim(),
        service: service.trim(),
        weekdays,
        dailyFrom: toHHmm(from),
        dailyUntil: toHHmm(until),
      },
      {
        onSuccess: (result) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onFeedback(messageForAddOutcome(result), toneForOutcome(result.outcome));
          close();
        },
        onError: (serverError) => {
          const code = problemCode(serverError);
          if (code === 'USER_SUSPENDED' || code === 'USER_DELETED' || code === 'EMAIL_TAKEN') {
            setFormError(messageForConflictCode(code));
            return;
          }
          setFormError(
            serverError instanceof Error
              ? serverError.message
              : 'No se pudo habilitar el trabajador. Intentá de nuevo.',
          );
        },
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-bg-base">
        <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
          <Text className="text-title font-semibold text-text-primary">
            Habilitar trabajador
          </Text>
          <Pressable onPress={close} hitSlop={8}>
            <Text className="text-body text-text-muted">Cerrar</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-4">
          <View className="gap-3">
            <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
              Datos del trabajador
            </Text>
            <Input
              label="Nombre completo"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              editable={!isPending}
            />
            <Input
              label="DNI"
              value={dni}
              onChangeText={setDni}
              keyboardType="number-pad"
              editable={!isPending}
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isPending}
            />
            <Text className="text-footnote text-text-muted">
              El trabajador recibe un correo para activar su cuenta y ver su QR.
            </Text>
          </View>

          <WorkerScheduleFields
            service={service}
            onChangeService={setService}
            weekdays={weekdays}
            onChangeWeekdays={setWeekdays}
            from={from}
            until={until}
            onChangeFrom={setFrom}
            onChangeUntil={setUntil}
            disabled={isPending}
          />

          {formError ? (
            <Text className="text-body leading-[22px] text-text-primary">{formError}</Text>
          ) : null}

          <Button
            label={isPending ? 'Guardando' : 'Habilitar trabajador'}
            onPress={submit}
            disabled={isPending}
            variant="primary"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
