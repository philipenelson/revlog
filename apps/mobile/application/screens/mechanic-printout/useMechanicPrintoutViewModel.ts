import { useCallback, useEffect, useState } from 'react';
import { Platform, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getReportToken, createReportToken, revokeReportToken } from '@maintenance-log/api-client';
import { tokenHttpClient } from '@/adapters/http/TokenHttpClient';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { logger } from '@/adapters/logging/logger';

const GENERATE_ERROR = "Couldn't generate a link. Check your connection and try again.";
const REVOKE_ERROR = "Couldn't revoke the link. Check your connection and try again.";
const SHARE_MESSAGE = 'My vehicle service history on Revlog';

// 'error' is the initial-fetch-failed state (retryable). Generate/revoke
// failures don't move `state` -- they surface via `actionError` so the
// Owner stays on the screen they were on and can retry the one action.
export type MechanicPrintoutState = 'loading' | 'no-token' | 'has-token' | 'error';

export interface MechanicPrintoutViewModel {
  state: MechanicPrintoutState;
  vehicleDisplayName: string;
  shareUrl: string | null;
  actionError: string | null;
  isGenerating: boolean;
  isRevoking: boolean;
  generate: () => void;
  share: () => void;
  retry: () => void;
  onBack: () => void;
  revokeDialogOpen: boolean;
  openRevokeDialog: () => void;
  closeRevokeDialog: () => void;
  confirmRevoke: () => void;
}

// UC-MOB-PRINT-1/2/3. Online-only: the report token is a transient server
// resource, never cached in SQLite, so this viewmodel calls the api-client
// report service directly via tokenHttpClient (the same online-only shape as
// useLoginViewModel and the web useShareReportViewModel) rather than going
// through a repository. See docs/specs/mobile-app/mechanic-printout.md.
export function useMechanicPrintoutViewModel(): MechanicPrintoutViewModel {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { vehicleRepository } = useDatabase();
  const [state, setState] = useState<MechanicPrintoutState>('loading');
  const [vehicleDisplayName, setVehicleDisplayName] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  // The vehicle display name comes from local SQLite -- it's syncable data
  // the Owner already has offline. Only the token is online-only.
  useEffect(() => {
    if (!vehicleRepository || !vehicleId) return;
    void vehicleRepository.findById(vehicleId).then((vehicle) => {
      if (vehicle) setVehicleDisplayName(vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`);
    });
  }, [vehicleRepository, vehicleId]);

  // Fetch-on-open, mirroring the web viewmodel: the token is
  // server-authoritative (it may have been revoked from another device), so
  // open always reflects server truth. A network/5xx failure surfaces the
  // 'error' state -- not 'no-token', which offline would wrongly invite a
  // doomed [Generate link]. The API returns 200 {shareUrl: null} when no
  // token exists (apps/api/src/routes/report.ts), so no-token never throws.
  const loadToken = useCallback(async () => {
    if (!vehicleId) return;
    setState('loading');
    setActionError(null);
    try {
      const token = await getReportToken(tokenHttpClient, vehicleId);
      if (token.shareUrl) {
        setShareUrl(token.shareUrl);
        setState('has-token');
      } else {
        setShareUrl(null);
        setState('no-token');
      }
    } catch (err) {
      logger.error('failed to load report token', { err: String(err) });
      setState('error');
    }
  }, [vehicleId]);

  useEffect(() => {
    void loadToken();
  }, [loadToken]);

  async function handleGenerate(): Promise<void> {
    if (!vehicleId) return;
    setActionError(null);
    setIsGenerating(true);
    try {
      const token = await createReportToken(tokenHttpClient, vehicleId);
      setShareUrl(token.shareUrl);
      setState('has-token');
    } catch (err) {
      logger.error('failed to create report token', { err: String(err) });
      setActionError(GENERATE_ERROR);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleShare(): Promise<void> {
    if (!shareUrl) return;
    try {
      // iOS renders a rich preview from `url`; Android's share sheet ignores
      // `url`, so the link is folded into the message there instead.
      await Share.share(
        Platform.OS === 'ios'
          ? { url: shareUrl, message: SHARE_MESSAGE }
          : { message: `${SHARE_MESSAGE}\n${shareUrl}` },
      );
    } catch (err) {
      // Dismissing the sheet resolves normally; this only fires if the sheet
      // fails to present -- log and move on, there's nothing to surface.
      logger.warn('share sheet failed', { err: String(err) });
    }
  }

  async function handleRevoke(): Promise<void> {
    if (!vehicleId) return;
    setActionError(null);
    setIsRevoking(true);
    try {
      await revokeReportToken(tokenHttpClient, vehicleId);
      setShareUrl(null);
      setRevokeDialogOpen(false);
      setState('no-token');
    } catch (err) {
      logger.error('failed to revoke report token', { err: String(err) });
      setActionError(REVOKE_ERROR);
    } finally {
      setIsRevoking(false);
    }
  }

  return {
    state,
    vehicleDisplayName,
    shareUrl,
    actionError,
    isGenerating,
    isRevoking,
    generate: () => void handleGenerate(),
    share: () => void handleShare(),
    retry: () => void loadToken(),
    onBack: () => router.back(),
    revokeDialogOpen,
    openRevokeDialog: () => {
      setActionError(null);
      setRevokeDialogOpen(true);
    },
    closeRevokeDialog: () => {
      if (isRevoking) return;
      setActionError(null);
      setRevokeDialogOpen(false);
    },
    confirmRevoke: () => void handleRevoke(),
  };
}
