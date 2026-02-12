import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Person, LineSettings, CardSettings } from '../types';
import { Card } from './Card';
import { Lines } from './Lines';
import { SettingsPanel } from './settings';
import { DEPARTMENTS, LOCATIONS } from '../constants';
import { getLocationFlag, getPopularLocations, COUNTRIES, SPECIAL_LOCATIONS, getFlagImageUrl } from '../countries';
import { LocationSelect } from './LocationSelect';
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Search, X, Trash2, Users, Crown, Link, User, Building, MapPin, Mail, Phone, ChevronDown, Plus, Check, Settings, Sliders, Palette, Globe, ArrowLeft, ArrowRight } from 'lucide-react';

// Sort helper: sort people by sortOrder (lower first), then by name as fallback
const sortBySortOrder = (a: Person, b: Person): number => {
  const aOrder = a.sortOrder ?? 999999;
  const bOrder = b.sortOrder ?? 999999;
  if (aOrder !== bOrder) return aOrder - bOrder;
  // Team leads sort first among equal sort orders
  const aLead = a.isTeamLead ? 0 : 1;
  const bLead = b.isTeamLead ? 0 : 1;
  if (aLead !== bLead) return aLead - bLead;
  return a.name.localeCompare(b.name);
};

interface OrgChartProps {
  people: Person[];
  lineSettings?: LineSettings;
  onUpdateLineSettings?: (settings: LineSettings) => void;
  cardSettings?: CardSettings;
  onUpdateCardSettings?: (settings: CardSettings) => void;
  onMovePerson: (draggedId: string, targetId: string) => void;
  onReorderPerson?: (personId: string, direction: 'left' | 'right') => void;
  onUpdatePerson?: (person: Person) => void;
  onDeletePerson?: (id: string) => void;
  onAddPerson?: (person: Person) => void;
  departments?: string[];
  locations?: string[];
  jobTitles?: string[];
  onAddDepartment?: (dept: string) => void;
  onAddLocation?: (loc: string) => void;
  onAddJobTitle?: (title: string) => void;
  onDeleteDepartment?: (dept: string) => void;
  onDeleteLocation?: (loc: string) => void;
  onDeleteJobTitle?: (title: string) => void;
  showAddModal?: boolean;
  onCloseAddModal?: () => void;
  onOpenAddModal?: () => void;
  departmentColors?: Record<string, string>;
  onSetDepartmentColor?: (dept: string, color: string) => void;
  locationColors?: Record<string, string>;
  onSetLocationColor?: (loc: string, color: string) => void;
}

// Zoom constraints
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.15;
const ZOOM_SENSITIVITY = 0.002;

export const OrgChart: React.FC<OrgChartProps> = ({ people, lineSettings, onUpdateLineSettings, cardSettings, onUpdateCardSettings, onMovePerson, onReorderPerson, onUpdatePerson, onDeletePerson, onAddPerson, departments: propDepartments, locations: propLocations, jobTitles: propJobTitles, onAddDepartment, onAddLocation, onAddJobTitle, onDeleteDepartment, onDeleteLocation, onDeleteJobTitle, showAddModal, onCloseAddModal, onOpenAddModal, departmentColors = {}, onSetDepartmentColor, locationColors = {}, onSetLocationColor }) => {
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isZooming, setIsZooming] = useState(false); // Track when actively zooming for smooth transitions
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  // Use refs for scale/position so the non-passive wheel handler always has current values
  const scaleRef = useRef(0.8);
  const positionRef = useRef({ x: 0, y: 0 });

  // Tier background bands state
  const [tierBands, setTierBands] = useState<Array<{tier: number; top: number; height: number; width: number}>>([]);
  
  // Unified Settings Panel
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<'cards' | 'lines'>('cards');
  
  // DnD State for People
  const [draggedPersonId, setDraggedPersonId] = useState<string | null>(null);

  // Edit Modal State
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // Sync editingPerson's sortOrder from people prop when reorder happens outside modal
  useEffect(() => {
    if (editingPerson) {
      const updatedPerson = people.find(p => p.id === editingPerson.id);
      if (updatedPerson && updatedPerson.sortOrder !== editingPerson.sortOrder) {
        setEditingPerson(prev => prev ? { ...prev, sortOrder: updatedPerson.sortOrder } : null);
      }
    }
  }, [people]);

  // Department Badge Color Picker State
  const [colorPickerDept, setColorPickerDept] = useState<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { positionRef.current = position; }, [position]);

  // --- CANVAS CONTROLS ---
  // Helper to trigger zoom transition mode (for button-based zoom only)
  const triggerZoomTransition = () => {
    setIsZooming(true);
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    zoomTimeoutRef.current = setTimeout(() => setIsZooming(false), 350);
  };

  // Non-passive wheel handler attached via useEffect so preventDefault() works
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        // Multiplicative zoom for consistent feel at all scales
        const factor = Math.pow(0.998, e.deltaY);
        const oldScale = scaleRef.current;
        const newScale = Math.min(Math.max(MIN_ZOOM, oldScale * factor), MAX_ZOOM);
        // Zoom toward cursor position
        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const pos = positionRef.current;
        const newX = cursorX - (cursorX - pos.x) * (newScale / oldScale);
        const newY = cursorY - (cursorY - pos.y) * (newScale / oldScale);
        setScale(newScale);
        setPosition({ x: newX, y: newY });
      } else {
        setPosition(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Zoom helper: zoom toward the center of the viewport
  const zoomToCenter = (newScale: number) => {
    const el = canvasRef.current;
    if (!el) {
      setScale(newScale);
      return;
    }
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const oldScale = scaleRef.current;
    const pos = positionRef.current;
    const newX = cx - (cx - pos.x) * (newScale / oldScale);
    const newY = cy - (cy - pos.y) * (newScale / oldScale);
    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

  // Zoom helper functions
  const zoomIn = () => { triggerZoomTransition(); zoomToCenter(Math.min(scale + ZOOM_STEP, MAX_ZOOM)); };
  const zoomOut = () => { triggerZoomTransition(); zoomToCenter(Math.max(scale - ZOOM_STEP, MIN_ZOOM)); };
  const resetZoom = () => { triggerZoomTransition(); setScale(0.8); setPosition({ x: 0, y: 0 }); };
  const zoomPercent = Math.round(scale * 100);

  const handleFitToScreen = () => {
    const content = document.getElementById('chart-content');
    const el = canvasRef.current;
    if (!content || !el) return;

    const containerRect = el.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();

    // Get the unscaled content dimensions
    const contentWidth = contentRect.width / scale;
    const contentHeight = contentRect.height / scale;

    // Calculate scale to fit content within container with padding
    const fitScale = Math.min(
      (containerRect.width * 0.9) / contentWidth,
      (containerRect.height * 0.9) / contentHeight,
      MAX_ZOOM
    );
    const clampedScale = Math.max(MIN_ZOOM, fitScale);

    // Center the content within the container
    const scaledWidth = contentWidth * clampedScale;
    const scaledHeight = contentHeight * clampedScale;
    const newX = (containerRect.width - scaledWidth) / 2;
    const newY = (containerRect.height - scaledHeight) / 2;

    triggerZoomTransition();
    setScale(clampedScale);
    setPosition({ x: newX, y: newY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.card-node')) return;
    setIsDraggingCanvas(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  // --- DND HANDLERS ---
  const onCardDragStart = (e: React.DragEvent, id: string) => {
    setDraggedPersonId(id);
  };

  const onCardDragEnd = () => {
    setDraggedPersonId(null);
  };

  const onCardDrop = (e: React.DragEvent, targetId: string) => {
    if (draggedPersonId && draggedPersonId !== targetId) {
      onMovePerson(draggedPersonId, targetId);
    }
    setDraggedPersonId(null);
  };

  const getSecondaryManager = (p: Person): Person | undefined => {
    if (p.secondaryManagerIds && p.secondaryManagerIds.length > 0) {
      return people.find(m => m.id === p.secondaryManagerIds![0]);
    }
    return undefined;
  };

  // Cleanup zoom timeout on unmount
  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+, or Cmd+, to open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- DATA PREP ---
  // Root people (executives)
  const rootPeople = useMemo(() => {
    return people.filter(p => !p.managerId || !people.find(m => m.id === p.managerId)).sort(sortBySortOrder);
  }, [people]);

  const getDirectReports = (managerId: string) => people.filter(p => p.managerId === managerId).sort(sortBySortOrder);

  // Get Department Heads (Direct reports of Root)
  const deptHeads = useMemo(() => {
    return rootPeople.flatMap(root => getDirectReports(root.id));
  }, [rootPeople, people]);

  // Group Heads by Department
  const departments = useMemo(() => {
    const depts: Record<string, Person[]> = {};
    deptHeads.forEach(head => {
      const dName = head.department || 'Other';
      if (!depts[dName]) depts[dName] = [];
      depts[dName].push(head);
    });
    return depts;
  }, [deptHeads]);

  // Compute effective tier (absolute depth from root) for each person
  // Auto-assign: tier = hierarchy depth (CEO=0, direct reports=1, etc.)
  // Manual override: if person.tier is set, use it (but enforce child > parent)
  const effectiveTiers = useMemo(() => {
    const tiers = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];

    // Build a children lookup for efficient traversal
    const childrenOf = new Map<string, Person[]>();
    people.forEach(p => {
      if (p.managerId) {
        if (!childrenOf.has(p.managerId)) childrenOf.set(p.managerId, []);
        childrenOf.get(p.managerId)!.push(p);
      }
    });

    // Seed: root people always start at tier 0 (Executive)
    // unless manually overridden
    rootPeople.forEach(p => {
      const tier = (p.tier != null) ? p.tier : 0;
      tiers.set(p.id, tier);
      visited.add(p.id);
      queue.push({ id: p.id, depth: 0 });
    });

    // BFS traversal - auto-assign based on depth, respect overrides
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const parentTier = tiers.get(id)!;
      const children = childrenOf.get(id) || [];
      children.forEach(child => {
        if (visited.has(child.id)) return; // cycle protection
        const naturalTier = parentTier + 1; // auto: one below parent
        const desired = (child.tier != null) ? child.tier : naturalTier;
        // Enforce: child must be at least parentTier + 1
        const effective = Math.max(desired, parentTier + 1);
        tiers.set(child.id, effective);
        visited.add(child.id);
        queue.push({ id: child.id, depth: depth + 1 });
      });
    }

    // Orphans: people not reached by BFS
    people.forEach(p => {
      if (!visited.has(p.id)) {
        tiers.set(p.id, (p.tier != null) ? p.tier : 0);
      }
    });

    return tiers;
  }, [people, rootPeople]);

  // Align same-tier nodes horizontally and compute tier background bands.
  // Uses requestAnimationFrame to avoid layout thrashing glitches.
  const tierAlignRafRef = useRef<number>(0);

  useEffect(() => {
    // Cancel any pending frame
    cancelAnimationFrame(tierAlignRafRef.current);

    tierAlignRafRef.current = requestAnimationFrame(() => {
      const container = document.getElementById('chart-content');
      if (!container || people.length === 0) {
        setTierBands([]);
        return;
      }

      // Step 1: Reset all previous tier alignment margins
      container.querySelectorAll('[data-tier-align]').forEach(el => {
        (el as HTMLElement).style.marginTop = '0px';
      });

      // Step 2: Group elements by their effective tier
      const tierGroups = new Map<number, Array<{ personId: string; wrapper: HTMLElement }>>();

      effectiveTiers.forEach((tier, personId) => {
        const nodeEl = document.getElementById(`node-${personId}`);
        if (!nodeEl) return;
        const wrapper = nodeEl.closest('[data-tier-align]') as HTMLElement;
        if (!wrapper) return;
        if (!tierGroups.has(tier)) tierGroups.set(tier, []);
        tierGroups.get(tier)!.push({ personId, wrapper });
      });

      const sortedTiers = Array.from(tierGroups.keys()).sort((a, b) => a - b);
      if (sortedTiers.length === 0) {
        setTierBands([]);
        return;
      }

      const tierGap = 24; // minimum px gap between tier bands
      const MAX_PASSES = 8;

      // Helper: measure a node's position relative to container, accounting for scale
      const measureNode = (personId: string, containerTop: number) => {
        const nodeEl = document.getElementById(`node-${personId}`);
        if (!nodeEl) return { top: 0, bottom: 0 };
        const rect = nodeEl.getBoundingClientRect();
        return {
          top: (rect.top - containerTop) / scale,
          bottom: (rect.bottom - containerTop) / scale,
        };
      };

      // Step 3: Multi-pass alignment until converged
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        let totalDelta = 0;
        const cTop = container.getBoundingClientRect().top;

        for (let i = 0; i < sortedTiers.length; i++) {
          const tier = sortedTiers[i];
          const group = tierGroups.get(tier)!;

          // 3a) Align same-tier cards to same horizontal line (push up to max Y)
          if (group.length > 1) {
            // Re-read container top since margins changed
            const ct = container.getBoundingClientRect().top;
            const measurements = group.map(item => ({
              ...item,
              ...measureNode(item.personId, ct),
            }));
            const maxTop = Math.max(...measurements.map(m => m.top));

            measurements.forEach(item => {
              const delta = maxTop - item.top;
              if (delta > 0.5) {
                const current = parseFloat(item.wrapper.style.marginTop || '0');
                item.wrapper.style.marginTop = `${current + delta}px`;
                totalDelta += delta;
              }
            });
          }

          // 3b) Enforce ordering: this tier must start below previous tier's bottom
          if (i > 0) {
            const ct = container.getBoundingClientRect().top;
            const prevGroup = tierGroups.get(sortedTiers[i - 1])!;
            let prevMaxBottom = -Infinity;
            prevGroup.forEach(item => {
              const m = measureNode(item.personId, ct);
              if (m.bottom > prevMaxBottom) prevMaxBottom = m.bottom;
            });

            let curMinTop = Infinity;
            group.forEach(item => {
              const m = measureNode(item.personId, ct);
              if (m.top < curMinTop) curMinTop = m.top;
            });

            const needed = prevMaxBottom + tierGap - curMinTop;
            if (needed > 0.5) {
              group.forEach(item => {
                const current = parseFloat(item.wrapper.style.marginTop || '0');
                item.wrapper.style.marginTop = `${current + needed}px`;
              });
              totalDelta += needed * group.length;
            }
          }
        }

        // Converged
        if (totalDelta < 0.5) break;
      }

      // Step 4: Compute tier background band positions
      // Positions are in the container's coordinate space (pre-scale),
      // suitable for absolute positioning inside #chart-content
      const cTop = container.getBoundingClientRect().top;
      const bandPadding = 16;
      const bands: Array<{ tier: number; top: number; height: number; width: number }> = [];

      for (const tier of sortedTiers) {
        const group = tierGroups.get(tier)!;
        let minTop = Infinity, maxBottom = -Infinity;

        group.forEach(item => {
          const m = measureNode(item.personId, cTop);
          if (m.top < minTop) minTop = m.top;
          if (m.bottom > maxBottom) maxBottom = m.bottom;
        });

        if (minTop !== Infinity) {
          bands.push({
            tier,
            top: minTop - bandPadding,
            height: (maxBottom - minTop) + bandPadding * 2,
            width: container.scrollWidth,
          });
        }
      }

      setTierBands(bands);
    });

    return () => cancelAnimationFrame(tierAlignRafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, effectiveTiers, cardSettings]);

  const allDeptNames = useMemo(() => {
    if (propDepartments) return propDepartments;
    const customDepts = Object.keys(departments).filter(d => !DEPARTMENTS.includes(d));
    return [...DEPARTMENTS, ...customDepts];
  }, [departments, propDepartments]);

  // Get all unique locations from people
  const allLocations = useMemo(() => {
    if (propLocations) return propLocations;
    const locs = new Set([...LOCATIONS]);
    people.forEach(p => {
      if (p.location) locs.add(p.location as string);
    });
    return Array.from(locs);
  }, [people, propLocations]);

  // Modal tab state
  const [modalTab, setModalTab] = useState<'basic' | 'reporting' | 'team'>('basic');

  // Add new department/location/team state
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [isAddingLoc, setIsAddingLoc] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [isAddingJobTitle, setIsAddingJobTitle] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  // Get all unique team names from people
  const allTeamNames = useMemo(() => {
    const teams = new Set<string>();
    people.forEach(p => {
      if (p.teamName) teams.add(p.teamName);
    });
    return Array.from(teams).sort();
  }, [people]);

  // Get all unique job titles
  const allJobTitles = useMemo(() => {
    if (propJobTitles) return propJobTitles;
    const titles = new Set<string>();
    people.forEach(p => {
      if (p.title) titles.add(p.title);
    });
    return Array.from(titles).sort();
  }, [people, propJobTitles]);

  // Department badge color helper
  const getDeptBadgeClasses = (deptName: string): string => {
    const color = departmentColors[deptName];
    const defaultStyle = 'bg-slate-700 text-white';
    
    if (color) {
      const colorMap: Record<string, string> = {
        'slate': 'bg-slate-700 text-white',
        'emerald': 'bg-emerald-500 text-white',
        'blue': 'bg-blue-500 text-white',
        'amber': 'bg-amber-500 text-white',
        'purple': 'bg-purple-500 text-white',
        'rose': 'bg-rose-500 text-white',
        'cyan': 'bg-cyan-500 text-white',
        'orange': 'bg-orange-500 text-white',
        'indigo': 'bg-indigo-500 text-white',
        'teal': 'bg-teal-500 text-white',
      };
      return colorMap[color] || defaultStyle;
    }
    return defaultStyle;
  };

  // New Person State
  const [newPerson, setNewPerson] = useState<Partial<Person>>({
    name: '',
    title: '',
    department: DEPARTMENTS[0],
    location: LOCATIONS[0],
    managerId: null
  });

  const handleAddNewPerson = () => {
    if ((newPerson.name || newPerson.isVacancy) && newPerson.title && onAddPerson) {
      // Auto-assign sortOrder: place at end of siblings
      // Normalize managerId for comparison (null/undefined/'' all mean "root")
      const newMgrId = newPerson.managerId || null;
      const siblings = people.filter(p => (p.managerId || null) === newMgrId);
      const maxOrder = siblings.length > 0 
        ? siblings.reduce((max, s) => Math.max(max, s.sortOrder ?? 0), 0) + 1 
        : 0;
      const person: Person = {
        id: crypto.randomUUID(),
        name: newPerson.isVacancy ? 'Vacancy' : newPerson.name!,
        title: newPerson.title,
        department: newPerson.department || DEPARTMENTS[0],
        location: newPerson.location || LOCATIONS[0],
        managerId: newPerson.managerId || null,
        secondaryManagerIds: [],
        teamName: newPerson.teamName,
        isTeamLead: newPerson.isTeamLead,
        isVacancy: newPerson.isVacancy,
        sortOrder: maxOrder
      };
      onAddPerson(person);
      setNewPerson({
        name: '',
        title: '',
        department: DEPARTMENTS[0],
        location: LOCATIONS[0],
        managerId: null,
        isVacancy: false
      });
      onCloseAddModal?.();
    }
  };

  const handleAddDirectReport = (managerId: string, department?: string, location?: string) => {
    setNewPerson({
      name: '',
      title: '',
      department: department || DEPARTMENTS[0],
      location: location || LOCATIONS[0],
      managerId: managerId,
      isVacancy: false
    });
    onOpenAddModal?.();
  };

  const handleAddNewDept = () => {
    if (newDeptName.trim() && onAddDepartment) {
      onAddDepartment(newDeptName.trim());
      setEditingPerson(prev => prev ? {...prev, department: newDeptName.trim()} : null);
      setNewDeptName('');
      setIsAddingDept(false);
    }
  };

  const handleAddNewLoc = () => {
    if (newLocName.trim() && onAddLocation) {
      onAddLocation(newLocName.trim());
      setEditingPerson(prev => prev ? {...prev, location: newLocName.trim()} : null);
      setNewLocName('');
      setIsAddingLoc(false);
    }
  };

  const handleAddNewJobTitle = () => {
    if (newJobTitle.trim() && onAddJobTitle) {
      onAddJobTitle(newJobTitle.trim());
      setEditingPerson(prev => prev ? {...prev, title: newJobTitle.trim()} : null);
      setNewJobTitle('');
      setIsAddingJobTitle(false);
    }
  };

  // --- EDIT HANDLERS ---
  const handleEditClick = (person: Person) => {
    setEditingPerson({...person});
  };

  const handleSaveEdit = () => {
    if (editingPerson && onUpdatePerson) {
      onUpdatePerson(editingPerson);
      setEditingPerson(null);
    }
  };

  const handleDeleteClick = (id: string) => {
    if (window.confirm("Are you sure you want to delete this person?") && onDeletePerson) {
      onDeletePerson(id);
      setEditingPerson(null);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 select-none">
      {/* Edit Modal Overlay */}
      {editingPerson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditingPerson(null)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                  {editingPerson.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{editingPerson.name || 'New Person'}</h3>
                  <p className="text-xs text-slate-500">{editingPerson.title || 'No title'}</p>
                </div>
              </div>
              <button onClick={() => setEditingPerson(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <button 
                onClick={() => setModalTab('basic')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${modalTab === 'basic' ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <User size={14} /> Basic Info
              </button>
              <button 
                onClick={() => setModalTab('reporting')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${modalTab === 'reporting' ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <Link size={14} /> Reporting
              </button>
              <button 
                onClick={() => setModalTab('team')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${modalTab === 'team' ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <Users size={14} /> Team
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* BASIC INFO TAB */}
              {modalTab === 'basic' && (
                <>
                  {/* Vacancy Checkbox */}
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 mb-4">
                    <input 
                      type="checkbox" 
                      id="isVacancyEdit"
                      checked={editingPerson.isVacancy || false}
                      onChange={e => setEditingPerson({...editingPerson, isVacancy: e.target.checked, name: e.target.checked ? 'Vacancy' : editingPerson.name})}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="isVacancyEdit" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                      This is a Vacant Position
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                      <input 
                        className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium ${editingPerson.isVacancy ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                        value={editingPerson.isVacancy ? 'Vacancy' : editingPerson.name}
                        onChange={e => !editingPerson.isVacancy && setEditingPerson({...editingPerson, name: e.target.value})}
                        placeholder="Enter name"
                        disabled={editingPerson.isVacancy}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Job Title</label>
                        {!isAddingJobTitle && onAddJobTitle && (
                          <button 
                            onClick={() => setIsAddingJobTitle(true)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                          >
                            <Plus size={10} /> New
                          </button>
                        )}
                      </div>
                      {isAddingJobTitle ? (
                        <div className="flex items-center gap-2 relative z-20">
                          <input 
                            autoFocus
                            className="flex-1 px-3 py-2.5 border-2 border-indigo-400 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                            placeholder="New job title..."
                            value={newJobTitle}
                            onChange={e => setNewJobTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAddNewJobTitle();
                              if (e.key === 'Escape') { setIsAddingJobTitle(false); setNewJobTitle(''); }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.preventDefault(); e.stopPropagation(); 
                              if (newJobTitle.trim()) {
                                const updated = { ...editingPerson, title: newJobTitle.trim() };
                                setEditingPerson(updated);
                                onAddJobTitle?.(newJobTitle.trim());
                                onUpdatePerson?.(updated);
                                setNewJobTitle('');
                                setIsAddingJobTitle(false);
                              }
                            }} 
                            className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm flex-shrink-0"
                          >
                            <Check size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsAddingJobTitle(false); setNewJobTitle(''); }} 
                            className="p-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 shadow-sm flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 relative z-10">
                          <div className="relative flex-1">
                            <select 
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white appearance-none cursor-pointer transition-all"
                              value={editingPerson.title}
                              onChange={e => setEditingPerson({...editingPerson, title: e.target.value})}
                            >
                              {allJobTitles.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                          {onDeleteJobTitle && allJobTitles.length > 1 && (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const confirmed = window.confirm(`Delete job title "${editingPerson.title}"? People with this title will need to be reassigned.`);
                                if (confirmed) {
                                  const newTitle = allJobTitles.find(t => t !== editingPerson.title) || '';
                                  onDeleteJobTitle(editingPerson.title);
                                  setEditingPerson({...editingPerson, title: newTitle});
                                }
                              }}
                              className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors flex-shrink-0"
                              title="Delete this job title"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Building size={10} /> Department
                        </label>
                        {!isAddingDept && onAddDepartment && (
                          <button 
                            onClick={() => setIsAddingDept(true)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                          >
                            <Plus size={10} /> New
                          </button>
                        )}
                      </div>
                      {isAddingDept ? (
                        <div className="flex items-center gap-2 relative z-20">
                          <input 
                            autoFocus
                            className="flex-1 px-3 py-2.5 border-2 border-indigo-400 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                            placeholder="New department..."
                            value={newDeptName}
                            onChange={e => setNewDeptName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAddNewDept();
                              if (e.key === 'Escape') { setIsAddingDept(false); setNewDeptName(''); }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.preventDefault(); e.stopPropagation(); 
                              if (newDeptName.trim()) {
                                const updated = { ...editingPerson, department: newDeptName.trim() };
                                setEditingPerson(updated);
                                onAddDepartment?.(newDeptName.trim());
                                onUpdatePerson?.(updated);
                                setNewDeptName('');
                                setIsAddingDept(false);
                              }
                            }} 
                            className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm flex-shrink-0"
                          >
                            <Check size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsAddingDept(false); setNewDeptName(''); }} 
                            className="p-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 shadow-sm flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 relative z-10">
                          <div className="relative flex-1">
                            <select 
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white appearance-none cursor-pointer transition-all"
                              value={editingPerson.department}
                              onChange={e => setEditingPerson({...editingPerson, department: e.target.value})}
                            >
                              {allDeptNames.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                          {onDeleteDepartment && allDeptNames.length > 1 && (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const confirmed = window.confirm(`Delete department "${editingPerson.department}"? People in this department will need to be reassigned.`);
                                if (confirmed) {
                                  const newDept = allDeptNames.find(d => d !== editingPerson.department) || '';
                                  onDeleteDepartment(editingPerson.department);
                                  setEditingPerson({...editingPerson, department: newDept});
                                }
                              }}
                              className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors flex-shrink-0"
                              title="Delete this department"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <MapPin size={10} /> Location
                        </label>
                        {!isAddingLoc && onAddLocation && (
                          <button 
                            onClick={() => setIsAddingLoc(true)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                          >
                            <Plus size={10} /> New
                          </button>
                        )}
                      </div>
                      {isAddingLoc ? (
                        <div className="flex items-center gap-2 relative z-20">
                          <input 
                            autoFocus
                            className="flex-1 px-3 py-2.5 border-2 border-indigo-400 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                            placeholder="New location..."
                            value={newLocName}
                            onChange={e => setNewLocName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAddNewLoc();
                              if (e.key === 'Escape') { setIsAddingLoc(false); setNewLocName(''); }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.preventDefault(); e.stopPropagation(); 
                              if (newLocName.trim()) {
                                const updated = { ...editingPerson, location: newLocName.trim() };
                                setEditingPerson(updated);
                                onAddLocation?.(newLocName.trim());
                                onUpdatePerson?.(updated);
                                setNewLocName('');
                                setIsAddingLoc(false);
                              }
                            }} 
                            className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm flex-shrink-0"
                          >
                            <Check size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsAddingLoc(false); setNewLocName(''); }} 
                            className="p-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 shadow-sm flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 relative z-10">
                          <LocationSelect
                            value={editingPerson.location || ''}
                            onChange={(loc) => setEditingPerson({...editingPerson, location: loc})}
                            customLocations={allLocations}
                            className="flex-1"
                          />
                          {onDeleteLocation && allLocations.length > 1 && (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const confirmed = window.confirm(`Delete location "${editingPerson.location}"? People in this location will need to be reassigned.`);
                                if (confirmed) {
                                  const newLoc = allLocations.find(l => l !== editingPerson.location) || '';
                                  onDeleteLocation(editingPerson.location || '');
                                  setEditingPerson({...editingPerson, location: newLoc});
                                }
                              }}
                              className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors flex-shrink-0"
                              title="Delete this location"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Mail size={10} /> Email
                      </label>
                      <input 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={editingPerson.email || ''}
                        onChange={e => setEditingPerson({...editingPerson, email: e.target.value})}
                        placeholder="email@company.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Phone size={10} /> Phone
                      </label>
                      <input 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={editingPerson.phone || ''}
                        onChange={e => setEditingPerson({...editingPerson, phone: e.target.value})}
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>

                </>
              )}

              {/* REPORTING TAB */}
              {modalTab === 'reporting' && (
                <>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Primary Manager (Solid Line)</label>
                      <div className="relative">
                        <select 
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white appearance-none cursor-pointer"
                          value={editingPerson.managerId || ''}
                          onChange={e => setEditingPerson({...editingPerson, managerId: e.target.value || null})}
                        >
                          <option value="">No Manager (Root/Top Level)</option>
                          {people.filter(p => p.id !== editingPerson.id).map(p => (
                            <option key={p.id} value={p.id}>{p.name} — {p.title}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">The direct reporting relationship shown with a solid line</p>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-slate-200">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Visual Tier (Level)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          min="0"
                          max="20"
                          className="w-20 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={editingPerson.tier != null ? editingPerson.tier : ''}
                          onChange={e => setEditingPerson({...editingPerson, tier: e.target.value !== '' ? parseInt(e.target.value) : undefined})}
                          placeholder="Auto"
                        />
                        <p className="text-[10px] text-slate-400 flex-1">
                          Force this person to appear at a specific level (0 = Executive). Leave empty for auto.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-slate-200">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sort Order (Position Among Siblings)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          min="0"
                          className="w-20 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={editingPerson.sortOrder != null ? editingPerson.sortOrder : ''}
                          onChange={e => setEditingPerson({...editingPerson, sortOrder: e.target.value !== '' ? parseInt(e.target.value) : undefined})}
                          placeholder="Auto"
                        />
                        {onReorderPerson && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => onReorderPerson(editingPerson.id, 'left')}
                              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Move left"
                            >
                              <ArrowLeft size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onReorderPerson(editingPerson.id, 'right')}
                              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Move right"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 flex-1">
                          Lower number = further left. Use arrows or set manually. Leave empty for alphabetical.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <Link size={10} /> Secondary Manager (Dotted Line)
                      </label>
                      <div className="relative">
                        <select 
                          className="w-full px-3 py-2.5 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none bg-white appearance-none cursor-pointer"
                          value={editingPerson.secondaryManagerIds?.[0] || ''}
                          onChange={e => setEditingPerson({
                            ...editingPerson, 
                            secondaryManagerIds: e.target.value ? [e.target.value] : []
                          })}
                        >
                          <option value="">None</option>
                          {people.filter(p => p.id !== editingPerson.id && p.id !== editingPerson.managerId).map(p => (
                            <option key={`sec-${p.id}`} value={p.id}>{p.name} — {p.title}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-amber-600/70 mt-1">Cross-functional or matrix reporting shown on card</p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                        <Users size={10} /> Supports (Support Staff)
                      </label>
                      <div className="relative">
                        <select 
                          multiple
                          className="w-full px-3 py-2.5 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none bg-white appearance-none cursor-pointer h-32"
                          value={editingPerson.supportedIds || []}
                          onChange={e => {
                            const selected = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
                            setEditingPerson({
                              ...editingPerson, 
                              supportedIds: selected
                            });
                          }}
                        >
                          {people.filter(p => p.id !== editingPerson.id).map(p => (
                            <option key={`sup-${p.id}`} value={p.id}>{p.name} — {p.title}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[10px] text-blue-600/70 mt-1">Select multiple people (hold Ctrl/Cmd)</p>
                    </div>

                    {/* Support Line Color */}
                    <div className="space-y-2 pt-2 border-t border-blue-200/50">
                      <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Line Color</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: 'blue', hex: '#3b82f6', bg: 'bg-blue-500' },
                          { name: 'indigo', hex: '#6366f1', bg: 'bg-indigo-500' },
                          { name: 'violet', hex: '#8b5cf6', bg: 'bg-violet-500' },
                          { name: 'purple', hex: '#a855f7', bg: 'bg-purple-500' },
                          { name: 'fuchsia', hex: '#d946ef', bg: 'bg-fuchsia-500' },
                          { name: 'pink', hex: '#ec4899', bg: 'bg-pink-500' },
                          { name: 'rose', hex: '#f43f5e', bg: 'bg-rose-500' },
                          { name: 'orange', hex: '#f97316', bg: 'bg-orange-500' },
                          { name: 'amber', hex: '#f59e0b', bg: 'bg-amber-500' },
                          { name: 'emerald', hex: '#10b981', bg: 'bg-emerald-500' },
                          { name: 'teal', hex: '#14b8a6', bg: 'bg-teal-500' },
                          { name: 'cyan', hex: '#06b6d4', bg: 'bg-cyan-500' },
                          { name: 'slate', hex: '#64748b', bg: 'bg-slate-500' },
                        ].map(color => (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => setEditingPerson({...editingPerson, supportColor: color.hex})}
                            className={`w-6 h-6 rounded-full ${color.bg} transition-all ${editingPerson.supportColor === color.hex ? 'ring-2 ring-offset-2 ring-blue-400 scale-110' : 'hover:scale-105 opacity-70 hover:opacity-100'}`}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* TEAM TAB */}
              {modalTab === 'team' && (
                <>
                  <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-indigo-100">
                      <Users size={16} className="text-indigo-500"/>
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Team Configuration</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Users size={10} /> Team Name
                        </label>
                        {!isAddingTeam && (
                          <button 
                            type="button"
                            onClick={() => setIsAddingTeam(true)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                          >
                            <Plus size={10} /> New
                          </button>
                        )}
                      </div>
                      {isAddingTeam ? (
                        <div className="flex items-center gap-2">
                          <input 
                            autoFocus
                            className="flex-1 px-3 py-2.5 border-2 border-indigo-400 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                            placeholder="New team name..."
                            value={newTeamName}
                            onChange={e => setNewTeamName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newTeamName.trim()) {
                                const updated = { ...editingPerson, teamName: newTeamName.trim() };
                                setEditingPerson(updated);
                                onUpdatePerson?.(updated);
                                setNewTeamName('');
                                setIsAddingTeam(false);
                              }
                              if (e.key === 'Escape') { setIsAddingTeam(false); setNewTeamName(''); }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.preventDefault(); e.stopPropagation(); 
                              if (newTeamName.trim()) {
                                const updated = { ...editingPerson, teamName: newTeamName.trim() };
                                setEditingPerson(updated);
                                onUpdatePerson?.(updated);
                                setNewTeamName('');
                                setIsAddingTeam(false);
                              }
                            }} 
                            className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm flex-shrink-0"
                          >
                            <Check size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsAddingTeam(false); setNewTeamName(''); }} 
                            className="p-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 shadow-sm flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="relative flex-1">
                            <select 
                              className="w-full px-3 py-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none bg-white appearance-none cursor-pointer transition-all"
                              value={editingPerson.teamName || ''}
                              onChange={e => setEditingPerson({...editingPerson, teamName: e.target.value})}
                            >
                              <option value="">No Team</option>
                              {allTeamNames.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                          </div>
                          {editingPerson.teamName && (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingPerson({...editingPerson, teamName: ''});
                              }}
                              className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 hover:text-slate-600 transition-colors flex-shrink-0"
                              title="Remove from team"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">People with the same team name will be grouped together with a background</p>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-indigo-100 mt-3">
                      <input 
                        type="checkbox"
                        id="isTeamLeadModal"
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={editingPerson.isTeamLead || false}
                        onChange={e => setEditingPerson({...editingPerson, isTeamLead: e.target.checked})}
                      />
                      <label htmlFor="isTeamLeadModal" className="text-sm font-medium text-slate-700 select-none cursor-pointer flex items-center gap-2 flex-1">
                        <Crown size={16} className="text-amber-500" />
                        <div>
                          <span className="block">Designate as Team Leader</span>
                          <span className="text-[10px] text-slate-400 font-normal">Shows a crown badge on their card</span>
                        </div>
                      </label>
                    </div>

                    {/* Team Color Picker */}
                    {editingPerson.teamName && (
                      <div className="space-y-2 mt-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Team Color</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { name: 'indigo', bg: 'bg-indigo-500' },
                            { name: 'emerald', bg: 'bg-emerald-500' },
                            { name: 'amber', bg: 'bg-amber-500' },
                            { name: 'rose', bg: 'bg-rose-500' },
                            { name: 'cyan', bg: 'bg-cyan-500' },
                            { name: 'purple', bg: 'bg-purple-500' },
                            { name: 'blue', bg: 'bg-blue-500' },
                            { name: 'orange', bg: 'bg-orange-500' },
                          ].map(color => (
                            <button
                              key={color.name}
                              type="button"
                              onClick={() => setEditingPerson({...editingPerson, teamColor: color.name})}
                              className={`w-8 h-8 rounded-lg ${color.bg} transition-all ${editingPerson.teamColor === color.name ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'}`}
                              title={color.name}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400">Color applies to all members of this team</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3">
              <button 
                onClick={() => handleDeleteClick(editingPerson.id)}
                className="px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditingPerson(null)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Settings Panel */}
      {cardSettings && onUpdateCardSettings && lineSettings && onUpdateLineSettings && (
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          cardSettings={cardSettings}
          onUpdateCardSettings={onUpdateCardSettings}
          lineSettings={lineSettings}
          onUpdateLineSettings={onUpdateLineSettings}
          locationColors={locationColors}
          onSetLocationColor={onSetLocationColor || (() => {})}
          locations={allLocations}
          previewPerson={people[0]}
          defaultTab={settingsDefaultTab}
        />
      )}

      {/* Add Person Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCloseAddModal}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Add New Person</h3>
                  <p className="text-xs text-slate-500">Create a new team member</p>
                </div>
              </div>
              <button onClick={onCloseAddModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Vacancy Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <input 
                  type="checkbox" 
                  id="isVacancyAdd"
                  checked={newPerson.isVacancy || false}
                  onChange={e => setNewPerson({...newPerson, isVacancy: e.target.checked, name: e.target.checked ? 'Vacancy' : ''})}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="isVacancyAdd" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                  Create as Vacant Position
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name *</label>
                  <input 
                    className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium ${newPerson.isVacancy ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                    value={newPerson.isVacancy ? 'Vacancy' : newPerson.name || ''}
                    onChange={e => !newPerson.isVacancy && setNewPerson({...newPerson, name: e.target.value})}
                    placeholder="Enter name"
                    disabled={newPerson.isVacancy}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Job Title *</label>
                  <div className="relative">
                    <select 
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white appearance-none cursor-pointer transition-all"
                      value={newPerson.title || ''}
                      onChange={e => setNewPerson({...newPerson, title: e.target.value})}
                    >
                      <option value="" disabled>Select a job title</option>
                      {allJobTitles.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Building size={10} /> Department
                  </label>
                  <div className="relative">
                    <select 
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white appearance-none cursor-pointer transition-all"
                      value={newPerson.department || ''}
                      onChange={e => setNewPerson({...newPerson, department: e.target.value})}
                    >
                      {allDeptNames.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={10} /> Location
                  </label>
                  <LocationSelect
                    value={newPerson.location || ''}
                    onChange={(loc) => setNewPerson({...newPerson, location: loc})}
                    customLocations={allLocations}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reports To</label>
                <div className="relative">
                  <select 
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white appearance-none cursor-pointer transition-all"
                    value={newPerson.managerId || ''}
                    onChange={e => setNewPerson({...newPerson, managerId: e.target.value || null})}
                  >
                    <option value="">No Manager (Top Level)</option>
                    {people.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {p.title}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Users size={10} /> Team (Optional)
                </label>
                <div className="relative">
                  <select 
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white appearance-none cursor-pointer transition-all"
                    value={newPerson.teamName || ''}
                    onChange={e => setNewPerson({...newPerson, teamName: e.target.value})}
                  >
                    <option value="">No Team</option>
                    {allTeamNames.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end items-center gap-3">
              <button 
                onClick={onCloseAddModal}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddNewPerson}
                disabled={(!newPerson.name && !newPerson.isVacancy) || !newPerson.title}
                className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Person
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Controls */}
      <div className="absolute bottom-8 right-8 z-50 flex flex-col gap-2 bg-white p-2 rounded-xl shadow-xl border border-slate-200">
        <button 
          onClick={() => { setSettingsDefaultTab('cards'); setShowSettings(true); }}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          title="Card Appearance (Ctrl+,)"
        >
          <Palette size={20} />
        </button>
        <button 
          onClick={() => { setSettingsDefaultTab('lines'); setShowSettings(true); }}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          title="Line Settings (Ctrl+,)"
        >
          <Sliders size={20} />
        </button>
        <div className="h-px bg-slate-200 my-1" />
        <button 
          onClick={zoomIn} 
          disabled={scale >= MAX_ZOOM}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent" 
          title={`Zoom In (max ${MAX_ZOOM * 100}%)`}
        >
          <ZoomIn size={20} />
        </button>
        
        {/* Zoom Percentage Display */}
        <div className="px-2 py-1 text-xs font-medium text-slate-500 text-center bg-slate-50 rounded-lg">
          {zoomPercent}%
        </div>
        
        <button 
          onClick={zoomOut} 
          disabled={scale <= MIN_ZOOM}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent" 
          title={`Zoom Out (min ${MIN_ZOOM * 100}%)`}
        >
          <ZoomOut size={20} />
        </button>
        <button onClick={handleFitToScreen} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Fit to Screen"><Maximize size={20} /></button>
        <button onClick={resetZoom} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Reset (80%)"><RotateCcw size={20} /></button>
      </div>

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing bg-dot-pattern overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          className={`origin-top-left ${isZooming ? 'transition-transform duration-300 ease-out' : ''}`}
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            willChange: isZooming ? 'transform' : 'auto'
          }}
        >
          <div id="chart-content" className="inline-block min-w-max p-24 relative">
            
            {/* Tier Background Bands - horizontal bands showing tier categories */}
            {tierBands.length > 0 && tierBands.map((band, i) => (
              <div
                key={`tier-band-${band.tier}`}
                style={{
                  position: 'absolute',
                  top: band.top,
                  left: 0,
                  right: 0,
                  height: band.height,
                  backgroundColor: i % 2 === 0 ? 'rgba(241, 245, 249, 0.45)' : 'rgba(226, 232, 240, 0.3)',
                  zIndex: 0,
                  pointerEvents: 'none',
                  borderTop: '1px solid rgba(203, 213, 225, 0.4)',
                  borderBottom: '1px solid rgba(203, 213, 225, 0.4)',
                }}
              >
                <div
                  style={{
                    position: 'sticky',
                    left: 12,
                    top: 4,
                    display: 'inline-block',
                    padding: '2px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'rgba(100, 116, 139, 0.7)',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    borderRadius: 6,
                    marginLeft: 12,
                    marginTop: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {band.tier === 0 ? 'Executive' : `Tier ${band.tier}`}
                </div>
              </div>
            ))}

            {/* Layer 1: Team/Department Backgrounds (z-index 1) - rendered BELOW lines */}
            {/* We achieve this by keeping backgrounds inside content but with negative z-index */}
            
            {/* Lines Layer - position absolute, z-index 2 */}
            <Lines people={people} deptHeads={deptHeads} scale={scale} settings={lineSettings} />

            {/* Content - no z-index to avoid creating stacking context */}
            <div className="flex flex-col items-center gap-8 relative">
              
              {/* Level 1: Executive */}
              {rootPeople.length > 0 ? (
                <div className="flex flex-col items-center gap-4 shrink-0">
                  {/* Executive Department Badge */}
                  <div className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg border-2 border-white ${getDeptBadgeClasses('Executive')}`}>
                    Executive
                  </div>
                  <div className="flex justify-center gap-16 shrink-0">
                  {rootPeople.map(person => (
                    <div key={person.id} className="card-node shrink-0 relative group/root" data-tier-align={person.id}>
                      <Card 
                        person={person} 
                        onClick={handleEditClick} 
                        isDeptHead={true} 
                        onDragStart={onCardDragStart}
                        onDragEnd={onCardDragEnd}
                        onDrop={onCardDrop}
                        isDragging={draggedPersonId === person.id}
                        secondaryManager={getSecondaryManager(person)}
                        supportedPeople={people.filter(p => person.supportedIds?.includes(p.id))}
                        onEdit={() => handleEditClick(person)}
                        onDelete={() => handleDeleteClick(person.id)}
                        cardSettings={cardSettings}
                      />
                      {/* Reorder Arrows for root-level cards */}
                      {onReorderPerson && rootPeople.length > 1 && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); onReorderPerson(person.id, 'left'); }}
                            className="absolute top-1/2 -translate-y-1/2 -left-7 w-5 h-5 bg-slate-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-slate-700 hover:scale-110 transition-all z-50 opacity-0 group-hover/root:opacity-100"
                            title="Move left"
                          >
                            <ArrowLeft size={11} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onReorderPerson(person.id, 'right'); }}
                            className="absolute top-1/2 -translate-y-1/2 -right-7 w-5 h-5 bg-slate-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-slate-700 hover:scale-110 transition-all z-50 opacity-0 group-hover/root:opacity-100"
                            title="Move right"
                          >
                            <ArrowRight size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              ) : (
                <div className="text-red-500 font-bold p-10 bg-white rounded shadow">
                  No root node found.
                </div>
              )}

              {/* Level 2: Department Badges (standalone row between exec and people) */}
              <div className="flex gap-24 items-start justify-center shrink-0">
                {allDeptNames.map(deptName => {
                  const heads = departments[deptName];
                  if (!heads || heads.length === 0) return null;

                  return (
                    <div key={deptName} className="flex flex-col items-center shrink-0 gap-4">
                       {/* Department Badge - standalone node */}
                       <div className={`relative ${colorPickerDept === deptName ? 'z-[300]' : 'z-10'}`}>
                          <button
                            id={`dept-badge-${deptName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setColorPickerDept(colorPickerDept === deptName ? null : deptName);
                            }}
                            className={`px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest shadow-xl border-4 border-white cursor-pointer hover:scale-105 transition-transform whitespace-nowrap ${getDeptBadgeClasses(deptName)}`}
                          >
                            {deptName}
                          </button>
                          
                          {/* Color Picker Popup */}
                          {colorPickerDept === deptName && (
                            <div 
                              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-white rounded-xl shadow-xl border border-slate-200 z-[200]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Badge Color</div>
                              <div className="flex flex-wrap gap-2 max-w-[180px] justify-center">
                                {[
                                  { name: 'slate', bg: 'bg-slate-700' },
                                  { name: 'emerald', bg: 'bg-emerald-500' },
                                  { name: 'blue', bg: 'bg-blue-500' },
                                  { name: 'amber', bg: 'bg-amber-500' },
                                  { name: 'purple', bg: 'bg-purple-500' },
                                  { name: 'rose', bg: 'bg-rose-500' },
                                  { name: 'cyan', bg: 'bg-cyan-500' },
                                  { name: 'orange', bg: 'bg-orange-500' },
                                  { name: 'indigo', bg: 'bg-indigo-500' },
                                  { name: 'teal', bg: 'bg-teal-500' },
                                ].map(color => (
                                  <button
                                    key={color.name}
                                    type="button"
                                    onClick={() => {
                                      onSetDepartmentColor?.(deptName, color.name);
                                      setColorPickerDept(null);
                                    }}
                                    className={`w-7 h-7 rounded-lg ${color.bg} transition-all ${departmentColors[deptName] === color.name ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'}`}
                                    title={color.name}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                       </div>

                       {/* Department People Container */}
                       <div className="relative rounded-[2rem] px-8 py-6 shrink-0">
                          {/* Department Background */}
                          <div 
                            className="absolute inset-0 bg-white/40 border border-slate-200/60 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow"
                            style={{ zIndex: -1 }}
                          ></div>

                          <div className="flex gap-16 shrink-0 relative">
                            {heads.map(head => (
                              <HierarchyTree 
                                key={head.id}
                                root={head}
                                people={people}
                                onPersonClick={handleEditClick}
                                onDragStart={onCardDragStart}
                                onDragEnd={onCardDragEnd}
                                onDrop={onCardDrop}
                                draggedId={draggedPersonId}
                                getSecondaryManager={getSecondaryManager}
                                onEdit={() => handleEditClick(head)}
                                onDelete={() => handleDeleteClick(head.id)}
                                onDeletePerson={handleDeleteClick}
                                departmentColors={departmentColors}
                                locationColors={locationColors}
                                onAddDirectReport={handleAddDirectReport}
                                onReorderPerson={onReorderPerson}
                                onSetDepartmentColor={onSetDepartmentColor}
                                cardSettings={cardSettings}
                              />
                            ))}
                          </div>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// --- DEPARTMENT BADGE HELPER (standalone for use in sub-components) ---
const getDeptBadgeClassesStandalone = (deptName: string, departmentColors: Record<string, string> = {}): string => {
  const color = departmentColors[deptName];
  const defaultStyle = 'bg-slate-700 text-white';
  if (color) {
    const colorMap: Record<string, string> = {
      'slate': 'bg-slate-700 text-white',
      'emerald': 'bg-emerald-500 text-white',
      'blue': 'bg-blue-500 text-white',
      'amber': 'bg-amber-500 text-white',
      'purple': 'bg-purple-500 text-white',
      'rose': 'bg-rose-500 text-white',
      'cyan': 'bg-cyan-500 text-white',
      'orange': 'bg-orange-500 text-white',
      'indigo': 'bg-indigo-500 text-white',
      'teal': 'bg-teal-500 text-white',
    };
    return colorMap[color] || defaultStyle;
  }
  return defaultStyle;
};

// --- RECURSIVE HIERARCHY TREE ---
interface TreeProps {
  root: Person;
  people: Person[];
  onPersonClick: (p: Person) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd?: () => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  draggedId: string | null;
  getSecondaryManager: (p: Person) => Person | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onDeletePerson?: (id: string) => void;
  isInsideParentTeam?: boolean; // Skip creating team wrapper if already inside parent's team
  departmentColors?: Record<string, string>;
  locationColors?: Record<string, string>;
  onAddDirectReport?: (managerId: string, department?: string, location?: string) => void;
  onReorderPerson?: (personId: string, direction: 'left' | 'right') => void;
  onSetDepartmentColor?: (dept: string, color: string) => void;
  cardSettings?: CardSettings;
  level?: number;
}

const HierarchyTree: React.FC<TreeProps> = ({ root, people, onPersonClick, onDragStart, onDragEnd, onDrop, draggedId, getSecondaryManager, onEdit, onDelete, onDeletePerson, isInsideParentTeam = false, departmentColors = {}, locationColors = {}, onAddDirectReport, onReorderPerson, onSetDepartmentColor, cardSettings, level = 0 }) => {
  const [subColorPickerDept, setSubColorPickerDept] = useState<string | null>(null);
  
  // Find direct reports
  const directReports = useMemo(() => {
    return people.filter(p => p.managerId === root.id).sort(sortBySortOrder);
  }, [people, root.id]);

  // Group by Team and Others (Flattened Location)
  const { teams, others } = useMemo(() => {
    const t: Record<string, Person[]> = {};
    const o: Person[] = [];

    directReports.forEach(p => {
      if (p.teamName) {
        if (!t[p.teamName]) t[p.teamName] = [];
        t[p.teamName].push(p);
      } else {
        o.push(p);
      }
    });
    return { teams: t, others: o };
  }, [directReports]);

  // Group ALL direct reports by department first (before team split)
  // Show department badges when any child is in a different department than the parent
  const { deptGroupsAll, showDeptBadges } = useMemo(() => {
    const groups: Record<string, { teamMembers: Record<string, Person[]>; nonTeamMembers: Person[] }> = {};
    directReports.forEach(p => {
      const dept = p.department || 'Other';
      if (!groups[dept]) groups[dept] = { teamMembers: {}, nonTeamMembers: [] };
      if (p.teamName) {
        if (!groups[dept].teamMembers[p.teamName]) groups[dept].teamMembers[p.teamName] = [];
        groups[dept].teamMembers[p.teamName].push(p);
      } else {
        groups[dept].nonTeamMembers.push(p);
      }
    });
    const childHasDifferentDept = directReports.some(p => (p.department || 'Other') !== root.department);
    return { deptGroupsAll: groups, showDeptBadges: childHasDifferentDept };
  }, [directReports, root.department]);

  const hasChildren = directReports.length > 0;

  // If root has a team name AND we're not already inside a parent's team, wrap everything
  const rootTeamName = root.teamName;
  
  if (rootTeamName && !isInsideParentTeam) {
    // Root has a team - wrap root and ALL direct reports in the team group
    const teamColor = root.teamColor || directReports.find(m => m.teamColor)?.teamColor;
    
    // Separate direct reports into "Same Team" and "Other Teams"
    const sameTeamMembers = directReports.filter(p => !p.teamName || p.teamName === rootTeamName);
    const otherTeamsMap: Record<string, Person[]> = {};
    
    directReports.filter(p => p.teamName && p.teamName !== rootTeamName).forEach(p => {
        if (!otherTeamsMap[p.teamName!]) otherTeamsMap[p.teamName!] = [];
        otherTeamsMap[p.teamName!].push(p);
    });

    const otherTeamsList = Object.entries(otherTeamsMap);

    return (
      <div data-tier-align={root.id}>
        <TeamGroup 
          teamName={rootTeamName}
          members={[root, ...sameTeamMembers]}
          otherTeams={otherTeamsList}
          people={people}
          onPersonClick={onPersonClick}
          onDragStart={onDragStart}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          draggedId={draggedId}
          getSecondaryManager={getSecondaryManager}
          onDeletePerson={onDeletePerson}
          includeRootAsHead={true}
          rootPerson={root}
          onRootEdit={onEdit}
          onRootDelete={onDelete}
          teamColor={teamColor}
          departmentColors={departmentColors}
          locationColors={locationColors}
          onAddDirectReport={onAddDirectReport}
          onReorderPerson={onReorderPerson}
          onSetDepartmentColor={onSetDepartmentColor}
          cardSettings={cardSettings}
          level={level}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center" data-tier-align={root.id}>
      {/* The Manager Card */}
      <div className="card-node shrink-0 mb-4 relative group/add">
        <Card 
          person={root} 
          onClick={onPersonClick} 
          isDeptHead={['Sales','Engineering','Marketing','HR','Finance','Operations','Executive'].includes(root.department)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
          isDragging={draggedId === root.id}
          secondaryManager={getSecondaryManager(root)}
          supportedPeople={people.filter(p => root.supportedIds?.includes(p.id))}
          onEdit={onEdit}
          onDelete={onDelete}
          deptColorOverride={departmentColors[root.department]}
          locationColorOverride={locationColors[root.location || '']}
          cardSettings={cardSettings}
        />
        {/* Add Button */}
        <button
            onClick={(e) => {
                e.stopPropagation();
                onAddDirectReport?.(root.id, root.department, root.location);
            }}
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 hover:scale-110 transition-all z-50 opacity-0 group-hover/add:opacity-100"
            title="Add Direct Report"
        >
            <Plus size={14} />
        </button>
        {/* Reorder Arrows */}
        {onReorderPerson && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onReorderPerson(root.id, 'left'); }}
              className="absolute top-1/2 -translate-y-1/2 -left-7 w-5 h-5 bg-slate-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-slate-700 hover:scale-110 transition-all z-50 opacity-0 group-hover/add:opacity-100"
              title="Move left"
            >
              <ArrowLeft size={11} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReorderPerson(root.id, 'right'); }}
              className="absolute top-1/2 -translate-y-1/2 -right-7 w-5 h-5 bg-slate-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-slate-700 hover:scale-110 transition-all z-50 opacity-0 group-hover/add:opacity-100"
              title="Move right"
            >
              <ArrowRight size={11} />
            </button>
          </>
        )}
      </div>

      {/* Children Container */}
      {hasChildren && (
        <div className="flex items-start gap-8 relative">
          
          {showDeptBadges ? (
            /* Department grouping: wrap ALL children by department with badges */
            Object.entries(deptGroupsAll).map(([deptName, { teamMembers, nonTeamMembers }]) => (
              <div key={`dept-${deptName}`} className="flex flex-col items-center shrink-0 gap-8">
                {/* Department Badge - clickable for color selection */}
                <div className={`relative ${subColorPickerDept === deptName ? 'z-[300]' : 'z-10'}`}>
                  <button
                    id={`sub-dept-badge-${root.id}-${deptName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubColorPickerDept(subColorPickerDept === deptName ? null : deptName);
                    }}
                    className={`px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest shadow-xl border-4 border-white whitespace-nowrap cursor-pointer hover:scale-105 transition-transform ${getDeptBadgeClassesStandalone(deptName, departmentColors)}`}
                  >
                    {deptName}
                  </button>
                  {/* Color Picker Popup */}
                  {subColorPickerDept === deptName && (
                    <div 
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-white rounded-xl shadow-xl border border-slate-200 z-[200]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Badge Color</div>
                      <div className="flex flex-wrap gap-2 max-w-[180px] justify-center">
                        {[
                          { name: 'slate', bg: 'bg-slate-700' },
                          { name: 'emerald', bg: 'bg-emerald-500' },
                          { name: 'blue', bg: 'bg-blue-500' },
                          { name: 'amber', bg: 'bg-amber-500' },
                          { name: 'purple', bg: 'bg-purple-500' },
                          { name: 'rose', bg: 'bg-rose-500' },
                          { name: 'cyan', bg: 'bg-cyan-500' },
                          { name: 'orange', bg: 'bg-orange-500' },
                          { name: 'indigo', bg: 'bg-indigo-500' },
                          { name: 'teal', bg: 'bg-teal-500' },
                        ].map(color => (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => {
                              onSetDepartmentColor?.(deptName, color.name);
                              setSubColorPickerDept(null);
                            }}
                            className={`w-7 h-7 rounded-lg ${color.bg} transition-all ${departmentColors[deptName] === color.name ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'}`}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Department People Container */}
                <div className="relative rounded-[2rem] px-6 py-8 shrink-0">
                  <div 
                    className="absolute inset-0 bg-white/40 border border-slate-200/60 rounded-[2rem] shadow-sm"
                    style={{ zIndex: -1 }}
                  ></div>
                  <div className="flex gap-6 items-start relative">
                    {/* Teams within this department */}
                    {Object.entries(teamMembers).map(([teamName, members]) => {
                      const teamColor = members.find(m => m.teamColor)?.teamColor;
                      return (
                        <TeamGroup 
                          key={teamName}
                          teamName={teamName}
                          members={members}
                          people={people}
                          onPersonClick={onPersonClick}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          onDrop={onDrop}
                          draggedId={draggedId}
                          getSecondaryManager={getSecondaryManager}
                          onDeletePerson={onDeletePerson}
                          teamColor={teamColor}
                          departmentColors={departmentColors}
                          locationColors={locationColors}
                          onAddDirectReport={onAddDirectReport}
                          onReorderPerson={onReorderPerson}
                          onSetDepartmentColor={onSetDepartmentColor}
                          cardSettings={cardSettings}
                          level={level + 1}
                        />
                      );
                    })}
                    {/* Non-team members within this department */}
                    {nonTeamMembers.map(member => (
                      <HierarchyTree 
                        key={member.id}
                        root={member}
                        people={people}
                        onPersonClick={onPersonClick}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDrop={onDrop}
                        draggedId={draggedId}
                        getSecondaryManager={getSecondaryManager}
                        onEdit={() => onPersonClick(member)}
                        onDelete={() => onDeletePerson?.(member.id)}
                        onDeletePerson={onDeletePerson}
                        departmentColors={departmentColors}
                        locationColors={locationColors}
                        onAddDirectReport={onAddDirectReport}
                        onReorderPerson={onReorderPerson}
                        onSetDepartmentColor={onSetDepartmentColor}
                        cardSettings={cardSettings}
                        level={level + 1}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* No department variation: render teams and others flat */
            <>
              {Object.entries(teams).map(([teamName, members]) => {
                const teamMembers = members as Person[];
                const teamColor = teamMembers.find(m => m.teamColor)?.teamColor;
                return (
                  <TeamGroup 
                    key={teamName}
                    teamName={teamName}
                    members={teamMembers}
                    people={people}
                    onPersonClick={onPersonClick}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop}
                    draggedId={draggedId}
                    getSecondaryManager={getSecondaryManager}
                    onDeletePerson={onDeletePerson}
                    teamColor={teamColor}
                    departmentColors={departmentColors}
                    locationColors={locationColors}
                    onAddDirectReport={onAddDirectReport}
                    onReorderPerson={onReorderPerson}
                    onSetDepartmentColor={onSetDepartmentColor}
                    cardSettings={cardSettings}
                    level={level + 1}
                  />
                );
              })}
              {others.length > 0 && (
                <div className="flex gap-6 items-start">
                  {others.map(member => (
                    <HierarchyTree 
                      key={member.id}
                      root={member}
                      people={people}
                      onPersonClick={onPersonClick}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDrop={onDrop}
                      draggedId={draggedId}
                      getSecondaryManager={getSecondaryManager}
                      onEdit={() => onPersonClick(member)}
                      onDelete={() => onDeletePerson?.(member.id)}
                      onDeletePerson={onDeletePerson}
                      departmentColors={departmentColors}
                      locationColors={locationColors}
                      onAddDirectReport={onAddDirectReport}
                      onReorderPerson={onReorderPerson}
                      onSetDepartmentColor={onSetDepartmentColor}
                      cardSettings={cardSettings}
                      level={level + 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      )}
    </div>
  );
};

// --- TEAM GROUP COMPONENT ---
const TeamGroup: React.FC<{
  teamName: string;
  members: Person[];
  people: Person[];
  onPersonClick: (p: Person) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd?: () => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  draggedId: string | null;
  getSecondaryManager: (p: Person) => Person | undefined;
  onDeletePerson?: (id: string) => void;
  includeRootAsHead?: boolean;
  rootPerson?: Person;
  onRootEdit?: () => void;
  onRootDelete?: () => void;
  teamColor?: string;
  otherTeams?: [string, Person[]][];
  others?: Person[];
  departmentColors?: Record<string, string>;
  locationColors?: Record<string, string>;
  onAddDirectReport?: (managerId: string, department?: string, location?: string) => void;
  onReorderPerson?: (personId: string, direction: 'left' | 'right') => void;
  onSetDepartmentColor?: (dept: string, color: string) => void;
  cardSettings?: CardSettings;
  level?: number;
}> = ({ teamName, members, people, onPersonClick, onDragStart, onDragEnd, onDrop, draggedId, getSecondaryManager, onDeletePerson, includeRootAsHead, rootPerson, onRootEdit, onRootDelete, teamColor, otherTeams, others, departmentColors = {}, locationColors = {}, onAddDirectReport, onReorderPerson, onSetDepartmentColor, cardSettings, level = 0 }) => {
  
  // Sort: by sortOrder first, then Team Leader, then name (handled by sortBySortOrder)
  const sortedMembers = useMemo(() => {
    if (includeRootAsHead && rootPerson) {
      const withoutRoot = members.filter(m => m.id !== rootPerson.id);
      return [...withoutRoot].sort(sortBySortOrder);
    }
    return [...members].sort(sortBySortOrder);
  }, [members, includeRootAsHead, rootPerson]);

  // Color presets for teams - using inline rgba for backgrounds to ensure export compatibility
  const colorStyles: Record<string, { bgColor: string; borderColor: string; label: string; labelBorder: string }> = {
    indigo: { bgColor: 'rgba(238, 242, 255, 0.5)', borderColor: '#c7d2fe', label: 'bg-indigo-100 text-indigo-700', labelBorder: 'border-indigo-200' },
    emerald: { bgColor: 'rgba(236, 253, 245, 0.5)', borderColor: '#a7f3d0', label: 'bg-emerald-100 text-emerald-700', labelBorder: 'border-emerald-200' },
    amber: { bgColor: 'rgba(255, 251, 235, 0.5)', borderColor: '#fde68a', label: 'bg-amber-100 text-amber-700', labelBorder: 'border-amber-200' },
    rose: { bgColor: 'rgba(255, 241, 242, 0.5)', borderColor: '#fecdd3', label: 'bg-rose-100 text-rose-700', labelBorder: 'border-rose-200' },
    cyan: { bgColor: 'rgba(236, 254, 255, 0.5)', borderColor: '#a5f3fc', label: 'bg-cyan-100 text-cyan-700', labelBorder: 'border-cyan-200' },
    purple: { bgColor: 'rgba(250, 245, 255, 0.5)', borderColor: '#e9d5ff', label: 'bg-purple-100 text-purple-700', labelBorder: 'border-purple-200' },
    blue: { bgColor: 'rgba(239, 246, 255, 0.5)', borderColor: '#bfdbfe', label: 'bg-blue-100 text-blue-700', labelBorder: 'border-blue-200' },
    orange: { bgColor: 'rgba(255, 247, 237, 0.5)', borderColor: '#fed7aa', label: 'bg-orange-100 text-orange-700', labelBorder: 'border-orange-200' },
  };
  const colors = colorStyles[teamColor || 'indigo'] || colorStyles.indigo;

  return (
    <div className="flex flex-col items-center relative">
        {/* Background container - negative z-index so lines appear above it */}
        <div 
            data-team-bg="true"
            className="border border-dashed rounded-2xl absolute inset-0"
            style={{ zIndex: -1, backgroundColor: colors.bgColor, borderColor: colors.borderColor }}
        ></div>
        {/* Team Label - z-index above lines */}
        <div 
            className={`px-3 py-1 ${colors.label} border ${colors.labelBorder} rounded-md text-[10px] font-bold uppercase tracking-wide shadow-sm whitespace-nowrap`}
            style={{ zIndex: 10, position: 'relative', marginTop: '-12px', marginBottom: '8px' }}
        >
            {teamName}
        </div>
        {/* Content container - z-index above lines */}
        <div className="p-4 pt-0 relative flex flex-col gap-8 items-center" style={{ zIndex: 10 }}>

            {/* If root is included as head, render it first */}
            {includeRootAsHead && rootPerson && (
              <div className="card-node shrink-0 relative group/add" style={{ zIndex: 10 }}>
                <Card 
                  person={rootPerson} 
                  onClick={onPersonClick} 
                  isDeptHead={['Sales','Engineering','Marketing','HR','Finance','Operations','Executive'].includes(rootPerson.department)}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDrop={onDrop}
                  isDragging={draggedId === rootPerson.id}
                  secondaryManager={getSecondaryManager(rootPerson)}
                  supportedPeople={people.filter(p => rootPerson.supportedIds?.includes(p.id))}
                  onEdit={onRootEdit}
                  onDelete={onRootDelete}
                  deptColorOverride={departmentColors[rootPerson.department]}
                  locationColorOverride={locationColors[rootPerson.location || '']}
                  cardSettings={cardSettings}
                />
                {/* Add Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddDirectReport?.(rootPerson.id, rootPerson.department, rootPerson.location);
                    }}
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 hover:scale-110 transition-all z-50 opacity-0 group-hover/add:opacity-100"
                    title="Add Direct Report"
                >
                    <Plus size={14} />
                </button>
              </div>
            )}

            <div className="flex gap-6 items-start">
                {sortedMembers.map(member => (
                    <HierarchyTree 
                        key={member.id}
                        root={member}
                        people={people}
                        onPersonClick={onPersonClick}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDrop={onDrop}
                        draggedId={draggedId}
                        getSecondaryManager={getSecondaryManager}
                        onEdit={() => onPersonClick(member)}
                        onDelete={() => onDeletePerson?.(member.id)}
                        onDeletePerson={onDeletePerson}
                        isInsideParentTeam={true}
                        departmentColors={departmentColors}
                        locationColors={locationColors}
                        onAddDirectReport={onAddDirectReport}
                        onReorderPerson={onReorderPerson}
                        onSetDepartmentColor={onSetDepartmentColor}
                        cardSettings={cardSettings}
                        level={includeRootAsHead ? level + 1 : level}
                    />
                ))}
            </div>

            {/* Render other teams if this is wrapping root */}
            {otherTeams && otherTeams.length > 0 && (
              <div className="flex gap-6 items-start">
                {otherTeams.map(([otherTeamName, otherMembers]) => {
                  const otherColor = otherMembers.find(m => m.teamColor)?.teamColor;
                  return (
                    <TeamGroup 
                      key={otherTeamName}
                      teamName={otherTeamName}
                      members={otherMembers}
                      people={people}
                      onPersonClick={onPersonClick}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDrop={onDrop}
                      draggedId={draggedId}
                      getSecondaryManager={getSecondaryManager}
                      onDeletePerson={onDeletePerson}
                      teamColor={otherColor}
                      departmentColors={departmentColors}
                      locationColors={locationColors}
                      onAddDirectReport={onAddDirectReport}
                      onReorderPerson={onReorderPerson}
                      onSetDepartmentColor={onSetDepartmentColor}
                      cardSettings={cardSettings}
                      level={includeRootAsHead ? level + 1 : level}
                    />
                  );
                })}
              </div>
            )}

            {/* Render others if this is wrapping root */}
            {others && others.length > 0 && (
              <div className="flex gap-6 items-start">
                {others.map(member => (
                  <HierarchyTree 
                    key={member.id}
                    root={member}
                    people={people}
                    onPersonClick={onPersonClick}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop}
                    draggedId={draggedId}
                    getSecondaryManager={getSecondaryManager}
                    onEdit={() => onPersonClick(member)}
                    onDelete={() => onDeletePerson?.(member.id)}
                    onDeletePerson={onDeletePerson}
                    departmentColors={departmentColors}
                    locationColors={locationColors}
                    onAddDirectReport={onAddDirectReport}
                    onReorderPerson={onReorderPerson}
                    onSetDepartmentColor={onSetDepartmentColor}
                  />
                ))}
              </div>
            )}
        </div>
    </div>
  );
};

