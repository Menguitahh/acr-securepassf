// ISO 1..7: 1=lun, 7=dom. Mismo orden que el backend (ScheduleWindow) y
// que scheduleContains en el scanner. Etiquetas cortas para chips 48x48dp
// (guantes en garita, pero este picker vive en la app del residente,
// consistencia con la del scanner).
export const WEEKDAY_LABELS: readonly { iso: number; label: string }[] = [
  { iso: 1, label: 'L' },
  { iso: 2, label: 'M' },
  { iso: 3, label: 'M' },
  { iso: 4, label: 'J' },
  { iso: 5, label: 'V' },
  { iso: 6, label: 'S' },
  { iso: 7, label: 'D' },
];
