"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registerSchema,
  loginSchema,
  type RegisterInput,
  type LoginInput,
} from "@maintenance-log/domain";
import { ApiError } from "@/model/errors";
import * as authService from "@/model/services/authService";
import { useAuth } from "@/application/providers/AuthProvider";
import { routeForAccountStatus } from "@/application/navigation/routeForAccountStatus";
import { logger } from "@/infrastructure/logging/logger";

const SIGN_IN_USER_ERROR =
  "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.";
const REGISTER_USER_ERROR = "Couldn't create your account. Check your details and try again.";
const SERVICE_ERROR = "We stalled. Our mechanics are on it — try again in a moment.";

export type Tab = "login" | "register";

export interface LoginViewModel {
  tab: Tab;
  selectTab: (next: Tab) => void;
  login: {
    field: UseFormRegister<LoginInput>;
    errors: FieldErrors<LoginInput>;
    isSubmitting: boolean;
    error: string | null;
    submit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  };
  register: {
    field: UseFormRegister<RegisterInput>;
    errors: FieldErrors<RegisterInput>;
    isSubmitting: boolean;
    error: string | null;
    submit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  };
}

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, "http://localhost");
    if (url.hostname !== "localhost") return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

export function useLoginViewModel(): LoginViewModel {
  const [tab, setTab] = useState<Tab>("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { session, isRestoring, setSession } = useAuth();

  // UC-AUTH-5 — an already-authenticated visitor (silent refresh restored a
  // session on mount, see ADR 0017/UC-AUTH-7) should never see this form; route
  // them onward exactly as a fresh sign-in would. Wait for isRestoring to settle
  // first, or every visitor would flash through the form before being routed away.
  useEffect(() => {
    if (isRestoring || !session) return;
    router.replace(nextPath ?? routeForAccountStatus(session.account.status));
  }, [session, isRestoring, router, nextPath]);

  const [loginError, setLoginError] = useState<string | null>(null);
  const {
    register: loginField,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const [registerError, setRegisterError] = useState<string | null>(null);
  const {
    register: registerField,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors, isSubmitting: isRegisterSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  function selectTab(next: Tab) {
    setTab(next);
    setLoginError(null);
    setRegisterError(null);
  }

  async function onLoginSubmit(data: LoginInput) {
    setLoginError(null);
    try {
      const session = await authService.login(data);
      setSession(session);
      router.push(nextPath ?? routeForAccountStatus(session.account.status));
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setLoginError(SIGN_IN_USER_ERROR);
      } else {
        logger.error("login request failed", { err });
        setLoginError(SERVICE_ERROR);
      }
    }
  }

  async function onRegisterSubmit(data: RegisterInput) {
    setRegisterError(null);
    try {
      await authService.register(data);
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setRegisterError(REGISTER_USER_ERROR);
      } else {
        logger.error("registration request failed", { err });
        setRegisterError(SERVICE_ERROR);
      }
    }
  }

  return {
    tab,
    selectTab,
    login: {
      field: loginField,
      errors: loginErrors,
      isSubmitting: isLoginSubmitting,
      error: loginError,
      submit: handleLoginSubmit(onLoginSubmit),
    },
    register: {
      field: registerField,
      errors: registerErrors,
      isSubmitting: isRegisterSubmitting,
      error: registerError,
      submit: handleRegisterSubmit(onRegisterSubmit),
    },
  };
}
