import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, Settings, Palette, Sliders, MapPin, PanelRightClose, PanelRight,
  Undo, Redo, Keyboard, Check
} from 'lucide-react';
import { CardSettings, LineSettings, Person } from '../../types';
import { CardSettingsTab } from './CardSettingsTab';
import { LineSettingsTab } from './LineSettingsTab';
import { Tooltip } from './Tooltip';
import { getLocationFlag, getFlagImageUrl } from '../../countries';

type SettingsTab = 'cards' | 'lines';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Card settings
  cardSettings: CardSettings;
  onUpdateCardSettings: (settings: CardSettings) => void;
  // Line settings
  lineSettings: LineSettings;
  onUpdateLineSettings: (settings: LineSettings) => void;
  // Location colors
  locationColors: Record<string, string>;
  onSetLocationColor: (loc: string, color: string) => void;
  locations: string[];
  // For preview
  previewPerson?: Person;
  // Panel mode
  defaultTab?: SettingsTab;
  sidebarMode?: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  cardSettings,
  onUpdateCardSettings,
  lineSettings,
  onUpdateLineSettings,
  locationColors,
  onSetLocationColor,
  locations,
  previewPerson,
  defaultTab = 'cards',
  sidebarMode: initialSidebarMode = false
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
  const [sidebarMode, setSidebarMode] = useState(initialSidebarMode);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // History for undo/redo within settings
  const [cardHistory, setCardHistory] = useState<CardSettings[]>([cardSettings]);
  const [cardHistoryIndex, setCardHistoryIndex] = useState(0);
  const [lineHistory, setLineHistory] = useState<LineSettings[]>([lineSettings]);
  const [lineHistoryIndex, setLineHistoryIndex] = useState(0);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Track changes for undo/redo
  const handleCardSettingsUpdate = useCallback((newSettings: CardSettings) => {
    onUpdateCardSettings(newSettings);
    
    // Add to history (debounced to avoid too many entries)
    setCardHistory(prev => {
      const newHistory = prev.slice(0, cardHistoryIndex + 1);
      newHistory.push(newSettings);
      // Keep last 20 states
      if (newHistory.length > 20) newHistory.shift();
      return newHistory;
    });
    setCardHistoryIndex(prev => Math.min(prev + 1, 19));
  }, [onUpdateCardSettings, cardHistoryIndex]);

  const handleLineSettingsUpdate = useCallback((newSettings: LineSettings) => {
    onUpdateLineSettings(newSettings);
    
    setLineHistory(prev => {
      const newHistory = prev.slice(0, lineHistoryIndex + 1);
      newHistory.push(newSettings);
      if (newHistory.length > 20) newHistory.shift();
      return newHistory;
    });
    setLineHistoryIndex(prev => Math.min(prev + 1, 19));
  }, [onUpdateLineSettings, lineHistoryIndex]);

  // Undo/Redo handlers
  const canUndo = activeTab === 'cards' ? cardHistoryIndex > 0 : lineHistoryIndex > 0;
  const canRedo = activeTab === 'cards' 
    ? cardHistoryIndex < cardHistory.length - 1 
    : lineHistoryIndex < lineHistory.length - 1;

  const handleUndo = () => {
    if (activeTab === 'cards' && cardHistoryIndex > 0) {
      const newIndex = cardHistoryIndex - 1;
      setCardHistoryIndex(newIndex);
      onUpdateCardSettings(cardHistory[newIndex]);
    } else if (activeTab === 'lines' && lineHistoryIndex > 0) {
      const newIndex = lineHistoryIndex - 1;
      setLineHistoryIndex(newIndex);
      onUpdateLineSettings(lineHistory[newIndex]);
    }
  };

  const handleRedo = () => {
    if (activeTab === 'cards' && cardHistoryIndex < cardHistory.length - 1) {
      const newIndex = cardHistoryIndex + 1;
      setCardHistoryIndex(newIndex);
      onUpdateCardSettings(cardHistory[newIndex]);
    } else if (activeTab === 'lines' && lineHistoryIndex < lineHistory.length - 1) {
      const newIndex = lineHistoryIndex + 1;
      setLineHistoryIndex(newIndex);
      onUpdateLineSettings(lineHistory[newIndex]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Tab switching with numbers
      if (e.key === '1' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setActiveTab('cards');
      } else if (e.key === '2' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setActiveTab('lines');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleUndo, handleRedo]);

  // Focus trap
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Reset history when panel opens
  useEffect(() => {
    if (isOpen && isInitialMount.current) {
      setCardHistory([cardSettings]);
      setCardHistoryIndex(0);
      setLineHistory([lineSettings]);
      setLineHistoryIndex(0);
      isInitialMount.current = false;
    } else if (!isOpen) {
      isInitialMount.current = true;
    }
  }, [isOpen, cardSettings, lineSettings]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'cards' as const, label: 'Cards', icon: <Palette size={16} /> },
    { id: 'lines' as const, label: 'Lines', icon: <Sliders size={16} /> }
  ];

  // Card Preview Component
  const CardPreview = () => (
    <div className="bg-slate-100 rounded-xl p-6 border border-slate-200">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-4 text-center">
        Live Preview
      </p>
      <div
        className={`
          relative flex flex-col border overflow-hidden bg-white transition-all mx-auto
          ${cardSettings.useDeptColorForBorder ? 'border-blue-200' : ''}
          ${cardSettings.shadow === 'none' ? '' : 
            cardSettings.shadow === 'sm' ? 'shadow-sm' : 
            cardSettings.shadow === 'md' ? 'shadow-md' : 
            cardSettings.shadow === 'lg' ? 'shadow-lg' : 'shadow-xl'}
        `}
        style={{
          width: `${Math.min(cardSettings.width, 260)}px`,
          borderRadius: `${cardSettings.borderRadius}px`,
          borderWidth: `${cardSettings.borderWidth || 1}px`,
          borderColor: cardSettings.useDeptColorForBorder ? undefined : (cardSettings.borderColor || '#e2e8f0'),
          backgroundColor: cardSettings.cardBgColor,
          fontFamily: cardSettings.fontFamily === 'serif' ? 'Georgia, serif' : 
                      cardSettings.fontFamily === 'mono' ? 'ui-monospace, monospace' : 'inherit'
        }}
      >
        {/* Header */}
        <div
          className={`
            relative 
            ${cardSettings.padding === 'compact' ? 'p-2' : cardSettings.padding === 'spacious' ? 'p-5' : 'p-4'}
            ${cardSettings.useDeptColorForHeader ? 'bg-blue-600 text-white' : ''}
            ${cardSettings.headerAlignment === 'left' ? 'text-left' : cardSettings.headerAlignment === 'right' ? 'text-right' : 'text-center'}
            ${cardSettings.showGradientHeader && !cardSettings.useDeptColorForHeader ? 'bg-gradient-to-r from-slate-800 to-slate-600' : ''}
          `}
          style={{
            backgroundColor: cardSettings.useDeptColorForHeader ? undefined : cardSettings.headerBgColor,
            color: cardSettings.useDeptColorForHeader ? undefined : cardSettings.headerTextColor,
          }}
        >
          <h3 className={`font-bold truncate leading-tight ${
            cardSettings.nameSize === 'small' ? 'text-sm' : 
            cardSettings.nameSize === 'large' ? 'text-xl' : 'text-lg'
          }`}>
            {previewPerson?.name || 'John Smith'}
          </h3>
          {cardSettings.showTitle && (
            <p className={`truncate mt-1 opacity-80 ${
              cardSettings.titleSize === 'small' ? 'text-xs' : 
              cardSettings.titleSize === 'large' ? 'text-base' : 'text-sm'
            }`}>
              {previewPerson?.title || 'Software Engineer'}
            </p>
          )}
        </div>

        {/* Body */}
        <div 
          className={`
            ${cardSettings.padding === 'compact' ? 'p-2' : cardSettings.padding === 'spacious' ? 'p-5' : 'p-4'}
            flex ${cardSettings.avatarPosition === 'left' ? 'flex-row' : 'flex-row-reverse'} items-center gap-3
          `}
          style={{ color: cardSettings.cardTextColor }}
        >
          {cardSettings.showAvatar && (
            <div className={`
              ${cardSettings.avatarShape === 'square' ? 'rounded-none' : 
                cardSettings.avatarShape === 'rounded' ? 'rounded-lg' : 'rounded-full'}
              flex items-center justify-center font-bold shrink-0 bg-blue-100 text-blue-600 shadow-sm border-2 border-white
              ${cardSettings.avatarSize === 'small' ? 'w-8 h-8 text-xs' : 
                cardSettings.avatarSize === 'large' ? 'w-14 h-14 text-base' : 'w-12 h-12 text-sm'}
            `}>
              {previewPerson?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'JS'}
            </div>
          )}
          <div className={`
            flex flex-col 
            ${cardSettings.bodyAlignment === 'left' ? 'items-start' : 
              cardSettings.bodyAlignment === 'right' ? 'items-end' : 'items-center'}
            flex-1 min-w-0 gap-1.5
          `}>
            {cardSettings.showDepartment && (
              <div className={`
                inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold truncate max-w-full
                ${cardSettings.useDeptColorForBadge 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-slate-100 text-slate-500 border border-slate-200'}
              `}>
                {previewPerson?.department || 'Engineering'}
              </div>
            )}
            {cardSettings.showLocation && (
              <div className="flex items-center gap-1 text-xs text-slate-500 truncate max-w-full">
                {cardSettings.showLocationFlag !== false ? (
                  <span className="shrink-0 flex items-center">
                    {getFlagImageUrl(previewPerson?.location || 'United Kingdom') ? (
                      <img 
                        src={getFlagImageUrl(previewPerson?.location || 'United Kingdom', 'w80')!} 
                        alt=""
                        className="w-4 h-3 object-cover rounded-[2px] shadow-sm"
                      />
                    ) : (
                      <span className="text-sm">{getLocationFlag(previewPerson?.location || 'United Kingdom') || <MapPin size={10} className="text-slate-400" />}</span>
                    )}
                  </span>
                ) : (
                  <MapPin size={10} className="text-slate-400 shrink-0" />
                )}
                <span>{previewPerson?.location || 'United Kingdom'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Panel content based on mode
  const panelContent = (
    <div
      ref={panelRef}
      tabIndex={-1}
      className={`
        bg-white flex flex-col overflow-hidden
        ${sidebarMode 
          ? 'fixed top-0 right-0 h-full w-[420px] shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-300' 
          : 'rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] animate-in fade-in zoom-in duration-200'}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-white" />
            <h2 className="font-bold text-white text-lg">Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <Undo size={16} />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo size={16} />
              </button>
            </div>

            {/* Keyboard shortcuts help */}
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Keyboard shortcuts"
            >
              <Keyboard size={16} />
            </button>

            {/* Toggle sidebar mode */}
            <button
              onClick={() => setSidebarMode(!sidebarMode)}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              title={sidebarMode ? "Switch to modal" : "Switch to sidebar"}
            >
              {sidebarMode ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts tooltip */}
        {showShortcuts && (
          <div className="mt-3 p-3 bg-white/10 rounded-lg text-white/80 text-xs space-y-1">
            <div className="flex justify-between"><span>Close panel</span><kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">Esc</kbd></div>
            <div className="flex justify-between"><span>Undo</span><kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">Ctrl+Z</kbd></div>
            <div className="flex justify-between"><span>Redo</span><kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">Ctrl+Shift+Z</kbd></div>
            <div className="flex justify-between"><span>Cards tab</span><kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">Ctrl+1</kbd></div>
            <div className="flex justify-between"><span>Lines tab</span><kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">Ctrl+2</kbd></div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all
                ${activeTab === tab.id 
                  ? 'bg-white text-slate-800' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-hidden flex ${sidebarMode ? 'flex-col' : 'flex-col md:flex-row'}`}>
        {/* Preview - show on top for sidebar, right side for modal */}
        {activeTab === 'cards' && (
          <div className={`
            bg-slate-50 p-6 flex items-center justify-center shrink-0 overflow-y-auto
            ${sidebarMode ? 'border-b border-slate-200' : 'w-full md:w-[380px] border-b md:border-b-0 md:border-l border-slate-200 order-first md:order-last'}
          `}>
            <CardPreview />
          </div>
        )}

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'cards' && (
            <CardSettingsTab
              settings={cardSettings}
              onUpdate={handleCardSettingsUpdate}
              locationColors={locationColors}
              onSetLocationColor={onSetLocationColor}
              locations={locations}
              previewPerson={previewPerson}
            />
          )}
          {activeTab === 'lines' && (
            <LineSettingsTab
              settings={lineSettings}
              onUpdate={handleLineSettingsUpdate}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
        <div className="text-xs text-slate-400">
          Changes are saved automatically
        </div>
        <button
          onClick={onClose}
          className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors flex items-center gap-2"
        >
          <Check size={14} /> Done
        </button>
      </div>
    </div>
  );

  // Render based on mode
  if (sidebarMode) {
    return (
      <>
        {/* Backdrop for sidebar */}
        <div 
          className="fixed inset-0 z-[99] bg-black/20" 
          onClick={onClose}
        />
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <div className="pointer-events-auto h-full float-right">
            {panelContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {panelContent}
    </div>
  );
};

export default SettingsPanel;
