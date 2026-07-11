// Pure functional core for the Mechanic Printout screen (ADR 0043).

export function reportStateFromShareUrl(shareUrl: string | null): 'has-token' | 'no-token' {
  return shareUrl ? 'has-token' : 'no-token';
}

export interface SharePayload {
  message: string;
  url?: string;
}

// iOS renders a rich preview from `url`; Android's share sheet ignores it, so
// the link is folded into the message there instead.
export function buildSharePayload(isIos: boolean, shareUrl: string, message: string): SharePayload {
  return isIos ? { url: shareUrl, message } : { message: `${message}\n${shareUrl}` };
}
