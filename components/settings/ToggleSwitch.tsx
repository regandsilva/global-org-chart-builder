import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md'
}) => {
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'translate-x-5' },
    lg: { track: 'w-12 h-6', thumb: 'w-5 h-5', translate: 'translate-x-6' }
  };

  const { track, thumb, translate } = sizes[size];

  return (
    <label className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) onChange(!checked);
          }
        }}
        onClick={() => !disabled && onChange(!checked)}
        className={`${track} rounded-full p-0.5 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <div
          className={`${thumb} bg-white rounded-full shadow-sm transition-transform duration-200 ${
            checked ? translate : 'translate-x-0'
          }`}
        />
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-xs font-medium text-slate-700">{label}</span>}
          {description && <span className="text-[10px] text-slate-400">{description}</span>}
        </div>
      )}
    </label>
  );
};

export default ToggleSwitch;
