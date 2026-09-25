import Svg, { Path } from 'react-native-svg';

export type IconProps = { size?: number; color: string };

export const CloseIcon = ({ size = 18, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const RestartIcon = ({ size = 21, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12a9 9 0 1 0 3-6.7" />
    <Path d="M3 4v5h5" />
  </Svg>
);

export const PlayIcon = ({ size = 21, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);

export const PauseIcon = ({ size = 21, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" />
  </Svg>
);

// Document with a plus badge: Import File.
export const FileImportIcon = ({ size = 26, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 3h6l5 5v11a2 2 0 0 1-2 2h-5" />
    <Path d="M15 3v5h5" />
    <Path d="M9 3H7a2 2 0 0 0-2 2v6" />
    <Path d="M6 15v6M3 18h6" />
  </Svg>
);

// Books on a shelf: Import Book.
export const BooksIcon = ({ size = 26, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 4h3v16H4zM9 4h3v16H9z" />
    <Path d="M14.5 5.2l2.9-.8 3.6 15.3-2.9.8z" />
  </Svg>
);

// Left-aligned text lines: Insert Text.
export const TextLinesIcon = ({ size = 26, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M4 6h16M4 10h16M4 14h16M4 18h10" />
  </Svg>
);

export const ArrowRightIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12h16M13 5l7 7-7 7" />
  </Svg>
);

export const ArrowLeftIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 12H4M11 5l-7 7 7 7" />
  </Svg>
);
