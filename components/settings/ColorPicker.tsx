import React, { useState, useMemo } from 'react';
import { RotateCcw, Copy, Check } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  description?: string;
  tooltip?: string;
  disabled?: boolean;
  showSwatches?: boolean;
  showHex?: boolean;
  recentColors?: string[];
  onAddRecentColor?: (color: string) => void;
  defaultValue?: string;
}

const PRESET_SWATCHES = [
  // Neutrals
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#000000',
  // Colors
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label,
  description,
  tooltip,
  disabled = false,
  showSwatches = true,
  showHex = true,
  recentColors = [],
  onAddRecentColor,
  defaultValue
}) => {
  const [copied, setCopied] = useState(false);

  const handleColorChange = (newColor: string) => {
    onChange(newColor);
    if (onAddRecentColor && newColor !== value) {
      onAddRecentColor(newColor);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleReset = () => {
    if (defaultValue) {
      onChange(defaultValue);
    }
  };

  // Compute contrast for text color suggestion
  const textContrast = useMemo(() => {
    const hex = value.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'dark' : 'light';
  }, [value]);

  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Label Row */}
      {(label || tooltip) && (
        <div className="flex items-center gap-1.5">
          {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
          {tooltip && <Tooltip content={tooltip} />}
        </div>
      )}
      {description && <p className="text-[10px] text-slate-400 -mt-1">{description}</p>}

      {/* Color Input Row */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-1"
            disabled={disabled}
          />
          <div 
            className="absolute inset-1 rounded pointer-events-none"
            style={{ backgroundColor: value }}
          />
        </div>
        
        {showHex && (
          <div className="flex-1 flex items-center gap-1">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                  handleColorChange(val);
                }
              }}
              onBlur={(e) => {
                // Validate and fix on blur
                const val = e.target.value;
                if (!/^#[0-9A-Fa-f]{6}$/.test(val)) {
                  handleColorChange(defaultValue || '#000000');
                }
              }}
              className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono uppercase"
              disabled={disabled}
              maxLength={7}
            />
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              title="Copy color"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
            {defaultValue && value !== defaultValue && (
              <button
                onClick={handleReset}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Reset to default"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 font-medium">Recent</p>
          <div className="flex flex-wrap gap-1">
            {recentColors.slice(0, 8).map((color, i) => (
              <button
                key={`${color}-${i}`}
                onClick={() => handleColorChange(color)}
                className={`w-5 h-5 rounded border border-slate-200 hover:scale-110 transition-transform ${
                  value === color ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Preset Swatches */}
      {showSwatches && (
        <div className="flex flex-wrap gap-1">
          {PRESET_SWATCHES.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className={`w-5 h-5 rounded border border-slate-200 hover:scale-110 transition-transform ${
                value === color ? 'ring-2 ring-blue-500 ring-offset-1' : ''
              } ${color === '#ffffff' ? 'border-slate-300' : ''}`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
