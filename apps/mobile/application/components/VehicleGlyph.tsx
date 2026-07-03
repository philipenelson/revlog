import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@maintenance-log/ui-tokens';

type VehicleGlyphProps = {
  dashed?: boolean;
  size?: number;
};

// Motorcycle glyph — see revlog-mobile-garage.html / revlog-mobile-vehicle-detail.html.
// `dashed` renders the empty-state's outline treatment; solid otherwise (a
// card or hero's photo placeholder when the Vehicle has no photoUrl). Shared
// by GarageScreen and VehicleDetailScreen.
export function VehicleGlyph({ dashed = false, size = 40 }: VehicleGlyphProps) {
  const color = dashed ? colors.neutral[300] : colors.teal[500];
  const dashArray = dashed ? '3 3' : undefined;
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 80 48" fill="none" aria-hidden>
      <Circle cx={16} cy={36} r={9} stroke={color} strokeWidth={2} strokeDasharray={dashArray} />
      <Circle cx={62} cy={36} r={9} stroke={color} strokeWidth={2} strokeDasharray={dashArray} />
      <Path
        d="M16 36 L30 19 L46 19 L62 36"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashArray}
      />
      <Path d="M30 19 L37 36" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dashArray} />
      <Path
        d="M46 19 L41 11 L52 11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashArray}
      />
      <Path d="M21 13 L33 13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dashArray} />
    </Svg>
  );
}
