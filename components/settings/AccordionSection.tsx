import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

export const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false,
  badge
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-500">{icon}</span>}
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</span>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-600 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      
      <div
        className={`transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="p-4 pt-2 border-t border-slate-100 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AccordionSection;
