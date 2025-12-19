import React from 'react';
import { Building } from '../types';
import { X } from 'lucide-react';
import { PrimaryButton } from '../ui/atoms';
import { typography, getThemeColors, fontFamily } from '../ui/theme';

interface DeleteBuildingModalProps {
  building: Building;
  onConfirm: () => void;
  onCancel: () => void;
  theme: 'dark' | 'light';
}

export const DeleteBuildingModal: React.FC<DeleteBuildingModalProps> = ({
  building,
  onConfirm,
  onCancel,
  theme,
}) => {
  const colors = getThemeColors(theme);

  return (
    <div className="fixed inset-0 bg-[#010E36]/90 z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#282C55] shadow-xl relative rounded-[32px] overflow-hidden" style={{ padding: '32px' }}>
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-[#BAB2CF] hover:text-[#FDFEFF] transition-colors opacity-60 hover:opacity-100"
          aria-label="Close modal"
          title="Close"
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        <h2 className={`${fontFamily.heading} text-[#FDFEFF] text-2xl mb-4`}>
          Is this building no good?
        </h2>

        {/* Building info */}
        <div className="mb-6">
          <h3 className={`${typography.label.heading} text-[#FDFEFF] mb-2`}>
            {building.name}
          </h3>
          {building.location && (
            <p className={`${typography.body.small} text-[#BAB2CF]`}>
              {building.location}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-3 rounded-md transition-colors bg-[#FF5D88] text-white hover:opacity-90 font-medium`}
          >
            It sucks, remove it
          </button>
          <button
            onClick={onCancel}
            className={`flex-1 px-6 py-3 rounded-md transition-colors ${colors.accent.bgHover} text-[#BAB2CF] hover:text-[#FDFEFF] border border-[#BAB2CF]/30 hover:border-[#BAB2CF]/50`}
          >
            No, it's cool. Nevermind
          </button>
        </div>
      </div>
    </div>
  );
};

