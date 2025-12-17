import React, { useState, useEffect } from 'react';
import { Theme, typography, getThemeColors } from '../theme';

export interface StatusStripProps {
  theme: Theme;
  statusText: string;
  isVisible: boolean;
}

export const StatusStrip: React.FC<StatusStripProps> = ({
  theme,
  statusText,
  isVisible,
}) => {
  const colors = getThemeColors(theme);

  if (!isVisible) return null;

  return (
    <div className="mt-2 text-center">
      <p className={`${typography.mono.default} ${colors.accent.primary} opacity-80`}>
        {statusText}
      </p>
    </div>
  );
};

