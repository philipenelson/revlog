import Svg, { Line, Path } from 'react-native-svg';
import { colors } from '@maintenance-log/ui-tokens';

type OfflineIndicatorProps = {
  size?: number;
};

// Icon-only offline indicator for a Garage-stack-style header — see
// revlog-mobile-garage.html / revlog-mobile-offline-sync.html and ADR 0028
// ("Offline indicator placement"). Reusable across any screen's header, not
// Garage-specific, even though Garage is its first user.
export function OfflineIndicator({ size = 16 }: OfflineIndicatorProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path
        d="M7 18a4 4 0 01-.5-7.97A5.5 5.5 0 0117 8.5a4 4 0 011 7.5"
        stroke={colors.warning[500]}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={3} y1={3} x2={21} y2={21} stroke={colors.warning[500]} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
