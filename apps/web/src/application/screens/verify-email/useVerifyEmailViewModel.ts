"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/model/errors";
import { verifyEmail } from "@/model/services/authService";
import { useAuth } from "@/application/providers/AuthProvider";
import { routeForAccountStatus } from "@/application/navigation/routeForAccountStatus";
import { logger } from "@/infrastructure/logging/logger";

export type VerifyEmailState = "waiting" | "verifying" | "verified" | "error";

export interface VerifyEmailViewModel {
  screenState: VerifyEmailState;
  email: string | null;
}

export function useVerifyEmailViewModel(): VerifyEmailViewModel {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [screenState, setScreenState] = useState<VerifyEmailState>(token ? "verifying" : "waiting");
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;

    verifyEmail(token)
      .then((session) => {
        setSession(session);
        setScreenState("verified");
        router.push(routeForAccountStatus(session.account.status));
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status < 500)) {
          logger.error("verify-email request failed", { err });
        }
        setScreenState("error");
      });
  }, [token, router, setSession]);

  return { screenState, email };
}
