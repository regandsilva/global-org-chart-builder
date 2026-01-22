import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, MapPin, X } from 'lucide-react';
import { COUNTRIES, SPECIAL_LOCATIONS, getFlagImageUrl, getLocationFlag } from '../countries';

interface LocationSelectProps {
  value: string;
  onChange: (value: string) => void;
  customLocations?: string[];
  className?: string;
}

export const LocationSelect: React.FC<LocationSelectProps> = ({
  value,
  onChange,
  customLocations = [],
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter locations based on search
  const filteredCustom = customLocations.filter(l => 
    !COUNTRIES.find(c => c.name === l) && 
    !SPECIAL_LOCATIONS.find(s => s.name === l) &&
    l.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSpecial = SPECIAL_LOCATIONS.filter(loc =>
    loc.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(search.toLowerCase()) ||
    country.code.toLowerCase().includes(search.toLowerCase()) ||
    country.aliases?.some(a => a.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (loc: string) => {
    onChange(loc);
    setIsOpen(false);
    setSearch('');
  };

  const renderFlag = (location: string, size: 'sm' | 'md' = 'sm') => {
    const imgSize = size === 'sm' ? 'w-5 h-3.5' : 'w-6 h-4';
    const flagUrl = getFlagImageUrl(location, 'w80'); // Higher quality
    
    if (flagUrl) {
      return (
        <img 
          src={flagUrl} 
          alt=""
          className={`${imgSize} object-cover rounded-[2px] shadow-sm`}
          loading="lazy"
        />
      );
    }
    
    // Fallback to emoji for special locations
    const emoji = getLocationFlag(location);
    return emoji ? <span className="text-base">{emoji}</span> : <MapPin size={14} className="text-slate-400" />;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected value button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-lg text-sm bg-white flex items-center gap-2 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-left"
      >
        {renderFlag(value)}
        <span className="truncate">{value || 'Select location...'}</span>
      </button>
      <ChevronDown 
        size={14} 
        className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} 
      />

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search countries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-60">
            {/* Custom locations */}
            {filteredCustom.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                  Custom Locations
                </div>
                {filteredCustom.map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleSelect(loc)}
                    className={`w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors ${value === loc ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                  >
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{loc}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Special locations */}
            {filteredSpecial.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                  Work Type
                </div>
                {filteredSpecial.map(loc => (
                  <button
                    key={loc.code}
                    type="button"
                    onClick={() => handleSelect(loc.name)}
                    className={`w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors ${value === loc.name ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                  >
                    <span className="text-base shrink-0">{loc.flag}</span>
                    <span className="truncate">{loc.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Countries */}
            {filteredCountries.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                  Countries
                </div>
                {filteredCountries.map(country => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleSelect(country.name)}
                    className={`w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors ${value === country.name ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                  >
                    <img 
                      src={`https://flagcdn.com/w80/${country.code.toLowerCase()}.png`}
                      alt=""
                      className="w-5 h-3.5 object-cover rounded-[2px] shadow-sm shrink-0"
                      loading="lazy"
                    />
                    <span className="truncate">{country.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {filteredCustom.length === 0 && filteredSpecial.length === 0 && filteredCountries.length === 0 && (
              <div className="px-3 py-6 text-sm text-slate-400 text-center">
                No locations found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
