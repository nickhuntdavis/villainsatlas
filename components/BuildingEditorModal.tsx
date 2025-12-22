import React, { useState, useEffect, useRef } from 'react';
import { Building, ArchitecturalStyle, Coordinates } from '../types';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { PrimaryButton } from '../ui/atoms';
import { typography, getThemeColors, fontFamily } from '../ui/theme';
import { reverseGeocode } from '../services/geocodingService';

interface BuildingEditorModalProps {
  building: Building | null; // null = add mode, Building = edit mode
  coordinates: Coordinates | null; // For add mode, coordinates from map click
  onSave: (building: Building, imageFiles?: File[]) => Promise<void>;
  onCancel: () => void;
  theme: 'dark' | 'light';
}

export const BuildingEditorModal: React.FC<BuildingEditorModalProps> = ({
  building,
  coordinates,
  onSave,
  onCancel,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const isEditMode = building !== null;
  
  // Form state
  const [name, setName] = useState(building?.name || '');
  const [notes, setNotes] = useState(building?.description || '');
  const [architect, setArchitect] = useState(building?.architect || '');
  // Allow free-form styles (with suggestions from ArchitecturalStyle enum)
  const [style, setStyle] = useState<string>(building?.style || '');
  const [location, setLocation] = useState(building?.location || '');
  const [formCoordinates, setFormCoordinates] = useState<Coordinates>(
    building?.coordinates || coordinates || { lat: 0, lng: 0 }
  );
  
  // Multiple image upload state (up to 3 images)
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [imageFileErrors, setImageFileErrors] = useState<(string | null)[]>([null, null, null]);
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  
  // Loading state
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    coordinates?: string;
    location?: string;
  }>({});
  
  // Reverse geocode location when coordinates are set (add mode) or changed
  useEffect(() => {
    const fetchLocation = async () => {
      if (!isEditMode && coordinates && !location) {
        setIsLoadingLocation(true);
        try {
          const address = await reverseGeocode(coordinates);
          if (address) {
            setLocation(address);
          }
        } catch (error) {
          console.error('Failed to reverse geocode:', error);
        } finally {
          setIsLoadingLocation(false);
        }
      }
    };
    
    fetchLocation();
  }, [coordinates, isEditMode, location]);
  
  // Update coordinates when building changes (edit mode)
  useEffect(() => {
    if (building) {
      setFormCoordinates(building.coordinates);
      if (!location) {
        // Try to reverse geocode if location is missing
        reverseGeocode(building.coordinates).then(addr => {
          if (addr && !location) {
            setLocation(addr);
          }
        });
      }
      
      // Load existing images if editing
      if (building.imageUrls && building.imageUrls.length > 0) {
        // Set previews from existing URLs (for display only, not for re-upload)
        const previews: (string | null)[] = [null, null, null];
        building.imageUrls.slice(0, 3).forEach((url, index) => {
          previews[index] = url;
        });
        setImagePreviews(previews);
      }
    }
  }, [building]);
  
  // Handle file upload for a specific slot
  const handleFileChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      const newErrors = [...imageFileErrors];
      newErrors[index] = 'Please select an image file';
      setImageFileErrors(newErrors);
      return;
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      const newErrors = [...imageFileErrors];
      newErrors[index] = 'File size must be less than 5MB';
      setImageFileErrors(newErrors);
      return;
    }
    
    // Clear error
    const newErrors = [...imageFileErrors];
    newErrors[index] = null;
    setImageFileErrors(newErrors);
    
    // Set file
    const newFiles = [...imageFiles];
    newFiles[index] = file;
    setImageFiles(newFiles);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPreviews = [...imagePreviews];
      newPreviews[index] = reader.result as string;
      setImagePreviews(newPreviews);
    };
    reader.readAsDataURL(file);
  };
  
  // Clear image at specific slot
  const clearImage = (index: number) => {
    const newFiles = [...imageFiles];
    const newPreviews = [...imagePreviews];
    const newErrors = [...imageFileErrors];
    newFiles[index] = null;
    newPreviews[index] = null;
    newErrors[index] = null;
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
    setImageFileErrors(newErrors);
    if (fileInputRefs[index].current) {
      fileInputRefs[index].current!.value = '';
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const errors: { name?: string; coordinates?: string; location?: string } = {};
    
    if (!name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formCoordinates || isNaN(formCoordinates.lat) || isNaN(formCoordinates.lng)) {
      errors.coordinates = 'Valid coordinates are required';
    }
    
    if (!location.trim()) {
      errors.location = 'Location is required';
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setValidationErrors({});
    setIsSaving(true);
    
    try {
      // Collect files that are actually provided
      const filesToUpload = imageFiles.filter((file): file is File => file !== null);
      
      const buildingData: Building = {
        id: building?.id || `temp-${Date.now()}`,
        name: name.trim(),
        description: notes.trim(),
        location: location.trim(),
        coordinates: formCoordinates,
        style: style.trim() || undefined,
        architect: architect.trim() || undefined,
        city: building?.city,
        country: building?.country,
        googlePlaceId: building?.googlePlaceId,
        gmapsUrl: building?.gmapsUrl,
        isPrioritized: building?.isPrioritized,
        hasPurpleHeart: building?.hasPurpleHeart,
        source: 'manual', // Mark as manually added
      };
      
      await onSave(buildingData, filesToUpload.length > 0 ? filesToUpload : undefined);
      onCancel();
    } catch (error) {
      console.error('Failed to save building:', error);
      setValidationErrors({ coordinates: `Failed to save building: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Get all architectural style options for suggestions
  const styleOptions = Object.values(ArchitecturalStyle);
  
  return (
    <div className="fixed inset-0 bg-[#010E36]/90 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-2xl w-full bg-[#282C55] shadow-xl relative rounded-[32px] overflow-hidden my-8" style={{ padding: '32px' }}>
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-[#BAB2CF] hover:text-[#FDFEFF] transition-colors opacity-60 hover:opacity-100"
          aria-label="Close modal"
          title="Close"
          disabled={isSaving}
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        <h2 className={`${fontFamily.heading} text-[#FDFEFF] text-2xl mb-6`}>
          {isEditMode ? 'Edit Building' : 'Add New Building'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name (required) */}
          <div>
            <label className={`${typography.label.default} text-[#FDFEFF] block mb-2`}>
              Name <span className="text-[#FF5D88]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationErrors.name) {
                  setValidationErrors(prev => ({ ...prev, name: undefined }));
                }
              }}
              onBlur={() => {
                if (!name.trim()) {
                  setValidationErrors(prev => ({ ...prev, name: 'Name is required' }));
                }
              }}
              className={`w-full px-4 py-2 bg-[#1A1D3A] border rounded-md text-[#FDFEFF] focus:outline-none focus:ring-1 ${
                validationErrors.name 
                  ? 'border-[#FF5D88] focus:border-[#FF5D88] focus:ring-[#FF5D88]' 
                  : 'border-[#BAB2CF]/20 focus:border-[#FF5D88] focus:ring-[#FF5D88]'
              }`}
              required
              disabled={isSaving}
            />
            {validationErrors.name && (
              <p className="mt-1 text-[#FF5D88] text-sm">{validationErrors.name}</p>
            )}
          </div>

          {/* Location (required) */}
          <div>
            <label className={`${typography.label.default} text-[#FDFEFF] block mb-2`}>
              Location <span className="text-[#FF5D88]">*</span>
              {isLoadingLocation && <span className="ml-2 text-[#BAB2CF] text-sm">(loading...)</span>}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                if (validationErrors.location) {
                  setValidationErrors(prev => ({ ...prev, location: undefined }));
                }
              }}
              onBlur={() => {
                if (!location.trim()) {
                  setValidationErrors(prev => ({ ...prev, location: 'Location is required' }));
                }
              }}
              className={`w-full px-4 py-2 bg-[#1A1D3A] border rounded-md text-[#FDFEFF] focus:outline-none focus:ring-1 ${
                validationErrors.location 
                  ? 'border-[#FF5D88] focus:border-[#FF5D88] focus:ring-[#FF5D88]' 
                  : 'border-[#BAB2CF]/20 focus:border-[#FF5D88] focus:ring-[#FF5D88]'
              }`}
              required
              disabled={isSaving || isLoadingLocation}
            />
            {validationErrors.location && (
              <p className="mt-1 text-[#FF5D88] text-sm">{validationErrors.location}</p>
            )}
          </div>

          {/* Coordinates (read-only) */}
          <div>
            <label className={`${typography.label.default} text-[#FDFEFF] block mb-2`}>
              Coordinates
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={formCoordinates.lat}
                onChange={(e) => {
                  setFormCoordinates({ ...formCoordinates, lat: parseFloat(e.target.value) || 0 });
                  if (validationErrors.coordinates) {
                    setValidationErrors(prev => ({ ...prev, coordinates: undefined }));
                  }
                }}
                onBlur={() => {
                  if (!formCoordinates || isNaN(formCoordinates.lat) || isNaN(formCoordinates.lng)) {
                    setValidationErrors(prev => ({ ...prev, coordinates: 'Valid coordinates are required' }));
                  }
                }}
                step="any"
                className={`flex-1 px-4 py-2 bg-[#1A1D3A] border rounded-md text-[#FDFEFF] focus:outline-none focus:ring-1 ${
                  validationErrors.coordinates 
                    ? 'border-[#FF5D88] focus:border-[#FF5D88] focus:ring-[#FF5D88]' 
                    : 'border-[#BAB2CF]/20 focus:border-[#FF5D88] focus:ring-[#FF5D88]'
                }`}
                placeholder="Latitude"
                disabled={isSaving}
              />
              <input
                type="number"
                value={formCoordinates.lng}
                onChange={(e) => {
                  setFormCoordinates({ ...formCoordinates, lng: parseFloat(e.target.value) || 0 });
                  if (validationErrors.coordinates) {
                    setValidationErrors(prev => ({ ...prev, coordinates: undefined }));
                  }
                }}
                onBlur={() => {
                  if (!formCoordinates || isNaN(formCoordinates.lat) || isNaN(formCoordinates.lng)) {
                    setValidationErrors(prev => ({ ...prev, coordinates: 'Valid coordinates are required' }));
                  }
                }}
                step="any"
                className={`flex-1 px-4 py-2 bg-[#1A1D3A] border rounded-md text-[#FDFEFF] focus:outline-none focus:ring-1 ${
                  validationErrors.coordinates 
                    ? 'border-[#FF5D88] focus:border-[#FF5D88] focus:ring-[#FF5D88]' 
                    : 'border-[#BAB2CF]/20 focus:border-[#FF5D88] focus:ring-[#FF5D88]'
                }`}
                placeholder="Longitude"
                disabled={isSaving}
              />
            </div>
            {validationErrors.coordinates && (
              <p className="mt-1 text-[#FF5D88] text-sm">{validationErrors.coordinates}</p>
            )}
          </div>

          {/* Notes/Description */}
          <div>
            <label className={`${typography.label.default} text-[#FDFEFF] block mb-2`}>
              Notes/Description
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-[#1A1D3A] border border-[#BAB2CF]/20 rounded-md text-[#FDFEFF] focus:outline-none focus:border-[#FF5D88] focus:ring-1 focus:ring-[#FF5D88] resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Images - Up to 3 File Uploads */}
          <div>
            <label className={`${typography.label.default} text-[#FDFEFF] block mb-2`}>
              Images (up to 3)
            </label>
            <div className="space-y-4">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`${typography.label.badge} text-[#BAB2CF] w-20`}>
                      Image {index + 1}:
                    </span>
                    <input
                      ref={fileInputRefs[index]}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange(index)}
                      className="hidden"
                      disabled={isSaving}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRefs[index].current?.click()}
                      className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                        imageFiles[index]
                          ? 'bg-[#1A1D3A] text-[#BAB2CF] border border-[#BAB2CF]/20'
                          : 'bg-[#1A1D3A] text-[#FDFEFF] border border-[#BAB2CF]/20 hover:border-[#FF5D88]'
                      }`}
                      disabled={isSaving}
                    >
                      <Upload size={16} />
                      {imageFiles[index] ? 'Change Image' : 'Upload Image'}
                    </button>
                    {imageFiles[index] && (
                      <button
                        type="button"
                        onClick={() => clearImage(index)}
                        className="px-3 py-2 text-[#BAB2CF] hover:text-[#FDFEFF] text-sm"
                        disabled={isSaving}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  
                  {/* Error message */}
                  {imageFileErrors[index] && (
                    <p className="text-sm text-[#FF5D88] ml-24">{imageFileErrors[index]}</p>
                  )}
                  
                  {/* Preview */}
                  {imagePreviews[index] && (
                    <div className="ml-24 mt-2 rounded-lg overflow-hidden border border-[#BAB2CF]/20">
                      <img
                        src={imagePreviews[index]!}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Architect */}
          <div>
            <label className={`${typography.label.default} text-[#FDFEFF] block mb-2`}>
              Architect
            </label>
            <input
              type="text"
              value={architect}
              onChange={(e) => setArchitect(e.target.value)}
              className="w-full px-4 py-2 bg-[#1A1D3A] border border-[#BAB2CF]/20 rounded-md text-[#FDFEFF] focus:outline-none focus:border-[#FF5D88] focus:ring-1 focus:ring-[#FF5D88]"
              disabled={isSaving}
            />
          </div>

          {/* Style (select from list or type your own) */}
          <div>
            <label className={`${typography.label.default} text-[#FDFEFF] block mb-2`}>
              Style
            </label>
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              list="style-options"
              placeholder="Start typing or choose from list..."
              className="w-full px-4 py-2 bg-[#1A1D3A] border border-[#BAB2CF]/20 rounded-md text-[#FDFEFF] focus:outline-none focus:border-[#FF5D88] focus:ring-1 focus:ring-[#FF5D88]"
              disabled={isSaving}
            />
            <datalist id="style-options">
              {styleOptions.map((styleOption) => (
                <option key={styleOption} value={styleOption} />
              ))}
            </datalist>
            {/* Style suggestion chips */}
            <div className="mt-2 flex flex-wrap gap-2">
              {['Art Deco', 'Brutalism', 'Ancient', 'Stalinist Gothic', 'Modernist'].map((suggestedStyle) => (
                <button
                  key={suggestedStyle}
                  type="button"
                  onClick={() => setStyle(suggestedStyle)}
                  className="px-3 py-1 bg-[#3A3F6B]/80 hover:bg-[#3A3F6B] text-white text-sm rounded-full transition-colors border border-[#3A3F6B]"
                  style={{
                    fontSize: '13px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400
                  }}
                  disabled={isSaving}
                >
                  {suggestedStyle}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#BAB2CF]">
              Choose a style from the list or type a new one (e.g. &quot;Ancient&quot;).
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <PrimaryButton
              theme={theme}
              onClick={handleSubmit}
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Building'}
            </PrimaryButton>
            <button
              type="button"
              onClick={onCancel}
              className={`flex-1 px-6 py-3 rounded-md transition-colors ${colors.accent.bgHover} text-[#BAB2CF] hover:text-[#FDFEFF] border border-[#BAB2CF]/30 hover:border-[#BAB2CF]/50`}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

