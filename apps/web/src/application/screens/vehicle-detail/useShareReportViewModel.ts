"use client";

import { useEffect, useState } from "react";
import {
  getReportToken,
  createReportToken,
  revokeReportToken,
  emailReportLink,
} from "@/domain/services/reportService";
import { logger } from "@/infrastructure/logging/logger";

export type ShareReportState = "no-token" | "has-token" | "loading";

export interface ShareReportViewModel {
  state: ShareReportState;
  shareUrl: string | null;
  emailInput: string;
  setEmailInput: (v: string) => void;
  copiedConfirm: boolean;
  emailSentConfirm: string | null;
  emailError: string | null;
  emailSending: boolean;
  generateLink: () => Promise<void>;
  copyLink: () => void;
  sendEmail: () => Promise<void>;
  revoke: () => Promise<void>;
}

export function useShareReportViewModel(vehicleId: string): ShareReportViewModel {
  const [state, setState] = useState<ShareReportState>("loading");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [copiedConfirm, setCopiedConfirm] = useState(false);
  const [emailSentConfirm, setEmailSentConfirm] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);

  // Called when the dialog opens — fetches current token state
  useEffect(() => {
    getReportToken(vehicleId)
      .then((token) => {
        if (token.shareUrl) {
          setShareUrl(token.shareUrl);
          setState("has-token");
        } else {
          setState("no-token");
        }
      })
      .catch((err) => {
        logger.error("failed to load report token", { err });
        setState("no-token");
      });
  }, [vehicleId]);

  async function generateLink() {
    setState("loading");
    try {
      const result = await createReportToken(vehicleId);
      setShareUrl(result.shareUrl);
      setState("has-token");
    } catch (err) {
      logger.error("failed to create report token", { err });
      setState("no-token");
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopiedConfirm(true);
    setTimeout(() => setCopiedConfirm(false), 2000);
  }

  async function sendEmail() {
    if (!emailInput.trim()) return;
    setEmailSending(true);
    setEmailError(null);
    setEmailSentConfirm(null);
    try {
      await emailReportLink(vehicleId, emailInput.trim());
      setEmailSentConfirm(emailInput.trim());
      setEmailInput("");
    } catch {
      setEmailError("Couldn’t send the email. Please try again.");
    } finally {
      setEmailSending(false);
    }
  }

  async function revoke() {
    setState("loading");
    try {
      await revokeReportToken(vehicleId);
      setShareUrl(null);
      setEmailInput("");
      setEmailSentConfirm(null);
      setState("no-token");
    } catch (err) {
      logger.error("failed to revoke report token", { err });
      setState("has-token");
    }
  }

  return {
    state,
    shareUrl,
    emailInput,
    setEmailInput,
    copiedConfirm,
    emailSentConfirm,
    emailError,
    emailSending,
    generateLink,
    copyLink,
    sendEmail,
    revoke,
  };
}
