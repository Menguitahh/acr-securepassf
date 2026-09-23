import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { components } from '@securepass/contracts';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { useUpdateWorker } from '@/modules/worker/hooks';
import {
  FORM_ERROR_MESSAGES,
  fromHHmm,
  toHHmm,
  validateWorkerSchedule,
} from '@/modules/worker/lib';
import {
  messageForUpdateOutcome,
  toneForUpdateOutcome,
} from '@/modules/worker/messages';
import { WorkerScheduleFields } from '@/modules/worker/components/worker-schedule-fields';

type Worker = components['schemas']['WorkerResponse'];

type Props = {
  visible: boolean;
  onClose: () => void;
  lotId: string;
  worker: Worker | null;
  onFeedback: (message: string, tone: 'success' | 'warning' | 'info') => void;
};

// Modal desmontable via `key={worker.userId}` desde el padre para que el
// prefill del useState corra con cada trabajador sin useEffect de sync.
export function EditWorkerModal({ visible, onClose, lotId, worker, onFeedback }: Props) {
  if (!worker) return null;
  return (
    <EditWorkerModalInner
      visible={visible}
      onClose={onClose}
      lotId={lotId}
      worker={worker}
      onFeedback={onFeedback}
    />
  );
}

function EditWorkerModalInner({
  visible,
  onClose,
  lotId,
  worker,
  onFeedback,
}: Props & { worker: Worker }) {
  const inactive = worker.active === false;
  const userId = worker.userId ?? '';

  const [service, setService] = useState(worker.service ?? '');
  const [weekdays, setWeekdays] = useState<number[]>((worker.weekdays ?? []).slice().sort((a, b) => a - b));
  const [from, setFrom] = useState<Date | null>(worker.dailyFrom ? fromHHmm(worker.dailyFrom) : null);
  const [until, setUntil] = useState<Date | null>(worker.dailyUntil ? fromHHmm(worker.dailyUntil) : null);
  const [formError, setFormError] = useState<string | null>(null);

  const updateWorker = useUpdateWorker(lotId, userId);
  const isPending = updateWorker.isPending;
  const disabled = inactive || isPending;

  const deactivate = () => {
    if (inactive) return;
    setFormError(null);
    updateWorker.mutate(
      { active: false },
      {
        onSuccess: (result) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onFeedback(messageForUpdateOutcome(result), toneForUpdateOutcome(result.outcome));
          onClose();
        },
        onError: (serverError) => {
          setFormError(
            serverError instanceof Error
              ? serverError.message
              : 'No se pudo dar de baja al trabajador. Intentá de nuevo.',
          );
        },
      },
    );
  };

  const confirmDeactivate = () => {
    Alert.alert(
      'Dar de baja al trabajador',
      // El copy no menciona como reactivar: eso va en el banner del
      // inactivo, no aca. Nombrarlo en la confirmacion ablanda la
      // decision. El "si no trabaja en otros lotes" refleja el
      // aislamiento cross-lote real del server (revocacion del JTI
      // solo cuando countActiveByUser llega a 0).
      `¿Sacar a ${worker.fullName ?? 'este trabajador'} de este lote? Si no trabaja en otros lotes del barrio, su QR queda revocado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Dar de baja', style: 'destructive', onPress: deactivate },
      ],
    );
  };

  const submit = () => {
    if (inactive) return;
    setFormError(null);
    const err = validateWorkerSchedule({ service, weekdays, dailyFrom: from, dailyUntil: until });
    if (err) {
      setFormError(FORM_ERROR_MESSAGES[err]);
      return;
    }
    if (!from || !until) return;
    // El PATCH exige los cuatro campos siempre, aunque el titular haya
    // tocado solo uno. UpdateWorkerRequest los tiene como opcionales
    // pero el server valida el bundle completo (scheduleBundled).
    updateWorker.mutate(
      {
        service: service.trim(),
        weekdays,
        dailyFrom: toHHmm(from),
        dailyUntil: toHHmm(until),
      },
      {
        onSuccess: (result) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onFeedback(messageForUpdateOutcome(result), toneForUpdateOutcome(result.outcome));
          onClose();
        },
        onError: (serverError) => {
          setFormError(
            serverError instanceof Error
              ? serverError.message
              : 'No se pudieron guardar los cambios. Intentá de nuevo.',
          );
        },
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-bg-base">
        <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
          <Text className="text-title font-semibold text-text-primary">
            Editar trabajador
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="text-body text-text-muted">Cerrar</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-4">
          {inactive ? (
            <View className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
              <Text className="text-body leading-[22px] text-text-primary">
                Trabajador inactivo. Para reactivarlo, usá + Agregar con sus datos.
              </Text>
            </View>
          ) : null}

          <View className="gap-3">
            <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
              Datos del trabajador
            </Text>
            <Input label="Nombre completo" value={worker.fullName ?? ''} editable={false} />
            <Input label="DNI" value={worker.documentNumber ?? ''} editable={false} />
            <Input label="Email" value={worker.email ?? ''} editable={false} />
            <Text className="text-footnote text-text-muted">
              Nombre, DNI y email no se editan desde acá.
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
            disabled={disabled}
          />

          {formError ? (
            <Text className="text-body leading-[22px] text-text-primary">{formError}</Text>
          ) : null}

          <Button
            label={isPending ? 'Guardando' : 'Guardar cambios'}
            onPress={submit}
            disabled={disabled}
            variant="primary"
          />

          {inactive ? null : (
            <Pressable
              onPress={confirmDeactivate}
              disabled={isPending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dar de baja al trabajador"
              className="self-center py-2 active:opacity-60 disabled:opacity-40"
            >
              <Text className="text-footnote leading-[18px] text-text-muted">
                Dar de baja
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
