import React from 'react';
import { Sliders, RotateCcw } from 'lucide-react';
import { LineSettings } from '../../types';
import { AccordionSection } from './AccordionSection';
import { ColorPicker } from './ColorPicker';
import { Slider } from './Slider';
import { ToggleSwitch } from './ToggleSwitch';
import { Tooltip } from './Tooltip';

interface LineSettingsTabProps {
  settings: LineSettings;
  onUpdate: (settings: LineSettings) => void;
}

const DEFAULT_SETTINGS: LineSettings = {
  primaryColor: '#94a3b8',
  primaryWidth: 2,
  secondaryWidth: 2,
  secondaryStyle: 'dotted',
  cornerRadius: 12,
  useRandomSecondaryColors: true,
  secondaryColor: '#f59e0b'
};

export const LineSettingsTab: React.FC<LineSettingsTabProps> = ({
  settings,
  onUpdate
}) => {
  return (
    <div className="space-y-4">
      {/* Live Preview */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-4 text-center">
          Live Preview
        </p>
        <svg width="100%" height="160" viewBox="0 0 300 160" className="mx-auto">
          {/* Background grid */}
          <defs>
            <pattern id="preview-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1" fill="#e2e8f0" />
            </pattern>
          </defs>
          <rect width="300" height="160" fill="url(#preview-grid)" rx="8" />
          
          {/* Primary Line Example */}
          <g>
            {/* Parent node */}
            <rect x="125" y="10" width="50" height="30" rx="4" fill="#1e293b" />
            <text x="150" y="28" textAnchor="middle" fill="white" fontSize="10" fontWeight="500">CEO</text>
            
            {/* Primary lines to children */}
            <path
              d={`M150,40 L150,55 Q150,${55 + settings.cornerRadius} ${150 - settings.cornerRadius},${55 + settings.cornerRadius} L70,${55 + settings.cornerRadius} L70,70`}
              fill="none"
              stroke={settings.primaryColor}
              strokeWidth={settings.primaryWidth}
              strokeLinecap="round"
            />
            <path
              d={`M150,55 Q150,${55 + settings.cornerRadius} ${150 + settings.cornerRadius},${55 + settings.cornerRadius} L230,${55 + settings.cornerRadius} L230,70`}
              fill="none"
              stroke={settings.primaryColor}
              strokeWidth={settings.primaryWidth}
              strokeLinecap="round"
            />
            
            {/* Child nodes */}
            <rect x="45" y="75" width="50" height="30" rx="4" fill="#3b82f6" />
            <text x="70" y="93" textAnchor="middle" fill="white" fontSize="9" fontWeight="500">Sales</text>
            
            <rect x="205" y="75" width="50" height="30" rx="4" fill="#10b981" />
            <text x="230" y="93" textAnchor="middle" fill="white" fontSize="9" fontWeight="500">Eng</text>
          </g>
          
          {/* Secondary Line Example */}
          <g>
            {/* Secondary line from one child to another */}
            <path
              d="M70,105 L70,130 L150,130 L150,145"
              fill="none"
              stroke={settings.useRandomSecondaryColors ? '#a855f7' : settings.secondaryColor}
              strokeWidth={settings.secondaryWidth}
              strokeDasharray={
                settings.secondaryStyle === 'dotted' ? '0 8' :
                settings.secondaryStyle === 'dashed' ? '10 6' : '0'
              }
              strokeLinecap="round"
            />
            
            {/* Secondary node */}
            <rect x="125" y="125" width="50" height="25" rx="4" fill="#a855f7" opacity="0.9" />
            <text x="150" y="141" textAnchor="middle" fill="white" fontSize="8" fontWeight="500">Support</text>
          </g>
          
          {/* Labels */}
          <text x="15" y="50" fill="#64748b" fontSize="8" fontWeight="500">Primary (Solid)</text>
          <text x="215" y="145" fill="#64748b" fontSize="8" fontWeight="500">Secondary ({settings.secondaryStyle})</text>
        </svg>
      </div>

      {/* Primary Lines */}
      <AccordionSection title="Primary Lines (Solid)" icon={<Sliders size={14} />} defaultOpen>
        <div className="space-y-4">
          <ColorPicker
            label="Line Color"
            tooltip="Color of solid reporting lines"
            value={settings.primaryColor}
            onChange={(color) => onUpdate({ ...settings, primaryColor: color })}
            defaultValue={DEFAULT_SETTINGS.primaryColor}
            showSwatches
          />
          
          <Slider
            label="Line Thickness"
            tooltip="Width of primary connecting lines"
            value={settings.primaryWidth}
            onChange={(value) => onUpdate({ ...settings, primaryWidth: value })}
            min={1}
            max={6}
            step={0.5}
            unit="px"
            showTicks
            tickLabels={['Thin', '', '', '', '', '', '', '', '', 'Thick']}
          />
        </div>
      </AccordionSection>

      {/* Secondary Lines */}
      <AccordionSection title="Secondary Lines (Dotted)" icon={<Sliders size={14} />} defaultOpen>
        <div className="space-y-4">
          <ToggleSwitch
            checked={settings.useRandomSecondaryColors}
            onChange={(checked) => onUpdate({ ...settings, useRandomSecondaryColors: checked })}
            label="Use Random Colors"
            description="Each dotted-line relationship gets a unique color"
          />

          {!settings.useRandomSecondaryColors && (
            <ColorPicker
              label="Base Color"
              tooltip="Color for all secondary lines when random is disabled"
              value={settings.secondaryColor}
              onChange={(color) => onUpdate({ ...settings, secondaryColor: color })}
              defaultValue={DEFAULT_SETTINGS.secondaryColor}
              showSwatches
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-slate-600">Line Style</label>
              <Tooltip content="Visual pattern of secondary lines" />
            </div>
            <div className="flex gap-2">
              {[
                { value: 'dotted', label: 'Dotted', pattern: '••••••' },
                { value: 'dashed', label: 'Dashed', pattern: '— — —' },
                { value: 'solid', label: 'Solid', pattern: '———' }
              ].map(({ value, label, pattern }) => (
                <button
                  key={value}
                  onClick={() => onUpdate({ ...settings, secondaryStyle: value as LineSettings['secondaryStyle'] })}
                  className={`flex-1 px-3 py-2.5 rounded-lg border transition-all ${
                    settings.secondaryStyle === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div className="text-[10px] font-mono tracking-widest mb-0.5">{pattern}</div>
                  <div className="text-xs font-medium">{label}</div>
                </button>
              ))}
            </div>
          </div>

          <Slider
            label="Line Thickness"
            tooltip="Width of secondary connecting lines"
            value={settings.secondaryWidth}
            onChange={(value) => onUpdate({ ...settings, secondaryWidth: value })}
            min={1}
            max={6}
            step={0.5}
            unit="px"
          />
        </div>
      </AccordionSection>

      {/* General Settings */}
      <AccordionSection title="General" icon={<Sliders size={14} />} defaultOpen>
        <Slider
          label="Corner Radius"
          tooltip="Roundness of line corners at turns"
          value={settings.cornerRadius}
          onChange={(value) => onUpdate({ ...settings, cornerRadius: value })}
          min={0}
          max={30}
          step={2}
          unit="px"
          quickValues={[
            { label: 'Sharp', value: 0 },
            { label: 'Subtle', value: 10 },
            { label: 'Smooth', value: 20 },
            { label: 'Round', value: 30 }
          ]}
        />
      </AccordionSection>

      {/* Reset Button */}
      <div className="pt-4 border-t border-slate-200">
        <button
          onClick={() => {
            if (confirm('Reset all line settings to default values?')) {
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

export default LineSettingsTab;
