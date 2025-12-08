import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Person, CardSettings } from '../types';
import { MapPin, GripVertical, Link, Crown, MoreHorizontal, Mail, Phone, Users } from 'lucide-react';

// Enhanced color mapping for department styles
const getDeptStyle = (deptColor: string = 'slate') => {
  const styles: Record<string, { header: string, border: string, badge: string }> = {
    slate: { 
      header: 'bg-slate-700 text-white', 
      border: 'border-slate-300', 
      badge: 'bg-slate-700 text-white border border-slate-600' 
    },
    emerald: { 
      header: 'bg-emerald-600 text-white', 
      border: 'border-emerald-200', 
      badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
    },
    blue: { 
      header: 'bg-blue-600 text-white', 
      border: 'border-blue-200', 
      badge: 'bg-blue-100 text-blue-700 border border-blue-200' 
    },
    amber: { 
      header: 'bg-amber-500 text-white', 
      border: 'border-amber-200', 
      badge: 'bg-amber-100 text-amber-700 border border-amber-200' 
    },
    purple: { 
      header: 'bg-purple-600 text-white', 
      border: 'border-purple-200', 
      badge: 'bg-purple-100 text-purple-700 border border-purple-200' 
    },
    rose: { 
      header: 'bg-rose-600 text-white', 
      border: 'border-rose-200', 
      badge: 'bg-rose-100 text-rose-700 border border-rose-200' 
    },
    cyan: { 
      header: 'bg-cyan-600 text-white', 
      border: 'border-cyan-200', 
      badge: 'bg-cyan-100 text-cyan-700 border border-cyan-200' 
    },
    orange: { 
      header: 'bg-orange-500 text-white', 
      border: 'border-orange-200', 
      badge: 'bg-orange-100 text-orange-700 border border-orange-200' 
    },
    indigo: { 
      header: 'bg-indigo-600 text-white', 
      border: 'border-indigo-200', 
      badge: 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
    },
    teal: { 
      header: 'bg-teal-600 text-white', 
      border: 'border-teal-200', 
      badge: 'bg-teal-100 text-teal-700 border border-teal-200' 
    },
  };
  return styles[deptColor] || styles.slate;
};

interface CardProps {
  person: Person;
  onClick: (person: Person) => void;
  isDeptHead?: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd?: () => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  isDragging?: boolean;
  secondaryManager?: Person;
  supportedPeople?: Person[];
  onEdit?: () => void;
  onDelete?: () => void;
  deptColorOverride?: string;
  locationColorOverride?: string;
  cardSettings?: CardSettings;
}

export const Card: React.FC<CardProps> = React.memo(({ 
  person, 
  onClick, 
  isDeptHead = false, 
  onDragStart, 
  onDragEnd,
  onDrop,
  isDragging = false,
  secondaryManager,
  supportedPeople,
  onEdit,
  onDelete,
  deptColorOverride,
  locationColorOverride,
  cardSettings
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // Memoize avatar color
  const avatarStyle = useMemo(() => {
    const colors = [
      'bg-red-100 text-red-600',
      'bg-orange-100 text-orange-600',
      'bg-amber-100 text-amber-600',
      'bg-green-100 text-green-600',
      'bg-emerald-100 text-emerald-600',
      'bg-teal-100 text-teal-600',
      'bg-cyan-100 text-cyan-600',
      'bg-blue-100 text-blue-600',
      'bg-indigo-100 text-indigo-600',
      'bg-violet-100 text-violet-600',
      'bg-purple-100 text-purple-600',
      'bg-fuchsia-100 text-fuchsia-600',
      'bg-pink-100 text-pink-600',
      'bg-rose-100 text-rose-600',
    ];
    let hash = 0;
    for (let i = 0; i < person.name.length; i++) {
      hash = person.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [person.name]);
  
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', person.id);
    e.dataTransfer.effectAllowed = "move";
    onDragStart(e, person.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (!isDragOver && !isDragging) {
      setIsDragOver(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!isDragging) {
      onDrop(e, person.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(person);
    }
  };

  const isVacancy = person.isVacancy;

  // Dynamic Styles based on Settings
  const cardWidth = cardSettings?.width || 288; // Default w-72 is 18rem = 288px
  const borderRadius = cardSettings?.borderRadius !== undefined ? cardSettings.borderRadius : 12; // Default xl is 12px
  const borderWidth = cardSettings?.borderWidth !== undefined ? cardSettings.borderWidth : 1;
  
  const shadowClass = useMemo(() => {
    if (!cardSettings) return 'shadow-md';
    switch (cardSettings.shadow) {
      case 'none': return 'shadow-none';
      case 'sm': return 'shadow-sm';
      case 'md': return 'shadow-md';
      case 'lg': return 'shadow-lg';
      case 'xl': return 'shadow-xl';
      default: return 'shadow-md';
    }
  }, [cardSettings?.shadow]);

  // Hover effect classes
  const hoverEffectClass = useMemo(() => {
    if (!cardSettings) return 'hover:shadow-xl hover:-translate-y-1';
    switch (cardSettings.hoverEffect) {
      case 'lift': return 'hover:shadow-xl hover:-translate-y-1';
      case 'glow': return 'hover:shadow-xl hover:shadow-blue-200/50';
      case 'scale': return 'hover:scale-105';
      case 'none': return '';
      default: return 'hover:shadow-xl hover:-translate-y-1';
    }
  }, [cardSettings?.hoverEffect]);

  // Department Styles
  const deptStyle = getDeptStyle(deptColorOverride || person.deptColor);

  const headerStyle = {
    backgroundColor: isVacancy ? undefined : (cardSettings?.useDeptColorForHeader ? undefined : cardSettings?.headerBgColor),
    color: isVacancy ? undefined : (cardSettings?.useDeptColorForHeader ? undefined : cardSettings?.headerTextColor),
  };

  const headerClass = isVacancy 
    ? 'bg-slate-200 text-slate-500' 
    : (cardSettings?.useDeptColorForHeader ? deptStyle.header : (!cardSettings?.headerBgColor ? 'bg-slate-800 text-white' : ''));

  const borderClass = cardSettings?.useDeptColorForBorder && !isVacancy
    ? deptStyle.border
    : '';

  const cardStyle = {
    width: `${cardWidth}px`,
    borderRadius: `${borderRadius}px`,
    borderWidth: `${borderWidth}px`,
    borderColor: cardSettings?.useDeptColorForBorder ? undefined : (cardSettings?.borderColor || '#e2e8f0'),
    backgroundColor: isVacancy ? undefined : cardSettings?.cardBgColor,
    color: isVacancy ? undefined : cardSettings?.cardTextColor,
    fontFamily: cardSettings?.fontFamily === 'serif' ? 'Georgia, serif' : cardSettings?.fontFamily === 'mono' ? 'ui-monospace, monospace' : 'inherit'
  };

  // Padding classes
  const paddingClass = cardSettings?.padding === 'compact' ? 'p-2' : cardSettings?.padding === 'spacious' ? 'p-5' : 'p-4';
  const headerPaddingClass = cardSettings?.padding === 'compact' ? 'p-2' : cardSettings?.padding === 'spacious' ? 'p-5' : 'p-4';
  
  // Avatar size classes
  const avatarSizeClass = cardSettings?.avatarSize === 'small' ? 'w-8 h-8 text-xs' : cardSettings?.avatarSize === 'large' ? 'w-14 h-14 text-base' : 'w-12 h-12 text-sm';
  
  // Avatar shape classes
  const avatarShapeClass = cardSettings?.avatarShape === 'square' ? 'rounded-none' : cardSettings?.avatarShape === 'rounded' ? 'rounded-lg' : 'rounded-full';
  
  // Name size classes
  const nameSizeClass = cardSettings?.nameSize === 'small' ? 'text-sm' : cardSettings?.nameSize === 'large' ? 'text-xl' : 'text-lg';
  
  // Title size classes
  const titleSizeClass = cardSettings?.titleSize === 'small' ? 'text-xs' : cardSettings?.titleSize === 'large' ? 'text-base' : 'text-sm';
  
  // Avatar position
  const avatarPos = cardSettings?.avatarPosition || 'left';
  const headerAlignment = cardSettings?.headerAlignment || 'center';
  const bodyAlignment = cardSettings?.bodyAlignment || 'left';
  
  const headerTextAlignClass = headerAlignment === 'left' ? 'text-left' : headerAlignment === 'right' ? 'text-right' : 'text-center';
  const bodyFlexDir = avatarPos === 'left' ? 'flex-row' : 'flex-row-reverse';
  const bodyContentAlign = bodyAlignment === 'left' ? 'items-start' : bodyAlignment === 'right' ? 'items-end' : 'items-center';

  return (
    <div
      id={`node-${person.id}`}
      draggable
      role="button"
      tabIndex={0}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => {
        e.stopPropagation();
        onClick(person);
      }}
      onKeyDown={handleKeyDown}
      style={cardStyle}
      className={`
        group relative flex flex-col overflow-hidden
        transition-all duration-300 ease-out outline-none border-solid
        ${isVacancy ? 'border-2 border-dashed border-slate-300 bg-slate-50' : `${borderClass} bg-white`}
        ${isDragging ? 'opacity-50 scale-95 border-dashed border-blue-400 cursor-grabbing shadow-lg' : `opacity-100 ${hoverEffectClass} cursor-grab active:cursor-grabbing ${shadowClass}`}
        ${isDragOver ? 'ring-2 ring-blue-500 ring-offset-4 ring-offset-white bg-blue-50 border-blue-400 scale-105 shadow-2xl z-50' : 'z-40'}
        focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
      `}
    >
      {/* Header */}
      <div 
        style={headerStyle}
        className={`
          ${headerPaddingClass} ${headerTextAlignClass} relative
          ${headerClass}
          ${cardSettings?.showGradientHeader && !isVacancy && !cardSettings?.useDeptColorForHeader ? 'bg-gradient-to-r from-slate-800 to-slate-600' : ''}
        `}
      >
         {/* Context Menu Trigger */}
         <div ref={menuRef} className={`absolute top-2 ${avatarPos === 'left' ? 'right-2' : 'left-2'}`}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className={`transition-colors p-1 rounded-full hover:bg-white/10 ${isVacancy ? 'text-slate-400 hover:text-slate-600' : 'text-inherit opacity-60 hover:opacity-100'}`}
              aria-label="Options"
            >
              <MoreHorizontal size={16} />
            </button>
            
            {/* Context Menu Dropdown */}
            {showMenu && (
              <div className="absolute right-0 top-6 w-32 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-[60] animate-in fade-in zoom-in duration-100 text-slate-800">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                >
                  Edit Profile
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  Delete
                </button>
              </div>
            )}
         </div>

         {/* Team Lead Crown */}
         {person.isTeamLead && !isVacancy && (
            <div className={`absolute top-2 ${avatarPos === 'left' ? 'left-2' : 'right-2'} text-amber-400`} title="Team Lead">
              <Crown size={14} fill="currentColor" />
            </div>
         )}

         <h3 className={`font-bold ${nameSizeClass} truncate leading-tight px-4`}>
           {isVacancy ? 'Open Position' : person.name}
         </h3>
         {(cardSettings?.showTitle !== false) && (
           <p className={`${titleSizeClass} truncate mt-1 px-4 ${isVacancy ? 'text-slate-400' : 'opacity-80'}`}>
             {person.title}
           </p>
         )}
      </div>

      {/* Body */}
      <div className={`${paddingClass} flex ${bodyFlexDir} items-center gap-3`}>
         {/* Avatar */}
         {!isVacancy && (cardSettings?.showAvatar !== false) && (
           <div className={`${avatarSizeClass} ${avatarShapeClass} flex items-center justify-center font-bold shrink-0 shadow-sm border-2 border-white ${avatarStyle}`}>
             {person.photoUrl ? (
               <img src={person.photoUrl} alt={person.name} className={`w-full h-full ${avatarShapeClass} object-cover`} />
             ) : (
               person.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
             )}
           </div>
         )}
         
         {/* Department & Location */}
         <div className={`flex flex-col ${bodyContentAlign} flex-1 min-w-0 gap-1.5`}>
            {/* Department Badge */}
            {(cardSettings?.showDepartment !== false) && (
              <div className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold truncate max-w-full ${cardSettings?.useDeptColorForBadge !== false ? deptStyle.badge : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                 {person.department}
              </div>
            )}
            
            {/* Location */}
            {(cardSettings?.showLocation !== false) && (
              <div className="flex items-center gap-1 text-xs text-slate-500 truncate max-w-full">
                 <MapPin size={10} className="text-slate-400 shrink-0" />
                 <span style={{ color: locationColorOverride }} className="truncate">{person.location}</span>
              </div>
            )}
            
            {/* Email */}
            {(cardSettings?.showEmail) && person.email && (
              <div className="flex items-center gap-1 text-xs text-slate-500 truncate max-w-full">
                 <Mail size={10} className="text-slate-400 shrink-0" />
                 <span className="truncate">{person.email}</span>
              </div>
            )}
            
            {/* Phone */}
            {(cardSettings?.showPhone) && person.phone && (
              <div className="flex items-center gap-1 text-xs text-slate-500 truncate max-w-full">
                 <Phone size={10} className="text-slate-400 shrink-0" />
                 <span className="truncate">{person.phone}</span>
              </div>
            )}
         </div>
      </div>

      {/* Secondary Manager (Dotted Line) */}
      {(cardSettings?.showSecondaryManager !== false) && secondaryManager && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
          <Link size={12} className="text-amber-400 shrink-0" />
          <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[10px] text-slate-400">Reports to:</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[8px] font-bold shrink-0">
                    {secondaryManager.name.substring(0,2)}
                </div>
                <span className="text-[10px] font-semibold text-slate-600 truncate">{secondaryManager.name}</span>
              </div>
          </div>
        </div>
      )}

      {/* Supported People */}
      {supportedPeople && supportedPeople.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Users size={12} className="text-blue-400 shrink-0" />
            <span className="text-[10px] text-slate-400">Supports:</span>
          </div>
          <div className="flex flex-wrap gap-1 pl-5">
            {supportedPeople.map(p => (
              <div key={p.id} className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-1.5 py-0.5">
                <div className="w-3 h-3 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[6px] font-bold shrink-0">
                    {p.name.substring(0,2)}
                </div>
                <span className="text-[9px] font-semibold text-slate-600 truncate max-w-[80px]">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Drag Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-blue-500 pointer-events-none animate-pulse bg-blue-50/10"></div>
      )}
    </div>
  );
});

Card.displayName = 'Card';
