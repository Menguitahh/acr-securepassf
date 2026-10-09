// #33: accion elegida en el push de permanencia (US-42).
export type StayWarningAction = { kind: 'extend' | 'request_exit'; invitationId: string };
