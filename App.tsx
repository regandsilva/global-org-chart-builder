import React, { useState, useEffect } from 'react';
import { OrgChart } from './components/OrgChart';
import { Person, LineSettings, CardSettings } from './types';
import { INITIAL_PEOPLE, DEPARTMENTS, LOCATIONS, DEPT_COLORS, JOB_TITLES } from './constants';
import { Plus, Upload, Save, RotateCcw, RotateCw, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useHistoryState } from './hooks/useHistoryState';

interface AppState {
  people: Person[];
  departments: string[];
  locations: string[];
  jobTitles: string[];
  departmentColors: Record<string, string>;
  locationColors: Record<string, string>;
  lineSettings: LineSettings;
  cardSettings: CardSettings;
}

const DEFAULT_LINE_SETTINGS: LineSettings = {
  primaryColor: '#94a3b8',
  primaryWidth: 2,
  secondaryWidth: 2,
  secondaryStyle: 'dotted',
  cornerRadius: 12,
  useRandomSecondaryColors: true,
  secondaryColor: '#f59e0b'
};

const DEFAULT_CARD_SETTINGS: CardSettings = {
  // Theme & Colors
  headerBgColor: '#1e293b', // slate-800
  headerTextColor: '#ffffff',
  cardBgColor: '#ffffff',
  cardTextColor: '#1e293b', // slate-800
  borderColor: '#e2e8f0', // slate-200
  
  // Department Color Options
  useDeptColorForHeader: false,
  useDeptColorForBadge: true,
  useDeptColorForBorder: false,
  
  // Dimensions & Shape
  width: 288, // w-72 = 18rem = 288px
  borderRadius: 12,
  borderWidth: 1,
  shadow: 'md',
  padding: 'normal',
  
  // Header Section
  headerAlignment: 'center',
  nameSize: 'medium',
  titleSize: 'small',
  showTitle: true,
  
  // Body Section
  bodyAlignment: 'left',
  showAvatar: true,
  avatarSize: 'medium',
  avatarPosition: 'left',
  avatarShape: 'circle',
  showDepartment: true,
  showLocation: true,
  showLocationFlag: true,
  
  // Additional Info
  showEmail: false,
  showPhone: false,
  showSecondaryManager: true,
  
  // Typography
  fontFamily: 'default',
  
  // Effects & Interactions
  hoverEffect: 'lift',
  showGradientHeader: false
};

const App: React.FC = () => {
  // Initialize state from localStorage if available
  const { state: appState, set: setAppState, undo, redo, canUndo, canRedo } = useHistoryState<AppState>(() => {
    // Safe JSON parse helper — returns fallback on any error
    const safeParse = <T,>(key: string, fallback: T): T => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        // Basic validation: ensure parsed value is roughly the right type
        if (parsed === null || parsed === undefined) return fallback;
        return parsed as T;
      } catch (e) {
        console.warn(`Failed to parse localStorage key "${key}", using defaults.`, e);
        // Remove the corrupt entry so next save writes clean data
        try { localStorage.removeItem(key); } catch {}
        return fallback;
      }
    };

    // Merge saved settings with defaults to ensure new settings have proper defaults
    const mergedLineSettings = {
      ...DEFAULT_LINE_SETTINGS,
      ...safeParse<Partial<LineSettings>>('org-chart-line-settings', {})
    };
    
    const mergedCardSettings = {
      ...DEFAULT_CARD_SETTINGS,
      ...safeParse<Partial<CardSettings>>('org-chart-card-settings', {})
    };

    return {
      people: safeParse<Person[]>('org-chart-people', INITIAL_PEOPLE),
      departments: safeParse<string[]>('org-chart-departments', DEPARTMENTS),
      locations: safeParse<string[]>('org-chart-locations', LOCATIONS),
      jobTitles: safeParse<string[]>('org-chart-job-titles', JOB_TITLES),
      departmentColors: safeParse<Record<string, string>>('org-chart-colors', DEPT_COLORS),
      locationColors: safeParse<Record<string, string>>('org-chart-location-colors', {}),
      lineSettings: mergedLineSettings,
      cardSettings: mergedCardSettings
    };
  });

  const {
    people,
    departments,
    locations,
    jobTitles,
    departmentColors,
    locationColors,
    lineSettings,
    cardSettings
  } = appState;

  // Wrapper setters to maintain compatibility with existing code structure
  const setPeople = (value: Person[] | ((prev: Person[]) => Person[])) => {
    setAppState(prev => ({ ...prev, people: typeof value === 'function' ? value(prev.people) : value }));
  };
  const setDepartments = (value: string[] | ((prev: string[]) => string[])) => {
    setAppState(prev => ({ ...prev, departments: typeof value === 'function' ? value(prev.departments) : value }));
  };
  const setLocations = (value: string[] | ((prev: string[]) => string[])) => {
    setAppState(prev => ({ ...prev, locations: typeof value === 'function' ? value(prev.locations) : value }));
  };
  const setJobTitles = (value: string[] | ((prev: string[]) => string[])) => {
    setAppState(prev => ({ ...prev, jobTitles: typeof value === 'function' ? value(prev.jobTitles) : value }));
  };
  const setDepartmentColors = (value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    setAppState(prev => ({ ...prev, departmentColors: typeof value === 'function' ? value(prev.departmentColors) : value }));
  };
  const setLocationColors = (value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    setAppState(prev => ({ ...prev, locationColors: typeof value === 'function' ? value(prev.locationColors) : value }));
  };
  const setLineSettings = (value: LineSettings | ((prev: LineSettings) => LineSettings)) => {
    setAppState(prev => ({ ...prev, lineSettings: typeof value === 'function' ? value(prev.lineSettings) : value }));
  };
  const setCardSettings = (value: CardSettings | ((prev: CardSettings) => CardSettings)) => {
    setAppState(prev => ({ ...prev, cardSettings: typeof value === 'function' ? value(prev.cardSettings) : value }));
  };

  // Auto-save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('org-chart-people', JSON.stringify(people));
    localStorage.setItem('org-chart-departments', JSON.stringify(departments));
    localStorage.setItem('org-chart-locations', JSON.stringify(locations));
    localStorage.setItem('org-chart-job-titles', JSON.stringify(jobTitles));
    localStorage.setItem('org-chart-colors', JSON.stringify(departmentColors));
    localStorage.setItem('org-chart-location-colors', JSON.stringify(locationColors));
    localStorage.setItem('org-chart-line-settings', JSON.stringify(lineSettings));
    localStorage.setItem('org-chart-card-settings', JSON.stringify(cardSettings));
  }, [people, departments, locations, jobTitles, departmentColors, locationColors, lineSettings, cardSettings]);

  const handleSaveToDisk = async () => {
    const data = { people, departments, locations, jobTitles, departmentColors, locationColors, lineSettings, cardSettings };
    const jsonString = JSON.stringify(data, null, 2);

    try {
      // @ts-ignore - File System Access API
      if (window.showSaveFilePicker) {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: 'org-chart-data.json',
          types: [{
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
      } else {
        // Fallback
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'org-chart-data.json';
        a.click();
      }
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedData = JSON.parse(content);
        
        // Handle both legacy array format and new full object format
        if (Array.isArray(importedData)) {
          setAppState(prev => {
            const newDepts = Array.from(new Set(importedData.map((p: Person) => p.department))).filter(Boolean) as string[];
            const newLocs = Array.from(new Set(importedData.map((p: Person) => p.location))).filter(Boolean) as string[];
            return {
              ...prev,
              people: importedData,
              departments: Array.from(new Set([...prev.departments, ...newDepts])),
              locations: Array.from(new Set([...prev.locations, ...newLocs]))
            };
          });
        } else if (importedData.people) {
          setAppState(prev => ({
            ...prev,
            people: importedData.people,
            departments: importedData.departments || prev.departments,
            locations: importedData.locations || prev.locations,
            departmentColors: importedData.departmentColors || prev.departmentColors,
            locationColors: importedData.locationColors || prev.locationColors,
            lineSettings: importedData.lineSettings || prev.lineSettings,
            cardSettings: importedData.cardSettings || prev.cardSettings
          }));
        } else {
          alert('Invalid data format.');
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Error parsing JSON file.');
      }
    };
    reader.readAsText(file);
  };


  const handleAddPerson = (person: Person) => {
    setPeople(prev => [...prev, person]);
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset all data to defaults? This cannot be undone.')) {
      setAppState({
        people: INITIAL_PEOPLE,
        departments: DEPARTMENTS,
        locations: LOCATIONS,
        jobTitles: JOB_TITLES,
        departmentColors: DEPT_COLORS,
        locationColors: {},
        lineSettings: DEFAULT_LINE_SETTINGS,
        cardSettings: DEFAULT_CARD_SETTINGS
      });
      localStorage.clear();
    }
  };

  const handleUpdatePerson = (updated: Person) => {
    setPeople(prev => {
      const oldPerson = prev.find(p => p.id === updated.id);
      
      // If department changed, update all descendants too
      if (oldPerson && oldPerson.department !== updated.department) {
        // Get all descendant IDs
        const getDescendantIds = (parentId: string, allPeople: Person[]): string[] => {
          const children = allPeople.filter(p => p.managerId === parentId);
          let ids: string[] = [];
          for (const child of children) {
            ids.push(child.id);
            ids = ids.concat(getDescendantIds(child.id, allPeople));
          }
          return ids;
        };
        
        const descendantIds = new Set(getDescendantIds(updated.id, prev));
        
        return prev.map(p => {
          if (p.id === updated.id) {
            return updated;
          }
          if (descendantIds.has(p.id)) {
            return { ...p, department: updated.department };
          }
          return p;
        });
      }
      
      return prev.map(p => p.id === updated.id ? updated : p);
    });
  };

  const handleDeletePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
  };

  const handleMovePerson = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    
    const isDescendant = (parentId: string, childId: string): boolean => {
       const children = people.filter(p => p.managerId === parentId);
       for (const child of children) {
         if (child.id === childId) return true;
         if (isDescendant(child.id, childId)) return true;
       }
       return false;
    };

    if (isDescendant(draggedId, targetId)) {
      alert("Cannot move a manager under their own report.");
      return;
    }

    const targetPerson = people.find(p => p.id === targetId);
    const targetDepartment = targetPerson?.department;

    // Get all descendants of the dragged person
    const getDescendants = (parentId: string, allPeople: Person[]): string[] => {
      const directChildren = allPeople.filter(p => p.managerId === parentId);
      let descendants: string[] = [];
      for (const child of directChildren) {
        descendants.push(child.id);
        descendants = descendants.concat(getDescendants(child.id, allPeople));
      }
      return descendants;
    };

    const descendantIds = getDescendants(draggedId, people);

    // Auto-assign sortOrder at end of target's children
    const targetChildren = people.filter(p => p.managerId === targetId);
    const maxOrder = targetChildren.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), 0);

    setPeople(prev => prev.map(p => {
      if (p.id === draggedId) {
        return { 
          ...p, 
          managerId: targetId,
          department: targetDepartment || p.department,
          sortOrder: maxOrder + 1
        };
      }
      // Also update all descendants to the new department
      if (descendantIds.includes(p.id) && targetDepartment) {
        return {
          ...p,
          department: targetDepartment
        };
      }
      return p;
    }));
  };

  // Helper: normalize managerId for comparison (null, undefined, '' all treated as "no manager")
  const normalizeMgrId = (id: string | null | undefined): string | null => {
    return id || null;
  };

  const handleReorderPerson = (personId: string, direction: 'left' | 'right') => {
    setPeople(prev => {
      const person = prev.find(p => p.id === personId);
      if (!person) return prev;

      const personMgrId = normalizeMgrId(person.managerId);

      // Get siblings (same manager) — normalize managerId comparison
      const siblings = prev
        .filter(p => normalizeMgrId(p.managerId) === personMgrId)
        .sort((a, b) => {
          const aOrder = a.sortOrder ?? 999999;
          const bOrder = b.sortOrder ?? 999999;
          if (aOrder !== bOrder) return aOrder - bOrder;
          // Team leads sort first among equal sort orders (matches rendering)
          const aLead = a.isTeamLead ? 0 : 1;
          const bLead = b.isTeamLead ? 0 : 1;
          if (aLead !== bLead) return aLead - bLead;
          return a.name.localeCompare(b.name);
        });

      if (siblings.length <= 1) return prev;

      const currentIndex = siblings.findIndex(s => s.id === personId);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= siblings.length) return prev;

      // First, normalize: assign contiguous sort orders to all siblings
      // so swapping is always reliable
      const siblingIds = siblings.map(s => s.id);
      const normalizedOrders = new Map<string, number>();
      siblingIds.forEach((id, i) => normalizedOrders.set(id, i));

      // Swap the two
      const targetSibling = siblings[targetIndex];
      normalizedOrders.set(personId, targetIndex);
      normalizedOrders.set(targetSibling.id, currentIndex);

      return prev.map(p => {
        if (normalizedOrders.has(p.id)) {
          return { ...p, sortOrder: normalizedOrders.get(p.id)! };
        }
        return p;
      });
    });
  };

  const handleAddDepartment = (dept: string) => {
    if (!departments.includes(dept)) {
        setDepartments(prev => [...prev, dept]);
    }
  };

  const handleAddLocation = (loc: string) => {
    if (!locations.includes(loc)) {
        setLocations(prev => [...prev, loc]);
    }
  };

  const handleDeleteDepartment = (dept: string) => {
    setDepartments(prev => prev.filter(d => d !== dept));
  };

  const handleDeleteLocation = (loc: string) => {
    setLocations(prev => prev.filter(l => l !== loc));
  };

  const handleSetDepartmentColor = (dept: string, color: string) => {
    setDepartmentColors(prev => ({ ...prev, [dept]: color }));
  };

  // Add new person modal state
  const [showAddModal, setShowAddModal] = useState(false);

  const handleExportImage = async () => {
    const element = document.getElementById('chart-content');
    if (!element) return;

    try {
      // Find the SVG lines element and temporarily adjust for export
      const svgElement = element.querySelector('svg');
      const originalSvgStyles: { zIndex?: string; position?: string; opacity?: string } = {};
      
      if (svgElement) {
        // Store original styles
        originalSvgStyles.zIndex = svgElement.style.zIndex;
        originalSvgStyles.position = svgElement.style.position;
        originalSvgStyles.opacity = svgElement.style.opacity;
        
        // Ensure SVG is visible and properly positioned for capture
        svgElement.style.zIndex = '5';
        svgElement.style.position = 'absolute';
        svgElement.style.opacity = '1';
      }

      // Find all team background elements with negative z-index and temporarily fix them
      const teamBackgrounds = element.querySelectorAll('[data-team-bg]') as NodeListOf<HTMLElement>;
      const originalBgStyles: { el: HTMLElement; zIndex: string }[] = [];
      
      teamBackgrounds.forEach((bg) => {
        originalBgStyles.push({ el: bg, zIndex: bg.style.zIndex });
        bg.style.zIndex = '1'; // Move to positive z-index for export
      });

      // Use html-to-image with proper SVG handling
      const dataUrl = await toPng(element, { 
        backgroundColor: '#f8fafc', 
        quality: 1.0, 
        pixelRatio: 2,
        cacheBust: true,
        includeQueryParams: true,
        skipFonts: false,
        filter: (node) => {
          // Include all nodes, especially SVG
          return true;
        },
        style: {
          overflow: 'visible'
        }
      });

      // Restore original styles
      if (svgElement) {
        if (originalSvgStyles.zIndex !== undefined) svgElement.style.zIndex = originalSvgStyles.zIndex;
        if (originalSvgStyles.position !== undefined) svgElement.style.position = originalSvgStyles.position;
        if (originalSvgStyles.opacity !== undefined) svgElement.style.opacity = originalSvgStyles.opacity;
      }
      
      // Restore team background z-index
      originalBgStyles.forEach(({ el, zIndex }) => {
        el.style.zIndex = zIndex;
      });

      const link = document.createElement('a');
      link.download = 'org-chart.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
      alert('Failed to export image.');
    }
  };

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Main Canvas - Full Width (No Sidebar) */}
      <div className="h-full w-full relative overflow-hidden flex flex-col">
        <header className="absolute top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center px-8 justify-between z-30">
          <h2 className="font-bold text-slate-800 text-lg tracking-tight">Organization Chart</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 mr-2">
              <button 
                onClick={undo}
                disabled={!canUndo}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full transition-colors shadow-sm ${
                  canUndo 
                    ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50' 
                    : 'text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed'
                }`}
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw size={14} />
              </button>
              <button 
                onClick={redo}
                disabled={!canRedo}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full transition-colors shadow-sm ${
                  canRedo 
                    ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50' 
                    : 'text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed'
                }`}
                title="Redo (Ctrl+Y)"
              >
                <RotateCw size={14} />
              </button>
            </div>

            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-full hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={14} />
              Add Person
            </button>
            
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-full hover:bg-slate-50 transition-colors shadow-sm cursor-pointer">
              <Upload size={14} />
              Import
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportData} 
                className="hidden" 
              />
            </label>

            <button 
              onClick={handleExportImage}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-full hover:bg-slate-50 transition-colors shadow-sm"
              title="Export as PNG"
            >
              <Download size={14} />
              Export Image
            </button>

            <button 
              onClick={handleSaveToDisk}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-full hover:bg-slate-50 transition-colors shadow-sm"
              title="Save to disk"
            >
              <Save size={14} />
              Save
            </button>

            <button 
              onClick={handleResetData}
              className="flex items-center gap-2 text-xs font-bold text-red-600 bg-white border border-red-200 px-4 py-2 rounded-full hover:bg-red-50 transition-colors shadow-sm"
              title="Reset all data"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
        </header>

        <div className="flex-1 w-full h-full">
                      <OrgChart 
             people={people} 
             lineSettings={lineSettings}
             onUpdateLineSettings={setLineSettings}
             cardSettings={cardSettings}
             onUpdateCardSettings={setCardSettings}
             onMovePerson={handleMovePerson}
             onReorderPerson={handleReorderPerson}
             onUpdatePerson={handleUpdatePerson}
             onDeletePerson={handleDeletePerson}
             onAddPerson={handleAddPerson}
             departments={departments}
             locations={locations}
             jobTitles={jobTitles}
             onAddDepartment={(dept) => setDepartments(prev => [...prev, dept])}
             onAddLocation={(loc) => setLocations(prev => [...prev, loc])}
             onAddJobTitle={(title) => setJobTitles(prev => [...prev, title])}
             onDeleteDepartment={(dept) => setDepartments(prev => prev.filter(d => d !== dept))}
             onDeleteLocation={(loc) => setLocations(prev => prev.filter(l => l !== loc))}
             onDeleteJobTitle={(title) => setJobTitles(prev => prev.filter(t => t !== title))}
             showAddModal={showAddModal}
             onCloseAddModal={() => setShowAddModal(false)}
             onOpenAddModal={() => setShowAddModal(true)}
             departmentColors={departmentColors}
             onSetDepartmentColor={(dept, color) => setDepartmentColors(prev => ({ ...prev, [dept]: color }))}
             locationColors={locationColors}
             onSetLocationColor={(loc, color) => setLocationColors(prev => ({ ...prev, [loc]: color }))}
           />
        </div>
      </div>
    </div>
  );
};

export default App;
