import React, { useEffect, useRef } from 'react';
import { Building } from '../types';
import { X } from 'lucide-react';
import { PrimaryButton } from '../ui/atoms';
import { typography, getThemeColors, fontFamily } from '../ui/theme';

interface POIConfirmationModalProps {
  building: Building;
  onConfirm: () => void;
  onCancel: () => void;
  theme: 'dark' | 'light';
}

export const POIConfirmationModal: React.FC<POIConfirmationModalProps> = ({
  building,
  onConfirm,
  onCancel,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = `poi-confirmation-title-${building.id}`;
  const descriptionId = `poi-confirmation-description-${building.id}`;

  // Focus management: focus the modal when it opens
  useEffect(() => {
    if (modalRef.current) {
      const firstButton = modalRef.current.querySelector('button') as HTMLElement;
      if (firstButton) {
        firstButton.focus();
      }
    }
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-[#010E36]/90 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="max-w-md w-full bg-[#282C55] shadow-xl relative rounded-[32px] overflow-hidden" 
        style={{ padding: '32px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-[#BAB2CF] hover:text-[#FDFEFF] transition-colors opacity-60 hover:opacity-100"
          aria-label="Close modal"
          title="Close"
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        <h2 id={titleId} className={`${fontFamily.heading} text-[#FDFEFF] text-2xl mb-4`}>
          We found this building
        </h2>
        <p id={descriptionId} className="sr-only">
          Confirm adding {building.name} to the atlas
        </p>

        <p className={`${typography.body.default} text-[#BAB2CF] mb-6`}>
          Are you sure this is your style?
        </p>

        {/* Building image */}
        {building.imageUrl && (
          <div className="mb-6 rounded-lg overflow-hidden">
            <img
              src={building.imageUrl}
              alt={building.name}
              className="w-full h-48 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Building info */}
        <div className="mb-6">
          <h3 className={`${typography.label.heading} text-[#FDFEFF] mb-2`}>
            {building.name}
          </h3>
          {building.location && (
            <p className={`${typography.body.small} text-[#BAB2CF] mb-1`}>
              {building.location}
            </p>
          )}
          {building.style && (
            <p className={`${typography.body.small} text-[#BAB2CF]`}>
              Style: {building.style}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <PrimaryButton
            theme={theme}
            onClick={onConfirm}
            className="flex-1"
          >
            Yes, add it
          </PrimaryButton>
          <button
            onClick={onCancel}
            className={`flex-1 px-6 py-3 rounded-md transition-colors ${colors.accent.bgHover} text-[#BAB2CF] hover:text-[#FDFEFF] border border-[#BAB2CF]/30 hover:border-[#BAB2CF]/50`}
          >
            No, not really
          </button>
        </div>
      </div>
    </div>
  );
};

