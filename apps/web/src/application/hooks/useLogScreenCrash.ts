"use client";

import { useEffect } from "react";
import { logger } from "@/adapters/logging/logger";

/** Logs a page-level error-boundary crash (route error.tsx files stay logic-free). */
export function useLogScreenCrash(screen: string, error: Error & { digest?: string }) {
  useEffect(() => {
    logger.error(`${screen} screen crashed`, { message: error.message, digest: error.digest });
  }, [screen, error]);
}
