"use client";

import { useSessionBootstrap } from "@/modules/auth/hooks";

export function SessionBootstrap() {
  useSessionBootstrap();
  return null;
}
