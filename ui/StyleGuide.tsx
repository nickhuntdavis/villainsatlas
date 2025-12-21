import React, { useState, useEffect } from 'react';
import { Theme, getThemeColors, typography, spacing, radius, shadows, blur, GENRE_COLORS } from './theme';
import { IconButton, PrimaryButton, SurfaceCard, Badge, StatusStrip, createMarkerIcon } from './atoms';
import { SearchPanel } from '../components/SearchPanel';
import { BuildingDetails } from '../components/BuildingDetails';
import { Building, Coordinates } from '../types';
import { MapPin, Search, Loader2, Heart, Sun, Moon } from 'lucide-react';

// Simple theme hook reusing the same localStorage key as App
const useTheme = (): [Theme, (next: Theme) => void] => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('evil-atlas-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('evil-atlas-theme', theme);
    }
  }, [theme]);

  const set = (next: Theme) => setTheme(next);
  return [theme, set];
};

// Mock building for the details panel showcase
const MOCK_BUILDING: Building = {
  id: 'mock-1',
  name: 'Palace of Ominous Governance',
  location: 'Unknown Sector, Classified Coordinates',
  description:
    'A composite exemplar used only for UI styling. Any resemblance to real regimes, living or dead, is purely coincidental.',
  style: 'Stalinist Gothic' as any,
  coordinates: { lat: 51.5074, lng: -0.1278 },
  city: 'Sector 7',
  country: 'Unknown',
  isPrioritized: true,
};

export const StyleGuide: React.FC = () => {
  const [theme, setTheme] = useTheme();
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';

  // For StatusStrip demo
  const [statusIndex, setStatusIndex] = useState(0);
  const loadingMessages = [
    'searching evil archives...',
    'searching dark web...',
    'querying evil database...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // Helper to render a marker preview using the MarkerIcon atom
  const renderMarkerPreview = (label: string, color: string, selected: boolean, variant: 'standard' | 'nick' = 'standard') => {
    const icon = createMarkerIcon({ color, isSelected: selected, variant });
    const html = (icon as any).options?.html as string | undefined;
    return (
      <div className="flex flex-col items-center gap-1">
        {html ? (
          // SECURITY NOTE: dangerouslySetInnerHTML is safe here because:
          // 1. This is an internal dev tool (StyleGuide) only
          // 2. HTML comes from createMarkerIcon() which is a controlled, trusted source
          // 3. No user input is involved in generating this HTML
          <div
            className="w-10 h-10 flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zinc-700" />
        )}
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
    );
  };

  return (
    <div className={`min-h-screen w-full ${colors.background.default} text-base`}>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className={`${typography.heading.lg} ${colors.text.primary}`}>Villain&apos;s Atlas Style Guide</h1>
            <p className={`mt-2 text-sm ${colors.text.muted}`}>
              Internal design system catalogue. Edit tokens/atoms here to cascade changes across the app.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-mono uppercase tracking-widest ${colors.text.muted}`}>
              Theme: {theme}
            </span>
            <IconButton
              theme={theme}
              onClick={toggleTheme}
              icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              title="Toggle theme"
              variant="subtle"
            />
          </div>
        </header>

        {/* Tokens Section */}
        <section>
          <h2 className={`${typography.heading.sm} ${colors.text.primary} mb-3`}>Tokens</h2>
          <p className={`text-sm mb-4 ${colors.text.muted}`}>
            Core design tokens from <code>ui/theme.ts</code>. Update these for global changes.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Background Colors */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Backgrounds</h3>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border ${colors.background.default} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>default</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border ${colors.background.surface} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>surface</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border ${colors.background.elevated} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>elevated</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-12 rounded border bg-[#262334]/95 border-[#262334]" />
                  <span className={`${colors.text.muted} text-[10px]`}>panel</span>
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <div className={`h-12 rounded border ${colors.background.overlay} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>overlay</span>
                </div>
              </div>
            </SurfaceCard>

            {/* Text Colors */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Text</h3>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border ${colors.text.primary} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>primary</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border ${colors.text.secondary} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>secondary</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border ${colors.text.tertiary} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>tertiary</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border ${colors.text.muted} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>muted</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border ${colors.text.disabled} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>disabled</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border ${colors.text.placeholder} ${colors.border.default}`} />
                  <span className={`${colors.text.muted} text-[10px]`}>placeholder</span>
                </div>
              </div>
            </SurfaceCard>

            {/* Border Colors */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Borders</h3>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border-2 ${colors.border.subtle} bg-transparent`} />
                  <span className={`${colors.text.muted} text-[10px]`}>subtle</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border-2 ${colors.border.default} bg-transparent`} />
                  <span className={`${colors.text.muted} text-[10px]`}>default</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border-2 ${colors.border.strong} bg-transparent`} />
                  <span className={`${colors.text.muted} text-[10px]`}>strong</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`h-12 rounded border-2 ${colors.border.accent} bg-transparent`} />
                  <span className={`${colors.text.muted} text-[10px]`}>accent</span>
                </div>
              </div>
            </SurfaceCard>
          </div>

          {/* Accent Colors - Comprehensive */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Accent Colors</h3>
              <div className="space-y-3">
                <div>
                  <div className={`text-[10px] ${colors.text.muted} mb-2 uppercase tracking-wider`}>Text</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border ${colors.accent.primary} ${colors.border.default} flex items-center justify-center`}>
                        <span className={`${colors.accent.primary} text-xs font-bold`}>Aa</span>
                      </div>
                      <span className={`${colors.text.muted} text-[10px]`}>primary</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border ${colors.accent.hover} ${colors.border.default} flex items-center justify-center`}>
                        <span className={`${colors.accent.hover} text-xs font-bold`}>Aa</span>
                      </div>
                      <span className={`${colors.text.muted} text-[10px]`}>hover</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className={`text-[10px] ${colors.text.muted} mb-2 uppercase tracking-wider`}>Background</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border ${colors.accent.bg} ${colors.border.default}`} />
                      <span className={`${colors.text.muted} text-[10px]`}>bg</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border ${colors.accent.bgHover.replace(/^hover:/, '')} ${colors.border.default}`} />
                      <span className={`${colors.text.muted} text-[10px]`}>bgHover</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className={`text-[10px] ${colors.text.muted} mb-2 uppercase tracking-wider`}>Border</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border-2 ${colors.accent.border} bg-transparent`} />
                      <span className={`${colors.text.muted} text-[10px]`}>border</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border-2 ${colors.accent.borderHover} bg-transparent`} />
                      <span className={`${colors.text.muted} text-[10px]`}>borderHover</span>
                    </div>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            {/* Error/Alert Colors */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Error / Alert</h3>
              <div className="space-y-3">
                <div>
                  <div className={`text-[10px] ${colors.text.muted} mb-2 uppercase tracking-wider`}>Toast Colors</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border bg-red-950/90 ${colors.border.default}`} />
                      <span className={`${colors.text.muted} text-[10px]`}>bg (toast)</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border border-red-600 bg-transparent border-l-4`} />
                      <span className={`${colors.text.muted} text-[10px]`}>border (toast)</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border text-red-200 ${colors.border.default} flex items-center justify-center`}>
                        <span className="text-red-200 text-xs font-bold">Aa</span>
                      </div>
                      <span className={`${colors.text.muted} text-[10px]`}>text (toast)</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border bg-red-900 ${colors.border.default}`} />
                      <span className={`${colors.text.muted} text-[10px]`}>bg (N button)</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className={`text-[10px] ${colors.text.muted} mb-2 uppercase tracking-wider`}>Other Accent Uses</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border bg-red-900/10 ${colors.border.default}`} />
                      <span className={`${colors.text.muted} text-[10px]`}>hover glow</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`h-10 rounded border bg-gradient-to-r from-red-900 via-red-600 to-red-900 ${colors.border.default}`} />
                      <span className={`${colors.text.muted} text-[10px]`}>decorative</span>
                    </div>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          </div>

          {/* Genre Colors - Comprehensive */}
          <div className="mt-4">
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Genre / Style Colors</h3>
              <p className={`text-xs ${colors.text.muted} mb-3`}>
                All architectural style colors used in badges and markers. Edit in <code>constants.ts</code>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(GENRE_COLORS).map(([style, color]) => (
                  <div key={style} className="flex flex-col gap-1">
                    <div 
                      className="h-12 rounded border border-zinc-700 flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    />
                    <span className={`${colors.text.muted} text-[10px] text-center leading-tight`}>{style}</span>
                    <span className={`${colors.text.muted} text-[9px] text-center font-mono opacity-60`}>{color}</span>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>

          {/* Typography & Spacing Tokens */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {/* Typography */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Typography</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">heading.lg</div>
                  <div className={`${typography.heading.lg} ${colors.text.primary}`}>Villainous Heading</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">body.default</div>
                  <p className={`${typography.body.default} ${colors.text.tertiary}`}>
                    This is standard body copy used throughout the interface.
                  </p>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">mono.default</div>
                  <p className={`${typography.mono.default} ${colors.text.muted}`}>SECTOR-ALPHA / GRID-42</p>
                </div>
              </div>
            </SurfaceCard>

            {/* Spacing / Radius / Shadows */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Spacing, Radius, Shadows</h3>
              <div className="space-y-2 text-[11px]">
                <div className={`${spacing.md} ${colors.background.elevated} ${colors.border.default} border rounded ${colors.text.primary} text-[10px]`}>
                  spacing.md
                </div>
                <div className={`p-2 ${radius.lg} ${colors.background.elevated} ${colors.border.default} border ${colors.text.primary} text-[10px]`}>
                  radius.lg
                </div>
                <div className={`p-2 ${shadows['2xl']} ${colors.background.elevated} ${colors.border.default} border ${colors.text.primary} text-[10px]`}>
                  shadow.2xl
                </div>
                <div className={`p-2 ${blur.md} ${colors.background.elevated} ${colors.border.default} border ${colors.text.primary} text-[10px]`}>
                  blur.md
                </div>
              </div>
            </SurfaceCard>
          </div>
        </section>

        {/* Atoms Section */}
        <section>
          <h2 className={`${typography.heading.sm} ${colors.text.primary} mb-3`}>Atoms</h2>
          <p className={`text-sm mb-4 ${colors.text.muted}`}>Reusable building blocks from <code>ui/atoms/</code>.</p>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Buttons */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Buttons</h3>
              <div className="flex flex-col gap-2">
                <PrimaryButton theme={theme}>Primary Button</PrimaryButton>
                <PrimaryButton theme={theme} disabled>
                  Disabled Primary
                </PrimaryButton>
                <div className="flex gap-2">
                  <IconButton theme={theme} icon={<Search size={16} />} onClick={() => {}} title="Default" />
                  <IconButton
                    theme={theme}
                    icon={<MapPin size={16} />}
                    onClick={() => {}}
                    title="Accent"
                    variant="accent"
                  />
                  <IconButton
                    theme={theme}
                    icon={<Heart size={16} />}
                    onClick={() => {}}
                    title="Subtle"
                    variant="subtle"
                  />
                </div>
              </div>
            </SurfaceCard>

            {/* Badges & Status */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Badges & Status</h3>
              <div className="flex flex-wrap gap-2">
                <Badge theme={theme} color={GENRE_COLORS['Stalinist Gothic']}>
                  Stalinist Gothic
                </Badge>
                <Badge theme={theme} color={GENRE_COLORS['Brutalism']}>
                  Brutalism
                </Badge>
                <Badge theme={theme} color={GENRE_COLORS['Art Deco']}>
                  Art Deco
                </Badge>
                <Badge theme={theme} color={GENRE_COLORS['Cyberpunk']}>
                  Cyberpunk
                </Badge>
              </div>
              <StatusStrip
                theme={theme}
                statusText={loadingMessages[statusIndex]}
                isVisible={true}
              />
            </SurfaceCard>

            {/* Marker Icons */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 space-y-3">
              <h3 className={`${typography.label.button} ${colors.text.secondary}`}>Marker Icons</h3>
              <div className="flex items-center gap-4">
                {renderMarkerPreview('Standard', GENRE_COLORS['Brutalism'], false)}
                {renderMarkerPreview('Selected', GENRE_COLORS['Stalinist Gothic'], true)}
                {renderMarkerPreview('Nick', '#ef4444', true, 'nick')}
              </div>
            </SurfaceCard>
          </div>
        </section>

        {/* Molecules Section */}
        <section>
          <h2 className={`${typography.heading.sm} ${colors.text.primary} mb-3`}>Molecules</h2>
          <p className={`text-sm mb-4 ${colors.text.muted}`}>
            Static, non-wired examples of key molecules. Callbacks are mocked to avoid touching real data or APIs.
          </p>

          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* Search Panel (static) */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-4 relative overflow-hidden">
              <div className="text-[11px] font-mono uppercase tracking-widest mb-2 text-zinc-500">
                SearchPanel (static)
              </div>
              <div className="relative h-40 bg-zinc-900/40 rounded-lg overflow-hidden">
                <div className="absolute inset-0 flex items-start justify-center pt-4">
                  <SearchPanel
                    onSearch={() => {}}
                    onLocateMe={() => {}}
                    onFindNearest={() => {}}
                    onSearchArea={() => {}}
                    isLoading={false}
                    searchStatus="idle"
                    theme={theme}
                    onToggleTheme={toggleTheme}
                  />
                </div>
              </div>
            </SurfaceCard>

            {/* Building Details (mock data) */}
            <SurfaceCard theme={theme} level="panel" withBlur withShadow className="p-0 overflow-hidden">
              <div className="text-[11px] font-mono uppercase tracking-widest px-4 pt-3 pb-1 text-zinc-500">
                BuildingDetails (mock)
              </div>
              <div className="relative h-[420px] overflow-hidden">
                <BuildingDetails building={MOCK_BUILDING} onClose={() => {}} theme={theme} />
              </div>
            </SurfaceCard>
          </div>
        </section>
      </div>
    </div>
  );
};



