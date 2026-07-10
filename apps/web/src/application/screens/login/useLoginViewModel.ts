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
import { login as loginRequest, register as registerRequest } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { useAuth } from "@/application/providers/AuthProvider";
import { logger } from "@/adapters/logging/logger";
import {
  SIGN_IN_USER_ERROR,
  REGISTER_USER_ERROR,
  SERVICE_ERROR,
  safeNextPath,
  isUserFacingError,
  resolvePostAuthRoute,
  verifyEmailRoute,
} from "./login.logic";

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
    router.replace(resolvePostAuthRoute(nextPath, session.account.status));
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
      const session = await loginRequest(cookieHttpClient, data);
      setSession(session);
      router.push(resolvePostAuthRoute(nextPath, session.account.status));
    } catch (err) {
      if (isUserFacingError(err)) {
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
      await registerRequest(cookieHttpClient, data);
      router.push(verifyEmailRoute(data.email));
    } catch (err) {
      if (isUserFacingError(err)) {
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
