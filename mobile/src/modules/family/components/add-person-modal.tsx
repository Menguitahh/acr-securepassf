import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { isProblemDetail, problemCode } from '@/common/api/problem';
import { useAddFamilyMember } from '@/modules/family/hooks';
import { useRegisterMinor } from '@/modules/family/minors-hooks';
import { computeAgeYears } from '@/modules/family/age';
import { messageForAddOutcome, messageForConflictCode } from '@/modules/family/messages';

/**
 * WBS-113: modal unico de alta. El titular ingresa nombre y fecha de
 * nacimiento; segun la edad el formulario ramifica:
 *   - >= 16: familiar (POST /members) con email obligatorio + canInvite.
 *   - <  16: menor (POST /minors) con DNI opcional + notas.
 *
 * Cliente-first (mejor UX, no gasta round-trip para un calculo trivial),
 * server como red: si el cliente se equivoca y manda al endpoint erroneo,
 * el back devuelve AGE_UNDER_16/AGE_OVER_16 con redirectTo. Aca lo
 * capturamos y re-ramificamos automaticamente sin perder los datos.
 */

type Props = {
  visible: boolean;
  onClose: () => void;
  lotId: string;
  onFeedback: (message: string, tone: 'success' | 'warning' | 'info') => void;
};

function todayIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultBirth(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 20);
  return d;
}

export function AddPersonModal({ visible, onClose, lotId, onFeedback }: Props) {
  const [fullName, setFullName] = useState('');
  const [birth, setBirth] = useState<Date>(defaultBirth);
  const [showPicker, setShowPicker] = useState(false);
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('');
  const [notes, setNotes] = useState('');
  const [canInvite, setCanInvite] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const addFamily = useAddFamilyMember(lotId);
  const registerMinor = useRegisterMinor(lotId);
  const isPending = addFamily.isPending || registerMinor.isPending;

  const age = useMemo(() => computeAgeYears(todayIsoLocal(birth)), [birth]);
  const isMinor = age < 16;

  const reset = () => {
    setFullName('');
    setBirth(defaultBirth());
    setDni('');
    setEmail('');
    setRelation('');
    setNotes('');
    setCanInvite(true);
    setFormError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    setFormError(null);
    if (fullName.trim().length === 0) {
      setFormError('Nombre completo requerido.');
      return;
    }
    const birthDate = todayIsoLocal(birth);

    if (isMinor) {
      registerMinor.mutate(
        {
          fullName: fullName.trim(),
          birthDate,
          ...(dni.trim() !== '' && { documentNumber: dni.trim() }),
          ...(relation.trim() !== '' && { relation: relation.trim() }),
          ...(notes.trim() !== '' && { notes: notes.trim() }),
        },
        {
          onSuccess: (created) => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onFeedback(
              `${created.fullName ?? 'El menor'} agregado al padrón del lote.`,
              'success',
            );
            close();
          },
          onError: (err) => handleServerBranchBack(err, /*fromMinor*/ true),
        },
      );
      return;
    }

    if (dni.trim().length === 0) {
      setFormError('DNI requerido para dar de alta un familiar mayor de 16.');
      return;
    }
    if (email.trim().length === 0) {
      setFormError('Email requerido para dar de alta un familiar mayor de 16.');
      return;
    }
    addFamily.mutate(
      {
        fullName: fullName.trim(),
        dni: dni.trim(),
        birthDate,
        email: email.trim(),
        canInvite,
        ...(relation.trim() !== '' && { relation: relation.trim() }),
      },
      {
        onSuccess: (result) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const tone =
            result.outcome === 'REACTIVATED_PERMISSION'
              ? 'warning'
              : result.outcome === 'ALREADY_MEMBER'
                ? 'info'
                : 'success';
          onFeedback(messageForAddOutcome(result), tone);
          close();
        },
        onError: (err) => handleServerBranchBack(err, /*fromMinor*/ false),
      },
    );
  };

  /**
   * Si el server rechaza por edad cruzada (cliente calculo distinto por
   * error o el titular cambio la fecha entre el submit y el server),
   * mostrar el mensaje del server (que ya sugiere el otro endpoint) sin
   * perder los datos del formulario. Si es USER_SUSPENDED/DELETED,
   * mensaje explicito de "contactar administracion".
   */
  const handleServerBranchBack = (err: unknown, fromMinor: boolean) => {
    const code = problemCode(err);
    if (code === 'AGE_UNDER_16' && !fromMinor) {
      // El formulario ya se re-ramifico solo (el hint de edad matcheo
      // el veredicto del server); pedir "reintentar" confunde. Explicar
      // el cambio y esperar que el titular revise y confirme.
      setFormError('Según la fecha, va al padrón de menores. Revisá los datos y confirmá.');
      return;
    }
    if (code === 'AGE_OVER_16' && fromMinor) {
      setFormError('Según la fecha, va al alta de familiares con cuenta. Revisá los datos y confirmá.');
      return;
    }
    if (code === 'USER_SUSPENDED' || code === 'USER_DELETED') {
      setFormError(messageForConflictCode(code));
      return;
    }
    if (code === 'EMAIL_REQUIRED') {
      setFormError('Email requerido para dar de alta un familiar mayor de 16.');
      return;
    }
    const message = isProblemDetail(err) ? (err.detail ?? 'No se pudo completar el alta.') : (err as Error)?.message ?? 'No se pudo completar el alta.';
    setFormError(message);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-bg-base">
        <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
          <Text className="text-title font-semibold text-text-primary">
            Agregar {isMinor ? 'menor' : 'familiar'}
          </Text>
          <Pressable onPress={close} hitSlop={8}>
            <Text className="text-body text-text-muted">Cerrar</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-4">
          <View className="gap-3">
            <Input
              label="Nombre completo"
              value={fullName}
              onChangeText={setFullName}
              editable={!isPending}
            />

            <View className="gap-2">
              <Text className="text-footnote font-medium text-text-muted">Fecha de nacimiento</Text>
              {Platform.OS === 'android' ? (
                <>
                  <Button
                    label={birth.toLocaleDateString('es-AR')}
                    onPress={() => setShowPicker(true)}
                    disabled={isPending}
                  />
                  {showPicker ? (
                    <DateTimePicker
                      value={birth}
                      mode="date"
                      onChange={(event, selected) => {
                        setShowPicker(false);
                        if (event.type === 'set' && selected) setBirth(selected);
                      }}
                      maximumDate={new Date()}
                    />
                  ) : null}
                </>
              ) : (
                <DateTimePicker
                  value={birth}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(_, selected) => {
                    if (selected) setBirth(selected);
                  }}
                  textColor="#fafafa"
                  accentColor="#fafafa"
                />
              )}
              <Text className="text-footnote text-text-muted">
                Edad: {age} años · {isMinor ? 'menor de 16, va al padrón' : '16 o más, va a familiares con cuenta'}.
              </Text>
            </View>
          </View>

          {isMinor ? (
            <View className="gap-3">
              <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
                Datos del menor
              </Text>
              <Input
                label="DNI (opcional)"
                value={dni}
                onChangeText={setDni}
                keyboardType="number-pad"
                editable={!isPending}
              />
              <Input
                label="Parentesco (opcional)"
                value={relation}
                onChangeText={setRelation}
                editable={!isPending}
              />
              <Input
                label="Notas (opcional)"
                value={notes}
                onChangeText={setNotes}
                editable={!isPending}
              />
              <Text className="text-footnote text-text-muted">
                No se crea cuenta ni se envía email. El menor queda en el padrón del lote.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
                Datos del familiar
              </Text>
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
          )}

          {formError ? (
            <Text className="text-body leading-[22px] text-text-primary">{formError}</Text>
          ) : null}

          <Button
            label={isPending ? 'Guardando' : isMinor ? 'Registrar menor' : 'Agregar familiar'}
            onPress={submit}
            disabled={isPending}
            variant="primary"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
