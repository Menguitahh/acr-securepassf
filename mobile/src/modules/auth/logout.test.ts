import { describe, expect, it, vi } from 'vitest';

import { resolveOutboxFlush, type LogoutDeps } from '@/modules/auth/logout';

function deps(overrides: Partial<LogoutDeps> = {}): LogoutDeps {
  return {
    syncOutbox: vi.fn().mockResolvedValue(undefined),
    countPending: vi.fn().mockReturnValue(0),
    promptDecision: vi.fn().mockResolvedValue('proceed'),
    ...overrides,
  };
}

describe('resolveOutboxFlush', () => {
  it('outbox vacio: no muestra prompt, cierra limpio', async () => {
    const d = deps({ countPending: vi.fn().mockReturnValue(0) });
    const outcome = await resolveOutboxFlush(d);
    expect(outcome).toBe('closed');
    expect(d.syncOutbox).toHaveBeenCalledTimes(1);
    expect(d.promptDecision).not.toHaveBeenCalled();
  });

  it('flush drena todo: cierra limpio sin prompt', async () => {
    // El count post-flush es 0 aunque haya habido eventos antes: se drenaron.
    const d = deps({
      countPending: vi.fn().mockReturnValue(0),
      syncOutbox: vi.fn().mockResolvedValue(undefined),
    });
    const outcome = await resolveOutboxFlush(d);
    expect(outcome).toBe('closed');
    expect(d.promptDecision).not.toHaveBeenCalled();
  });

  it('flush falla y quedan eventos: muestra prompt con el count real', async () => {
    const d = deps({
      countPending: vi.fn().mockReturnValue(3),
      promptDecision: vi.fn().mockResolvedValue('proceed'),
    });
    const outcome = await resolveOutboxFlush(d);
    expect(outcome).toBe('closed');
    expect(d.promptDecision).toHaveBeenCalledWith(3);
  });

  it('guardia elige "Cancelar": aborta el logout', async () => {
    const d = deps({
      countPending: vi.fn().mockReturnValue(2),
      promptDecision: vi.fn().mockResolvedValue('cancel'),
    });
    const outcome = await resolveOutboxFlush(d);
    expect(outcome).toBe('cancelled');
  });

  it('guardia elige "Reintentar": vuelve a intentar y si drena, cierra', async () => {
    const count = vi.fn().mockReturnValueOnce(3).mockReturnValueOnce(0);
    const decision = vi
      .fn<(pending: number) => Promise<'retry' | 'proceed' | 'cancel'>>()
      .mockResolvedValueOnce('retry');
    const d = deps({ countPending: count, promptDecision: decision });
    const outcome = await resolveOutboxFlush(d);
    expect(outcome).toBe('closed');
    expect(count).toHaveBeenCalledTimes(2);
    expect(d.syncOutbox).toHaveBeenCalledTimes(2);
    // Prompt solo cuando quedan eventos: primera vuelta (3 pending) si;
    // segunda vuelta (0 pending) drena, no vuelve a preguntar.
    expect(decision).toHaveBeenCalledTimes(1);
  });

  it('guardia elige "Reintentar" y sigue fallando: vuelve a preguntar hasta cerrar', async () => {
    const count = vi.fn().mockReturnValueOnce(3).mockReturnValueOnce(3).mockReturnValueOnce(3);
    const decision = vi
      .fn<(pending: number) => Promise<'retry' | 'proceed' | 'cancel'>>()
      .mockResolvedValueOnce('retry')
      .mockResolvedValueOnce('retry')
      .mockResolvedValueOnce('proceed');
    const d = deps({ countPending: count, promptDecision: decision });
    const outcome = await resolveOutboxFlush(d);
    expect(outcome).toBe('closed');
    expect(decision).toHaveBeenCalledTimes(3);
  });

  it('syncOutbox tira: no propaga, sigue al conteo', async () => {
    // syncOutbox puede rejectar por red o error interno. El flujo no
    // debe propagar — el prompt maneja el estado con el count.
    const d = deps({
      syncOutbox: vi.fn().mockRejectedValue(new Error('red caida')),
      countPending: vi.fn().mockReturnValue(1),
      promptDecision: vi.fn().mockResolvedValue('proceed'),
    });
    const outcome = await resolveOutboxFlush(d);
    expect(outcome).toBe('closed');
    expect(d.promptDecision).toHaveBeenCalledWith(1);
  });

  it('syncOutbox tarda: timeout de 5s no bloquea el logout', async () => {
    vi.useFakeTimers();
    const d = deps({
      syncOutbox: vi.fn().mockReturnValue(new Promise(() => {})), // nunca resuelve
      countPending: vi.fn().mockReturnValue(2),
      promptDecision: vi.fn().mockResolvedValue('proceed'),
    });
    const promise = resolveOutboxFlush(d);
    // Sin avanzar el reloj no resuelve. Avanzo los 5s del timeout.
    await vi.advanceTimersByTimeAsync(5_000);
    const outcome = await promise;
    expect(outcome).toBe('closed');
    expect(d.promptDecision).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });
});
