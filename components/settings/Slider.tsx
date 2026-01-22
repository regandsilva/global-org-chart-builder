import React from 'react';
import { Tooltip } from './Tooltip';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  tooltip?: string;
  unit?: string;
  showValue?: boolean;
  showTicks?: boolean;
  tickLabels?: (string | number)[];
  quickValues?: { label: string; value: number }[];
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  tooltip,
  unit = '',
  showValue = true,
  showTicks = false,
  tickLabels,
  quickValues,
  disabled = false
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50' : ''}`}>
      {/* Label Row */}
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
            {tooltip && <Tooltip content={tooltip} />}
          </div>
          {showValue && (
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {value}{unit}
            </span>
          )}
        </div>
      )}

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 appearance-none bg-slate-200 rounded-full cursor-pointer accent-blue-600
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
            [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
            [&::-webkit-slider-thumb]:hover:bg-blue-700 [&::-webkit-slider-thumb]:transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`
          }}
        />
        
        {/* Tick Marks */}
        {showTicks && (
          <div className="flex justify-between mt-1 px-0.5">
            {tickLabels ? (
              tickLabels.map((tick, i) => (
                <span key={i} className="text-[9px] text-slate-400">{tick}</span>
              ))
            ) : (
              <>
                <span className="text-[9px] text-slate-400">{min}{unit}</span>
                <span className="text-[9px] text-slate-400">{max}{unit}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick Value Buttons */}
      {quickValues && quickValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {quickValues.map(({ label: qLabel, value: qValue }) => (
            <button
              key={qLabel}
              onClick={() => onChange(qValue)}
              disabled={disabled}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                value === qValue
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {qLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Slider;
