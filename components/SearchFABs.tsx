import React from 'react';
import { Locate, Crosshair, Binoculars } from 'lucide-react';

interface SearchFABsProps {
  onLocateMe: () => void;
  onFindNearest: () => void;
  onSearchArea: () => void;
  locationPermissionDenied?: boolean;
}

export const SearchFABs: React.FC<SearchFABsProps> = ({
  onLocateMe,
  onFindNearest,
  onSearchArea,
  locationPermissionDenied = false,
}) => {
  const isDisabled = locationPermissionDenied && !navigator.geolocation;
  const disabledClass = isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80';

  const FABButton: React.FC<{
    onClick: () => void;
    disabled?: boolean;
    title: string;
    ariaLabel: string;
    icon: React.ReactNode;
  }> = ({ onClick, disabled, title, ariaLabel, icon }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`bg-[#282C55] h-[40px] w-[40px] flex items-center justify-center rounded-[10px] shadow-[0px_1px_5px_0px_rgba(1,14,54,0.2)] pointer-events-auto transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
      style={{ padding: '8px' }}
      title={title}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );

  return (
    <div className="absolute bottom-4 md:bottom-6 right-4 md:right-6 z-10 flex flex-col gap-3 pointer-events-none">
      {/* Locate Me FAB */}
      <FABButton
        onClick={onLocateMe}
        disabled={isDisabled}
        title={isDisabled ? "Location access denied. Click to try again." : "Jump to my location"}
        ariaLabel={isDisabled ? "Location access denied. Click to try again." : "Jump to my location"}
        icon={<Locate size={24} className="text-[#C7B3FF]" aria-hidden="true" />}
      />

      {/* Find Nearest FAB */}
      <FABButton
        onClick={onFindNearest}
        disabled={isDisabled}
        title={isDisabled ? "Location access denied. Click to try again." : "Jump to nearest building"}
        ariaLabel={isDisabled ? "Location access denied. Click to try again." : "Jump to nearest building"}
        icon={<Crosshair size={24} className="text-[#C7B3FF]" aria-hidden="true" />}
      />

      {/* Scan Area FAB */}
      <FABButton
        onClick={onSearchArea}
        title="Scan current area"
        ariaLabel="Scan current area"
        icon={<Binoculars size={24} className="text-[#C7B3FF]" aria-hidden="true" />}
      />
    </div>
  );
};

