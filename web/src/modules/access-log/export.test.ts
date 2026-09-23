import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkRange } from "@/common/date-range/lib";
import type { ResultFilter } from "@/modules/access-log/types";
import { memoryStorage } from "@/test/memory-storage";

const MZA = "America/Argentina/Mendoza";
const RANGE = { from: "2026-09-17", to: "2026-09-23" };
const CSV = "﻿captured_at,lot_code\r\n2026-09-22T19:21:33.545Z,A-001\r\n";

// Stub de fetch ANTES de importar: openapi-fetch captura globalThis.fetch
// al crear el client.
async function setup(handler: (request: Request) => Promise<Response>) {
  vi.resetModules();
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  const { requestExport } = await import("@/modules/access-log/export");

  const check = checkRange(RANGE, MZA);
  if (!check.ok) throw new Error(check.message);
  const run = (result: ResultFilter = "ALL") => requestExport(RANGE, check.instants, result);
  const lastUrl = () => new URL(fetchMock.mock.calls.at(-1)?.[0].url ?? "");
  return { run, lastUrl };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("requestExport", () => {
  it("200 devuelve el CSV como blob con el nombre del rango elegido", async () => {
    const { run } = await setup(async () => new Response(CSV, { status: 200, headers: { "Content-Type": "text/csv" } }));

    const outcome = await run();

    expect(outcome.kind).toBe("file");
    if (outcome.kind !== "file") return;
    expect(outcome.blob).toBeInstanceOf(Blob);
    // Bytes y no .text(): el decoder UTF-8 descarta el BOM al leer, y el BOM es
    // lo que Excel necesita para abrir bien tildes y enies.
    const bytes = new Uint8Array(await outcome.blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await outcome.blob.text()).toBe(CSV.slice(1));
    expect(outcome.fileName).toBe("access-logs-2026-09-17-2026-09-23.csv");
  });

  it("manda las medianoches del barrio y omite result con Todos", async () => {
    const { run, lastUrl } = await setup(async () => new Response(CSV, { status: 200 }));

    await run("ALL");

    const params = lastUrl().searchParams;
    expect(params.get("from")).toBe("2026-09-17T03:00:00.000Z");
    expect(params.get("to")).toBe("2026-09-24T03:00:00.000Z");
    expect(params.has("result")).toBe(false);
  });

  it("manda result cuando se filtra", async () => {
    const { run, lastUrl } = await setup(async () => new Response(CSV, { status: 200 }));

    await run("DENIED");

    expect(lastUrl().searchParams.get("result")).toBe("DENIED");
  });

  it("429 es busy con el Retry-After, no error", async () => {
    const { run } = await setup(async () => new Response(null, { status: 429, headers: { "Retry-After": "30" } }));

    expect(await run()).toEqual({ kind: "busy", retryAfterSeconds: 30 });
  });

  it("429 sin Retry-After sigue siendo busy", async () => {
    const { run } = await setup(async () => new Response(null, { status: 429 }));

    expect(await run()).toEqual({ kind: "busy", retryAfterSeconds: null });
  });

  it("422 es rango invalido", async () => {
    const { run } = await setup(async () => new Response(JSON.stringify({ status: 422, rule: "export-range" }), { status: 422 }));

    expect(await run()).toEqual({ kind: "invalidRange" });
  });

  it("5xx y red son error", async () => {
    const server = await setup(async () => new Response(null, { status: 503 }));
    expect(await server.run()).toEqual({ kind: "error" });

    const network = await setup(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await network.run()).toEqual({ kind: "error" });
  });

  it("si el navegador no puede armar el blob, error claro y no una promesa colgada", async () => {
    const { run } = await setup(async () => {
      const response = new Response(CSV, { status: 200 });
      vi.spyOn(response, "blob").mockRejectedValue(new RangeError("Array buffer allocation failed"));
      return response;
    });

    expect(await run()).toEqual({ kind: "error" });
  });
});
