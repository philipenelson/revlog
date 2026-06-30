"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ApiError,
  getTransferDetails,
  acceptTransfer,
  declineTransfer,
  type TransferDetails,
} from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/infrastructure/http/CookieHttpClient";
import { logger } from "@/infrastructure/logging/logger";
import { useAuth } from "@/application/providers/AuthProvider";

export type TransferLoadState =
  | "loading"
  | "pending"
  | "not-found"
  | "accepted"
  | "declined"
  | "error";

export interface TransferViewModel {
  loadState: TransferLoadState;
  transfer: TransferDetails | null;
  accepting: boolean;
  declining: boolean;
  actionError: string | null;
  handleAccept: () => Promise<void>;
  handleDecline: () => Promise<void>;
}

export function useTransferViewModel(): TransferViewModel {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { session, isRestoring } = useAuth();

  const [loadState, setLoadState] = useState<TransferLoadState>("loading");
  const [transfer, setTransfer] = useState<TransferDetails | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isRestoring) return;

    if (!session) {
      const next = encodeURIComponent(`/transfers/${token}`);
      router.replace(`/login?next=${next}`);
      return;
    }

    getTransferDetails(cookieHttpClient, token)
      .then((t) => {
        setTransfer(t);
        setLoadState("pending");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setLoadState("not-found");
        } else {
          logger.error("failed to load transfer", { err });
          setLoadState("error");
        }
      });
  }, [token, session, isRestoring, router]);

  async function handleAccept(): Promise<void> {
    setActionError(null);
    setAccepting(true);
    try {
      const vehicleId = await acceptTransfer(cookieHttpClient, token);
      setLoadState("accepted");
      router.push(`/garage/${vehicleId}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message ?? "Failed to accept transfer."
          : "Something went wrong. Try again.";
      setActionError(msg);
      setAccepting(false);
    }
  }

  async function handleDecline(): Promise<void> {
    setActionError(null);
    setDeclining(true);
    try {
      await declineTransfer(cookieHttpClient, token);
      setLoadState("declined");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message ?? "Failed to decline transfer."
          : "Something went wrong. Try again.";
      setActionError(msg);
      setDeclining(false);
    }
  }

  return {
    loadState,
    transfer,
    accepting,
    declining,
    actionError,
    handleAccept,
    handleDecline,
  };
}
