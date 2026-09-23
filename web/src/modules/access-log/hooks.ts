"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { requestExport, saveBlob } from "@/modules/access-log/export";
import type { ExportRequest } from "@/modules/access-log/types";

export function useAccessLogExport() {
  // Tras un 429, el boton queda deshabilitado lo que dice Retry-After: no
  // tiene sentido reintentar antes y cada intento ocupa al server.
  const [coolingDown, setCoolingDown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: ({ range, instants, result }: ExportRequest) => requestExport(range, instants, result),
    onSuccess: (outcome) => {
      if (outcome.kind === "file") saveBlob(outcome.blob, outcome.fileName);
      if (outcome.kind === "busy" && outcome.retryAfterSeconds !== null) {
        setCoolingDown(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCoolingDown(false), outcome.retryAfterSeconds * 1000);
      }
    },
  });

  return { ...mutation, coolingDown };
}
