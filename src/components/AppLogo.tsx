import React from 'react';

interface AppLogoProps {
  theme?: { isDark?: boolean };
  size?: number;
  alt?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  theme,
  size = 28,
  alt = 'Prism Music',
}) => {
  const isDark = Boolean(theme?.isDark);
  const src = isDark ? './logo-dark.svg' : './logo-light.svg';
  const radius = Math.round(size * 0.34);

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${radius}px`,
        objectFit: 'cover',
        display: 'block',
        flexShrink: 0,
        userSelect: 'none',
        border: isDark
          ? '1px solid rgba(255, 255, 255, 0.14)'
          : '1px solid rgba(15, 23, 42, 0.08)',
        boxShadow: isDark
          ? '0 2px 10px rgba(0, 0, 0, 0.42)'
          : '0 2px 8px rgba(31, 123, 224, 0.22)',
      }}
    />
  );
};
