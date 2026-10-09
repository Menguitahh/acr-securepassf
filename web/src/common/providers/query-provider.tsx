"use client";

import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/common/api/query-client";

interface Props {
  children: React.ReactNode;
}

export function QueryProvider({ children }: Props) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
