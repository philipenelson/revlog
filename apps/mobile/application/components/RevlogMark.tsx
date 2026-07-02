import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '@maintenance-log/ui-tokens';

type RevlogMarkProps = {
  size?: number;
};

// Speedometer/gauge brand mark shown above the wordmark on Welcome, Login,
// and Register -- see revlog-mobile-auth.html / revlog-mobile-welcome.html
// and ADR 0032. Geometry is fixed brand shape (viewBox 0 0 36 36); only
// `size` scales it.
export function RevlogMark({ size = 40 }: RevlogMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden>
      <Path d="M 11 30 A 14 14 0 1 1 25 30" stroke={colors.neutral[600]} strokeWidth={3} strokeLinecap="round" />
      <Path d="M 11 30 A 14 14 0 1 1 30.1 11" stroke={colors.teal[500]} strokeWidth={3} strokeLinecap="round" />
      <Line x1={18} y1={18} x2={27.5} y2={13} stroke={colors.teal[500]} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={18} cy={18} r={2.2} fill={colors.teal[500]} />
      <Circle cx={30.1} cy={11} r={1.5} fill={colors.danger[500]} opacity={0.8} />
    </Svg>
  );
}
