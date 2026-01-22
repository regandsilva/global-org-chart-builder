import React, { useState, useMemo } from 'react';
import { 
  Palette, Layout, Eye, Sparkles, MapPin, Search, RotateCcw, 
  Wand2, Moon, Sun, Zap, Building2
} from 'lucide-react';
import { CardSettings, Person } from '../../types';
import { AccordionSection } from './AccordionSection';
import { ColorPicker } from './ColorPicker';
import { Slider } from './Slider';
import { ToggleSwitch } from './ToggleSwitch';
import { Tooltip } from './Tooltip';

interface CardSettingsTabProps {
  settings: CardSettings;
  onUpdate: (settings: CardSettings) => void;
  locationColors: Record<string, string>;
  onSetLocationColor: (loc: string, color: string) => void;
  locations: string[];
  previewPerson?: Person;
}

// Preset themes
const PRESETS = [
  {
    id: 'default',
    name: 'Default',
    icon: <Sun size={14} />,
    preview: 'bg-slate-800',
    settings: {
      headerBgColor: '#1e293b',
      headerTextColor: '#ffffff',
      cardBgColor: '#ffffff',
      cardTextColor: '#1e293b',
      borderRadius: 12,
      shadow: 'md' as const,
      useDeptColorForHeader: false,
      useDeptColorForBadge: true,
      borderColor: '#e2e8f0',
      borderWidth: 1,
      showGradientHeader: false
    }
  },
  {
    id: 'minimal',
    name: 'Minimal',
    icon: <Layout size={14} />,
    preview: 'bg-white border border-slate-200',
    settings: {
      headerBgColor: '#ffffff',
      headerTextColor: '#1e293b',
      cardBgColor: '#ffffff',
      cardTextColor: '#1e293b',
      borderRadius: 8,
      shadow: 'sm' as const,
      useDeptColorForHeader: false,
      useDeptColorForBadge: true,
      borderColor: '#e2e8f0',
      borderWidth: 1,
      showGradientHeader: false
    }
  },
  {
    id: 'colorful',
    name: 'Colorful',
    icon: <Palette size={14} />,
    preview: 'bg-gradient-to-r from-blue-500 to-purple-500',
    settings: {
      useDeptColorForHeader: true,
      useDeptColorForBadge: true,
      useDeptColorForBorder: true,
      borderRadius: 16,
      shadow: 'lg' as const,
      showGradientHeader: false
    }
  },
  {
    id: 'dark',
    name: 'Dark',
    icon: <Moon size={14} />,
    preview: 'bg-zinc-800',
    settings: {
      headerBgColor: '#18181b',
      headerTextColor: '#fafafa',
      cardBgColor: '#27272a',
      cardTextColor: '#fafafa',
      borderRadius: 4,
      shadow: 'xl' as const,
      useDeptColorForHeader: false,
      useDeptColorForBadge: false,
      borderColor: '#3f3f46',
      borderWidth: 1,
      showGradientHeader: false
    }
  },
  {
    id: 'corporate',
    name: 'Corporate',
    icon: <Building2 size={14} />,
    preview: 'bg-blue-900',
    settings: {
      headerBgColor: '#1e3a5f',
      headerTextColor: '#ffffff',
      cardBgColor: '#f8fafc',
      cardTextColor: '#1e293b',
      borderRadius: 4,
      shadow: 'sm' as const,
      useDeptColorForHeader: false,
      useDeptColorForBadge: true,
      borderColor: '#cbd5e1',
      borderWidth: 1,
      showGradientHeader: false
    }
  },
  {
    id: 'modern',
    name: 'Modern',
    icon: <Zap size={14} />,
    preview: 'bg-gradient-to-r from-violet-600 to-indigo-600',
    settings: {
      headerBgColor: '#7c3aed',
      headerTextColor: '#ffffff',
      cardBgColor: '#ffffff',
      cardTextColor: '#1e293b',
      borderRadius: 20,
      shadow: 'lg' as const,
      useDeptColorForHeader: false,
      useDeptColorForBadge: true,
      borderColor: '#e2e8f0',
      borderWidth: 0,
      showGradientHeader: true
    }
  }
];

const DEFAULT_SETTINGS: CardSettings = {
  headerBgColor: '#1e293b',
  headerTextColor: '#ffffff',
  cardBgColor: '#ffffff',
  cardTextColor: '#1e293b',
  borderColor: '#e2e8f0',
  useDeptColorForHeader: false,
  useDeptColorForBadge: true,
  useDeptColorForBorder: false,
  width: 288,
  borderRadius: 12,
  borderWidth: 1,
  shadow: 'md',
  padding: 'normal',
  headerAlignment: 'center',
  nameSize: 'medium',
  titleSize: 'small',
  showTitle: true,
  bodyAlignment: 'left',
  showAvatar: true,
  avatarSize: 'medium',
  avatarPosition: 'left',
  avatarShape: 'circle',
  showDepartment: true,
  showLocation: true,
  showLocationFlag: true,
  showEmail: false,
  showPhone: false,
  showSecondaryManager: true,
  fontFamily: 'default',
  hoverEffect: 'lift',
  showGradientHeader: false
};

export const CardSettingsTab: React.FC<CardSettingsTabProps> = ({
  settings,
  onUpdate,
  locationColors,
  onSetLocationColor,
  locations,
  previewPerson
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const handleAddRecentColor = (color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 8);
    });
  };

  // Active preset detection
  const activePreset = useMemo(() => {
    return PRESETS.find(preset => {
      return Object.entries(preset.settings).every(([key, value]) => {
        return settings[key as keyof CardSettings] === value;
      });
    })?.id || null;
  }, [settings]);

  // Filter sections based on search
  const filterMatch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const showColorsSection = filterMatch('color header background text border department');
  const showLayoutSection = filterMatch('layout width radius border shadow padding font');
  const showHeaderSection = filterMatch('header alignment name title size gradient');
  const showAvatarSection = filterMatch('avatar size shape position body');
  const showVisibilitySection = filterMatch('show hide visibility avatar title department location email phone secondary flag');
  const showEffectsSection = filterMatch('effect hover glow lift scale');
  const showLocationSection = filterMatch('location color');

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        )}
      </div>

      {/* Quick Presets */}
      {filterMatch('preset theme style') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 size={14} className="text-slate-500" />
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Presets</h4>
            </div>
            <button
              onClick={() => {
                // TODO: Future - save custom preset
              }}
              className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
            >
              + Save Custom
            </button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onUpdate({ ...settings, ...preset.settings })}
                className={`p-2 rounded-lg border transition-all text-center group ${
                  activePreset === preset.id
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <div className={`w-full h-6 rounded ${preset.preview} mb-1.5 group-hover:scale-105 transition-transform`} />
                <div className="flex items-center justify-center gap-1">
                  <span className="text-slate-500">{preset.icon}</span>
                  <span className="text-[10px] font-medium text-slate-600">{preset.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colors Section */}
      {showColorsSection && (
        <AccordionSection title="Colors" icon={<Palette size={14} />} defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorPicker
              label="Header Background"
              tooltip="Background color of the card header section"
              value={settings.headerBgColor}
              onChange={(color) => onUpdate({ ...settings, headerBgColor: color })}
              disabled={settings.useDeptColorForHeader}
              recentColors={recentColors}
              onAddRecentColor={handleAddRecentColor}
              defaultValue={DEFAULT_SETTINGS.headerBgColor}
            />
            
            <ColorPicker
              label="Header Text"
              tooltip="Text color for name and title in header"
              value={settings.headerTextColor}
              onChange={(color) => onUpdate({ ...settings, headerTextColor: color })}
              recentColors={recentColors}
              onAddRecentColor={handleAddRecentColor}
              defaultValue={DEFAULT_SETTINGS.headerTextColor}
            />

            <ColorPicker
              label="Card Background"
              tooltip="Background color of the card body"
              value={settings.cardBgColor}
              onChange={(color) => onUpdate({ ...settings, cardBgColor: color })}
              recentColors={recentColors}
              onAddRecentColor={handleAddRecentColor}
              defaultValue={DEFAULT_SETTINGS.cardBgColor}
            />

            <ColorPicker
              label="Card Text"
              tooltip="Text color for card body content"
              value={settings.cardTextColor}
              onChange={(color) => onUpdate({ ...settings, cardTextColor: color })}
              recentColors={recentColors}
              onAddRecentColor={handleAddRecentColor}
              defaultValue={DEFAULT_SETTINGS.cardTextColor}
            />

            <ColorPicker
              label="Border Color"
              tooltip="Color of the card border"
              value={settings.borderColor || '#e2e8f0'}
              onChange={(color) => onUpdate({ ...settings, borderColor: color })}
              disabled={settings.useDeptColorForBorder}
              recentColors={recentColors}
              onAddRecentColor={handleAddRecentColor}
              defaultValue={DEFAULT_SETTINGS.borderColor}
            />
          </div>

          {/* Department Color Overrides */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3 mt-4">
            <p className="text-xs font-medium text-slate-600 flex items-center gap-2">
              <Building2 size={14} />
              Department Color Overrides
            </p>
            
            <ToggleSwitch
              checked={settings.useDeptColorForHeader}
              onChange={(checked) => onUpdate({ ...settings, useDeptColorForHeader: checked })}
              label="Use Department Color for Header"
              description="Header will match department theme color"
            />

            <ToggleSwitch
              checked={settings.useDeptColorForBadge}
              onChange={(checked) => onUpdate({ ...settings, useDeptColorForBadge: checked })}
              label="Use Department Color for Badge"
              description="Department badge will be colorful"
            />

            <ToggleSwitch
              checked={settings.useDeptColorForBorder}
              onChange={(checked) => onUpdate({ ...settings, useDeptColorForBorder: checked })}
              label="Use Department Color for Border"
              description="Subtle colored border around card"
            />
          </div>
        </AccordionSection>
      )}

      {/* Layout & Dimensions */}
      {showLayoutSection && (
        <AccordionSection title="Layout & Dimensions" icon={<Layout size={14} />} defaultOpen>
          <div className="space-y-4">
            <Slider
              label="Card Width"
              tooltip="Width of each card in pixels"
              value={settings.width}
              onChange={(value) => onUpdate({ ...settings, width: value })}
              min={200}
              max={400}
              step={8}
              unit="px"
              quickValues={[
                { label: 'Compact', value: 240 },
                { label: 'Standard', value: 288 },
                { label: 'Wide', value: 360 }
              ]}
            />

            <Slider
              label="Corner Radius"
              tooltip="Roundness of card corners"
              value={settings.borderRadius}
              onChange={(value) => onUpdate({ ...settings, borderRadius: value })}
              min={0}
              max={24}
              step={2}
              unit="px"
              showTicks
              tickLabels={['Sharp', '', '', '', '', '', '', '', '', '', '', '', 'Rounded']}
              quickValues={[
                { label: 'Sharp', value: 0 },
                { label: 'Subtle', value: 8 },
                { label: 'Rounded', value: 16 },
                { label: 'Pill', value: 24 }
              ]}
            />

            <Slider
              label="Border Width"
              tooltip="Thickness of the card border"
              value={settings.borderWidth || 1}
              onChange={(value) => onUpdate({ ...settings, borderWidth: value })}
              min={0}
              max={4}
              step={1}
              unit="px"
            />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-medium text-slate-600">Shadow</label>
                  <Tooltip content="Drop shadow intensity" />
                </div>
                <select
                  value={settings.shadow}
                  onChange={(e) => onUpdate({ ...settings, shadow: e.target.value as CardSettings['shadow'] })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra Large</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-medium text-slate-600">Padding</label>
                  <Tooltip content="Internal spacing within the card" />
                </div>
                <select
                  value={settings.padding}
                  onChange={(e) => onUpdate({ ...settings, padding: e.target.value as CardSettings['padding'] })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="spacious">Spacious</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-medium text-slate-600">Font</label>
                  <Tooltip content="Typography style for the card" />
                </div>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => onUpdate({ ...settings, fontFamily: e.target.value as CardSettings['fontFamily'] })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="default">Sans-serif</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Monospace</option>
                </select>
              </div>
            </div>
          </div>
        </AccordionSection>
      )}

      {/* Header Settings */}
      {showHeaderSection && (
        <AccordionSection title="Header" icon={<Layout size={14} />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Alignment</label>
              <select
                value={settings.headerAlignment}
                onChange={(e) => onUpdate({ ...settings, headerAlignment: e.target.value as CardSettings['headerAlignment'] })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Name Size</label>
              <select
                value={settings.nameSize}
                onChange={(e) => onUpdate({ ...settings, nameSize: e.target.value as CardSettings['nameSize'] })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Title Size</label>
              <select
                value={settings.titleSize}
                onChange={(e) => onUpdate({ ...settings, titleSize: e.target.value as CardSettings['titleSize'] })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div className="space-y-2 flex items-end">
              <ToggleSwitch
                checked={settings.showGradientHeader || false}
                onChange={(checked) => onUpdate({ ...settings, showGradientHeader: checked })}
                label="Gradient"
              />
            </div>
          </div>
        </AccordionSection>
      )}

      {/* Avatar & Body */}
      {showAvatarSection && (
        <AccordionSection title="Avatar & Body" icon={<Eye size={14} />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Avatar Size</label>
              <select
                value={settings.avatarSize}
                onChange={(e) => onUpdate({ ...settings, avatarSize: e.target.value as CardSettings['avatarSize'] })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Avatar Shape</label>
              <select
                value={settings.avatarShape}
                onChange={(e) => onUpdate({ ...settings, avatarShape: e.target.value as CardSettings['avatarShape'] })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="circle">Circle</option>
                <option value="rounded">Rounded</option>
                <option value="square">Square</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Avatar Position</label>
              <select
                value={settings.avatarPosition}
                onChange={(e) => onUpdate({ ...settings, avatarPosition: e.target.value as CardSettings['avatarPosition'] })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Body Alignment</label>
              <select
                value={settings.bodyAlignment}
                onChange={(e) => onUpdate({ ...settings, bodyAlignment: e.target.value as CardSettings['bodyAlignment'] })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </AccordionSection>
      )}

      {/* Visibility */}
      {showVisibilitySection && (
        <AccordionSection title="Show / Hide Elements" icon={<Eye size={14} />} defaultOpen>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'showAvatar', label: 'Avatar / Photo', tooltip: 'Display the person\'s avatar or initials' },
              { key: 'showTitle', label: 'Job Title', tooltip: 'Show job title in the header' },
              { key: 'showDepartment', label: 'Department Badge', tooltip: 'Display department as a colored badge' },
              { key: 'showLocation', label: 'Location', tooltip: 'Show location with a pin icon' },
              { key: 'showLocationFlag', label: 'Country Flag 🏳️', tooltip: 'Show emoji flag for countries (e.g. 🇺🇸 🇬🇧 🇨🇳)' },
              { key: 'showEmail', label: 'Email Address', tooltip: 'Display email if available' },
              { key: 'showPhone', label: 'Phone Number', tooltip: 'Display phone if available' },
              { key: 'showSecondaryManager', label: 'Secondary Manager', tooltip: 'Show dotted-line reporting relationship' }
            ].map(({ key, label, tooltip }) => (
              <label
                key={key}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  key === 'showLocationFlag' && !settings.showLocation
                    ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={settings[key as keyof CardSettings] as boolean}
                  onChange={(e) => onUpdate({ ...settings, [key]: e.target.checked })}
                  disabled={key === 'showLocationFlag' && !settings.showLocation}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                  {label}
                  <Tooltip content={tooltip} />
                </span>
              </label>
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Effects */}
      {showEffectsSection && (
        <AccordionSection title="Effects & Interactions" icon={<Sparkles size={14} />}>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">Hover Effect</label>
                <Tooltip content="Animation when hovering over cards" />
              </div>
              <div className="flex gap-2">
                {[
                  { value: 'lift', label: 'Lift', icon: '↑' },
                  { value: 'glow', label: 'Glow', icon: '✨' },
                  { value: 'scale', label: 'Scale', icon: '⤢' },
                  { value: 'none', label: 'None', icon: '—' }
                ].map(({ value, label, icon }) => (
                  <button
                    key={value}
                    onClick={() => onUpdate({ ...settings, hoverEffect: value as CardSettings['hoverEffect'] })}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                      settings.hoverEffect === value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <span className="mr-1">{icon}</span> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </AccordionSection>
      )}

      {/* Location Colors */}
      {showLocationSection && locations.length > 0 && (
        <AccordionSection title="Location Colors" icon={<MapPin size={14} />} badge={locations.length}>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {locations.map((loc) => (
              <div
                key={loc}
                className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{loc}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={locationColors[loc] || '#64748b'}
                      onChange={(e) => onSetLocationColor(loc, e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0.5"
                    />
                    <button
                      onClick={() => onSetLocationColor(loc, '')}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
                
                {/* Quick Color Palette */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '#64748b', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
                    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => onSetLocationColor(loc, color)}
                      className={`w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform ${
                        locationColors[loc] === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Reset Button */}
      <div className="pt-4 border-t border-slate-200">
        <button
          onClick={() => {
            if (confirm('Reset all card settings to default values?')) {
              onUpdate(DEFAULT_SETTINGS);
            }
          }}
          className="w-full px-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={12} /> Reset All to Defaults
        </button>
      </div>
    </div>
  );
};

export default CardSettingsTab;
