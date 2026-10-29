import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'scan' | 'today' | 'fish' | 'plus' | 'qr' | 'catch';

/** Simple line icons drawn with SVG, so the app needs no icon font. */
export function Icon({ name, size = 24, color = '#000' }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'scan' && (
        <>
          <Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
          <Path d="M4 12h16" />
        </>
      )}
      {name === 'today' && (
        <>
          <Rect x={5} y={4} width={14} height={17} rx={2} />
          <Path d="M9 4v2h6V4M9 11h6M9 15h4" />
        </>
      )}
      {(name === 'fish' || name === 'catch') && (
        <>
          <Path d="M6.5 12c3-5 9-5 13 0-4 5-10 5-13 0z" />
          <Path d="M6.5 12 2.5 8v8z" />
          <Circle cx={16} cy={11.2} r={0.6} fill={color} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" />}
      {name === 'qr' && (
        <>
          <Rect x={4} y={4} width={6} height={6} rx={1} />
          <Rect x={14} y={4} width={6} height={6} rx={1} />
          <Rect x={4} y={14} width={6} height={6} rx={1} />
          <Path d="M14 14h2v2h-2zM18 18h2v2h-2zM20 14v.01M14 20v.01" />
        </>
      )}
    </Svg>
  );
}
