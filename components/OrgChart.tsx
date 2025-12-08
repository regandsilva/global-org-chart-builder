import React, { useMemo, useState, useRef } from 'react';
import { Person, LineSettings, CardSettings } from '../types';
import { Card } from './Card';
import { Lines } from './Lines';
import { DEPARTMENTS, LOCATIONS } from '../constants';
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Search, X, Trash2, Users, Crown, Link, User, Building, MapPin, Mail, Phone, ChevronDown, Plus, Check, Settings, Sliders, Palette } from 'lucide-react';

interface OrgChartProps {
  people: Person[];
  lineSettings?: LineSettings;
  onUpdateLineSettings?: (settings: LineSettings) => void;
  cardSettings?: CardSettings;
  onUpdateCardSettings?: (settings: CardSettings) => void;
  onMovePerson: (draggedId: string, targetId: string) => void;
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

export const OrgChart: React.FC<OrgChartProps> = ({ people, lineSettings, onUpdateLineSettings, cardSettings, onUpdateCardSettings, onMovePerson, onUpdatePerson, onDeletePerson, onAddPerson, departments: propDepartments, locations: propLocations, jobTitles: propJobTitles, onAddDepartment, onAddLocation, onAddJobTitle, onDeleteDepartment, onDeleteLocation, onDeleteJobTitle, showAddModal, onCloseAddModal, onOpenAddModal, departmentColors = {}, onSetDepartmentColor, locationColors = {}, onSetLocationColor }) => {
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  // Line Settings Modal
  const [showLineSettings, setShowLineSettings] = useState(false);
  const [showCardSettings, setShowCardSettings] = useState(false);
  
  // DnD State for People
  const [draggedPersonId, setDraggedPersonId] = useState<string | null>(null);

  // Edit Modal State
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // Department Badge Color Picker State
  const [colorPickerDept, setColorPickerDept] = useState<string | null>(null);

  // --- CANVAS CONTROLS ---
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      setScale(s => {
        const newScale = s + delta;
        // Clamp to limits
        return Math.min(Math.max(MIN_ZOOM, newScale), MAX_ZOOM);
      });
    } else {
      setPosition(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // Zoom helper functions
  const zoomIn = () => setScale(s => Math.min(s + ZOOM_STEP, MAX_ZOOM));
  const zoomOut = () => setScale(s => Math.max(s - ZOOM_STEP, MIN_ZOOM));
  const resetZoom = () => { setScale(0.8); setPosition({ x: 0, y: 0 }); };
  const zoomPercent = Math.round(scale * 100);

  const handleFitToScreen = () => {
    const content = document.getElementById('chart-content');
    const container = content?.parentElement?.parentElement;
    if (!content || !container) return;

    const contentRect = content.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Reset scale first to get true dimensions
    // Actually, we can just calculate based on current scale
    // But simpler to just center it.
    
    // Fit to screen with reasonable scale
    const fitScale = Math.min(
      (containerRect.width * 0.9) / (contentRect.width / scale),
      (containerRect.height * 0.9) / (contentRect.height / scale),
      MAX_ZOOM
    );
    setScale(Math.max(MIN_ZOOM, Math.min(fitScale, 0.8)));
    setPosition({ x: 0, y: 0 });
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

  // --- DATA PREP ---
  // Root people (executives)
  const rootPeople = useMemo(() => {
    return people.filter(p => !p.managerId || !people.find(m => m.id === p.managerId));
  }, [people]);

  const getDirectReports = (managerId: string) => people.filter(p => p.managerId === managerId);

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
        isVacancy: newPerson.isVacancy
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
                          <div className="relative flex-1">
                            <select 
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white appearance-none cursor-pointer transition-all"
                              value={editingPerson.location || ''}
                              onChange={e => setEditingPerson({...editingPerson, location: e.target.value})}
                            >
                              {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
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
                          value={editingPerson.tier || ''}
                          onChange={e => setEditingPerson({...editingPerson, tier: e.target.value ? parseInt(e.target.value) : undefined})}
                          placeholder="Auto"
                        />
                        <p className="text-[10px] text-slate-400 flex-1">
                          Force this person to appear at a specific level (0 = Top). Leave empty for automatic.
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

      {/* Card Settings Modal */}
      {showCardSettings && cardSettings && onUpdateCardSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowCardSettings(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-800 to-slate-700 shrink-0">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Palette size={18} /> Card Settings
              </h3>
              <button onClick={() => setShowCardSettings(false)} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row-reverse flex-1 overflow-hidden">
              {/* Live Preview - Sticky on Desktop */}
              <div className="w-full md:w-[400px] bg-slate-50 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-l border-slate-200 shrink-0 overflow-y-auto">
                <p className="text-xs font-medium text-slate-500 mb-8 uppercase tracking-wider">Live Preview</p>
                <div 
                  className={`
                    relative flex flex-col border overflow-hidden bg-white transition-all
                    ${cardSettings.useDeptColorForBorder ? 'border-blue-200' : ''}
                    ${cardSettings.shadow === 'none' ? '' : cardSettings.shadow === 'sm' ? 'shadow-sm' : cardSettings.shadow === 'md' ? 'shadow-md' : cardSettings.shadow === 'lg' ? 'shadow-lg' : 'shadow-xl'}
                  `}
                  style={{
                    width: `${Math.min(cardSettings.width, 260)}px`,
                    borderRadius: `${cardSettings.borderRadius}px`,
                    borderWidth: `${cardSettings.borderWidth || 1}px`,
                    borderColor: cardSettings.useDeptColorForBorder ? undefined : (cardSettings.borderColor || '#e2e8f0'),
                    backgroundColor: cardSettings.cardBgColor,
                    fontFamily: cardSettings.fontFamily === 'serif' ? 'Georgia, serif' : cardSettings.fontFamily === 'mono' ? 'ui-monospace, monospace' : 'inherit'
                  }}
                >
                  {/* Preview Header */}
                  <div 
                    className={`relative ${cardSettings.padding === 'compact' ? 'p-2' : cardSettings.padding === 'spacious' ? 'p-5' : 'p-4'} ${cardSettings.useDeptColorForHeader ? 'bg-blue-600 text-white' : ''} ${cardSettings.headerAlignment === 'left' ? 'text-left' : cardSettings.headerAlignment === 'right' ? 'text-right' : 'text-center'} ${cardSettings.showGradientHeader && !cardSettings.useDeptColorForHeader ? 'bg-gradient-to-r from-slate-800 to-slate-600' : ''}`}
                    style={{
                      backgroundColor: cardSettings.useDeptColorForHeader ? undefined : cardSettings.headerBgColor,
                      color: cardSettings.useDeptColorForHeader ? undefined : cardSettings.headerTextColor,
                    }}
                  >
                    <h3 className={`font-bold truncate leading-tight ${cardSettings.nameSize === 'small' ? 'text-sm' : cardSettings.nameSize === 'large' ? 'text-xl' : 'text-lg'}`}>
                      John Smith
                    </h3>
                    {cardSettings.showTitle && (
                      <p className={`truncate mt-1 opacity-80 ${cardSettings.titleSize === 'small' ? 'text-xs' : cardSettings.titleSize === 'large' ? 'text-base' : 'text-sm'}`}>Software Engineer</p>
                    )}
                  </div>
                  
                  {/* Preview Body - New side-by-side layout */}
                  <div className={`${cardSettings.padding === 'compact' ? 'p-2' : cardSettings.padding === 'spacious' ? 'p-5' : 'p-4'} flex ${cardSettings.avatarPosition === 'left' ? 'flex-row' : 'flex-row-reverse'} items-center gap-3`} style={{ color: cardSettings.cardTextColor }}>
                    {cardSettings.showAvatar && (
                      <div className={`${cardSettings.avatarShape === 'square' ? 'rounded-none' : cardSettings.avatarShape === 'rounded' ? 'rounded-lg' : 'rounded-full'} flex items-center justify-center font-bold shrink-0 bg-blue-100 text-blue-600 shadow-sm border-2 border-white ${cardSettings.avatarSize === 'small' ? 'w-8 h-8 text-xs' : cardSettings.avatarSize === 'large' ? 'w-14 h-14 text-base' : 'w-12 h-12 text-sm'}`}>
                        JS
                      </div>
                    )}
                    <div className={`flex flex-col ${cardSettings.bodyAlignment === 'left' ? 'items-start' : cardSettings.bodyAlignment === 'right' ? 'items-end' : 'items-center'} flex-1 min-w-0 gap-1.5`}>
                      {cardSettings.showDepartment && (
                        <div className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold truncate max-w-full ${cardSettings.useDeptColorForBadge ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          Engineering
                        </div>
                      )}
                      {cardSettings.showLocation && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 truncate max-w-full">
                          <MapPin size={10} className="text-slate-400 shrink-0" />
                          <span>London, UK</span>
                        </div>
                      )}
                      {cardSettings.showEmail && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 truncate max-w-full">
                          <Mail size={10} className="text-slate-400 shrink-0" />
                          <span>john@example.com</span>
                        </div>
                      )}
                      {cardSettings.showPhone && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 truncate max-w-full">
                          <Phone size={10} className="text-slate-400 shrink-0" />
                          <span>+1 234 567 890</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Settings Panel - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  
                {/* Quick Presets */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Presets</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <button 
                      onClick={() => onUpdateCardSettings({
                        ...cardSettings,
                        headerBgColor: '#1e293b', headerTextColor: '#ffffff', cardBgColor: '#ffffff', cardTextColor: '#1e293b',
                        borderRadius: 12, shadow: 'md', useDeptColorForHeader: false, useDeptColorForBadge: true
                      })}
                      className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-center"
                    >
                      <div className="w-full h-5 rounded bg-slate-800 mb-1"></div>
                      <span className="text-[10px] font-medium text-slate-600">Default</span>
                    </button>
                    <button 
                      onClick={() => onUpdateCardSettings({
                        ...cardSettings,
                        headerBgColor: '#ffffff', headerTextColor: '#1e293b', cardBgColor: '#ffffff', cardTextColor: '#1e293b',
                        borderRadius: 8, shadow: 'sm', useDeptColorForHeader: false, useDeptColorForBadge: true
                      })}
                      className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-center"
                    >
                      <div className="w-full h-5 rounded bg-white border border-slate-200 mb-1"></div>
                      <span className="text-[10px] font-medium text-slate-600">Minimal</span>
                    </button>
                    <button 
                      onClick={() => onUpdateCardSettings({
                        ...cardSettings,
                        useDeptColorForHeader: true, useDeptColorForBadge: true, useDeptColorForBorder: true,
                        borderRadius: 16, shadow: 'lg'
                      })}
                      className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-center"
                    >
                      <div className="w-full h-5 rounded bg-gradient-to-r from-blue-500 to-purple-500 mb-1"></div>
                      <span className="text-[10px] font-medium text-slate-600">Colorful</span>
                    </button>
                    <button 
                      onClick={() => onUpdateCardSettings({
                        ...cardSettings,
                        headerBgColor: '#18181b', headerTextColor: '#fafafa', cardBgColor: '#27272a', cardTextColor: '#fafafa',
                        borderRadius: 4, shadow: 'xl', useDeptColorForHeader: false, useDeptColorForBadge: false
                      })}
                      className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-center"
                    >
                      <div className="w-full h-5 rounded bg-zinc-800 mb-1"></div>
                      <span className="text-[10px] font-medium text-slate-600">Dark</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-100" />

                {/* Colors Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Colors</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Header Background</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={cardSettings.headerBgColor}
                            onChange={e => onUpdateCardSettings({...cardSettings, headerBgColor: e.target.value})}
                            className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-1"
                            disabled={cardSettings.useDeptColorForHeader}
                          />
                          <input 
                            type="text"
                            value={cardSettings.headerBgColor}
                            onChange={e => onUpdateCardSettings({...cardSettings, headerBgColor: e.target.value})}
                            className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                            disabled={cardSettings.useDeptColorForHeader}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Header Text</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={cardSettings.headerTextColor}
                            onChange={e => onUpdateCardSettings({...cardSettings, headerTextColor: e.target.value})}
                            className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-1"
                          />
                          <input 
                            type="text"
                            value={cardSettings.headerTextColor}
                            onChange={e => onUpdateCardSettings({...cardSettings, headerTextColor: e.target.value})}
                            className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Card Background</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={cardSettings.cardBgColor}
                            onChange={e => onUpdateCardSettings({...cardSettings, cardBgColor: e.target.value})}
                            className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-1"
                          />
                          <input 
                            type="text"
                            value={cardSettings.cardBgColor}
                            onChange={e => onUpdateCardSettings({...cardSettings, cardBgColor: e.target.value})}
                            className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Card Text</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={cardSettings.cardTextColor}
                            onChange={e => onUpdateCardSettings({...cardSettings, cardTextColor: e.target.value})}
                            className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-1"
                          />
                          <input 
                            type="text"
                            value={cardSettings.cardTextColor}
                            onChange={e => onUpdateCardSettings({...cardSettings, cardTextColor: e.target.value})}
                            className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Border Color</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={cardSettings.borderColor || '#e2e8f0'}
                            onChange={e => onUpdateCardSettings({...cardSettings, borderColor: e.target.value})}
                            className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-1"
                            disabled={cardSettings.useDeptColorForBorder}
                          />
                          <input 
                            type="text"
                            value={cardSettings.borderColor || '#e2e8f0'}
                            onChange={e => onUpdateCardSettings({...cardSettings, borderColor: e.target.value})}
                            className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                            disabled={cardSettings.useDeptColorForBorder}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Department Color Toggles */}
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-slate-500 mb-2">Department Color Overrides</p>
                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white transition-colors">
                        <input 
                          type="checkbox"
                          checked={cardSettings.useDeptColorForHeader}
                          onChange={e => onUpdateCardSettings({...cardSettings, useDeptColorForHeader: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-xs font-medium text-slate-700">Use Department Color for Header</span>
                          <p className="text-[10px] text-slate-400">Header will match department theme color</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white transition-colors">
                        <input 
                          type="checkbox"
                          checked={cardSettings.useDeptColorForBadge}
                          onChange={e => onUpdateCardSettings({...cardSettings, useDeptColorForBadge: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-xs font-medium text-slate-700">Use Department Color for Badge</span>
                          <p className="text-[10px] text-slate-400">Department badge will be colorful</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white transition-colors">
                        <input 
                          type="checkbox"
                          checked={cardSettings.useDeptColorForBorder}
                          onChange={e => onUpdateCardSettings({...cardSettings, useDeptColorForBorder: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-xs font-medium text-slate-700">Use Department Color for Border</span>
                          <p className="text-[10px] text-slate-400">Subtle colored border around card</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Layout & Dimensions */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Layout & Dimensions</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Card Width</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="range" 
                            min="200" 
                            max="400" 
                            step="8"
                            value={cardSettings.width}
                            onChange={e => onUpdateCardSettings({...cardSettings, width: parseInt(e.target.value)})}
                            className="flex-1 accent-blue-600"
                          />
                          <span className="text-xs font-mono text-slate-500 w-12 text-right">{cardSettings.width}px</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Corner Radius</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="range" 
                            min="0" 
                            max="24" 
                            step="2"
                            value={cardSettings.borderRadius}
                            onChange={e => onUpdateCardSettings({...cardSettings, borderRadius: parseInt(e.target.value)})}
                            className="flex-1 accent-blue-600"
                          />
                          <span className="text-xs font-mono text-slate-500 w-12 text-right">{cardSettings.borderRadius}px</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Border Width</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="range" 
                            min="0" 
                            max="8" 
                            step="1"
                            value={cardSettings.borderWidth || 1}
                            onChange={e => onUpdateCardSettings({...cardSettings, borderWidth: parseInt(e.target.value)})}
                            className="flex-1 accent-blue-600"
                          />
                          <span className="text-xs font-mono text-slate-500 w-12 text-right">{cardSettings.borderWidth || 1}px</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Shadow</label>
                        <select 
                          value={cardSettings.shadow}
                          onChange={e => onUpdateCardSettings({...cardSettings, shadow: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="none">None</option>
                          <option value="sm">Small</option>
                          <option value="md">Medium</option>
                          <option value="lg">Large</option>
                          <option value="xl">Extra Large</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Padding</label>
                        <select 
                          value={cardSettings.padding}
                          onChange={e => onUpdateCardSettings({...cardSettings, padding: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="compact">Compact</option>
                          <option value="normal">Normal</option>
                          <option value="spacious">Spacious</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Font Style</label>
                        <select 
                          value={cardSettings.fontFamily}
                          onChange={e => onUpdateCardSettings({...cardSettings, fontFamily: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="default">Default (Sans)</option>
                          <option value="serif">Serif</option>
                          <option value="mono">Monospace</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Avatar Size</label>
                        <select 
                          value={cardSettings.avatarSize}
                          onChange={e => onUpdateCardSettings({...cardSettings, avatarSize: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Avatar Shape</label>
                        <select 
                          value={cardSettings.avatarShape || 'circle'}
                          onChange={e => onUpdateCardSettings({...cardSettings, avatarShape: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="circle">Circle</option>
                          <option value="rounded">Rounded</option>
                          <option value="square">Square</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Avatar Position</label>
                        <select 
                          value={cardSettings.avatarPosition}
                          onChange={e => onUpdateCardSettings({...cardSettings, avatarPosition: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="left">Left Side</option>
                          <option value="right">Right Side</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Header Alignment</label>
                        <select 
                          value={cardSettings.headerAlignment || 'center'}
                          onChange={e => onUpdateCardSettings({...cardSettings, headerAlignment: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Body Alignment</label>
                        <select 
                          value={cardSettings.bodyAlignment || 'left'}
                          onChange={e => onUpdateCardSettings({...cardSettings, bodyAlignment: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Name Size</label>
                        <select 
                          value={cardSettings.nameSize}
                          onChange={e => onUpdateCardSettings({...cardSettings, nameSize: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Title Size</label>
                        <select 
                          value={cardSettings.titleSize || 'small'}
                          onChange={e => onUpdateCardSettings({...cardSettings, titleSize: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Effects & Interactions */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Effects & Interactions</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Hover Effect</label>
                        <select 
                          value={cardSettings.hoverEffect || 'lift'}
                          onChange={e => onUpdateCardSettings({...cardSettings, hoverEffect: e.target.value as any})}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="lift">Lift</option>
                          <option value="glow">Glow</option>
                          <option value="scale">Scale</option>
                          <option value="none">None</option>
                        </select>
                      </div>

                      <div className="flex items-center pt-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={cardSettings.showGradientHeader || false}
                            onChange={e => onUpdateCardSettings({...cardSettings, showGradientHeader: e.target.checked})}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium text-slate-700">Gradient Header</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Visibility */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Show / Hide Elements</h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                        <input 
                          type="checkbox"
                          checked={cardSettings.showAvatar}
                          onChange={e => onUpdateCardSettings({...cardSettings, showAvatar: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-slate-700">Avatar / Photo</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                        <input 
                          type="checkbox"
                          checked={cardSettings.showTitle}
                          onChange={e => onUpdateCardSettings({...cardSettings, showTitle: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-slate-700">Job Title</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                        <input 
                          type="checkbox"
                          checked={cardSettings.showDepartment}
                          onChange={e => onUpdateCardSettings({...cardSettings, showDepartment: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-slate-700">Department Badge</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                        <input 
                          type="checkbox"
                          checked={cardSettings.showLocation}
                          onChange={e => onUpdateCardSettings({...cardSettings, showLocation: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-slate-700">Location</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                        <input 
                          type="checkbox"
                          checked={cardSettings.showEmail || false}
                          onChange={e => onUpdateCardSettings({...cardSettings, showEmail: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-slate-700">Email Address</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                        <input 
                          type="checkbox"
                          checked={cardSettings.showPhone || false}
                          onChange={e => onUpdateCardSettings({...cardSettings, showPhone: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-slate-700">Phone Number</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                        <input 
                          type="checkbox"
                          checked={cardSettings.showSecondaryManager !== false}
                          onChange={e => onUpdateCardSettings({...cardSettings, showSecondaryManager: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-slate-700">Secondary Manager</span>
                      </label>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Location Colors */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location Colors</h4>
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                      {allLocations.map(loc => (
                        <div key={loc} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-700">{loc}</span>
                            <div className="flex items-center gap-2">
                              <input 
                                type="color" 
                                value={locationColors[loc] || '#64748b'}
                                onChange={e => onSetLocationColor?.(loc, e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0.5"
                              />
                              <button 
                                onClick={() => onSetLocationColor?.(loc, '')}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Reset to default"
                              >
                                <RotateCcw size={12} />
                              </button>
                            </div>
                          </div>
                          
                          {/* Quick Color Palette */}
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              '#64748b', // Slate
                              '#ef4444', // Red
                              '#f97316', // Orange
                              '#f59e0b', // Amber
                              '#84cc16', // Lime
                              '#10b981', // Emerald
                              '#06b6d4', // Cyan
                              '#3b82f6', // Blue
                              '#6366f1', // Indigo
                              '#8b5cf6', // Violet
                              '#d946ef', // Fuchsia
                              '#f43f5e'  // Rose
                            ].map(color => (
                              <button
                                key={color}
                                onClick={() => onSetLocationColor?.(loc, color)}
                                className={`w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform ${locationColors[loc] === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      {allLocations.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-xs">
                          No locations found.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button 
                onClick={() => {
                  if (confirm('Reset all card settings to default values?')) {
                    onUpdateCardSettings({
                      headerBgColor: '#1e293b',
                      headerTextColor: '#ffffff',
                      cardBgColor: '#ffffff',
                      cardTextColor: '#1e293b',
                      borderRadius: 12,
                      shadow: 'md',
                      padding: 'normal',
                      showAvatar: true,
                      showDepartment: true,
                      showLocation: true,
                      showTitle: true,
                      width: 288,
                      useDeptColorForHeader: false,
                      useDeptColorForBadge: true,
                      useDeptColorForBorder: false,
                      avatarSize: 'medium',
                      avatarPosition: 'left',
                      avatarShape: 'circle',
                      headerAlignment: 'center',
                      bodyAlignment: 'left',
                      nameSize: 'medium',
                      titleSize: 'small',
                      fontFamily: 'default',
                      borderColor: '#e2e8f0',
                      borderWidth: 1,
                      showEmail: false,
                      showPhone: false,
                      showSecondaryManager: true,
                      hoverEffect: 'lift',
                      showGradientHeader: false
                    });
                  }
                }}
                className="px-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
              >
                <RotateCcw size={12} /> Reset
              </button>
              <button 
                onClick={() => setShowCardSettings(false)}
                className="px-5 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Line Settings Modal */}
      {showLineSettings && lineSettings && onUpdateLineSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowLineSettings(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Sliders size={18} /> Line Customization
              </h3>
              <button onClick={() => setShowLineSettings(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Primary Lines */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Primary Lines (Solid)</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600">Color</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={lineSettings.primaryColor}
                        onChange={e => onUpdateLineSettings({...lineSettings, primaryColor: e.target.value})}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                      />
                      <span className="text-xs text-slate-500 font-mono">{lineSettings.primaryColor}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600">Thickness: {lineSettings.primaryWidth}px</label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      step="0.5"
                      value={lineSettings.primaryWidth}
                      onChange={e => onUpdateLineSettings({...lineSettings, primaryWidth: parseFloat(e.target.value)})}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Secondary Lines */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Secondary Lines (Dotted)</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600">Use Random Colors</label>
                    <div 
                      className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${lineSettings.useRandomSecondaryColors ? 'bg-blue-600' : 'bg-slate-300'}`}
                      onClick={() => onUpdateLineSettings({...lineSettings, useRandomSecondaryColors: !lineSettings.useRandomSecondaryColors})}
                    >
                      <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${lineSettings.useRandomSecondaryColors ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  {!lineSettings.useRandomSecondaryColors && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">Base Color</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={lineSettings.secondaryColor}
                          onChange={e => onUpdateLineSettings({...lineSettings, secondaryColor: e.target.value})}
                          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="text-xs text-slate-500 font-mono">{lineSettings.secondaryColor}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">Style</label>
                      <select 
                        value={lineSettings.secondaryStyle}
                        onChange={e => onUpdateLineSettings({...lineSettings, secondaryStyle: e.target.value as any})}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="dotted">Dotted</option>
                        <option value="dashed">Dashed</option>
                        <option value="solid">Solid</option>
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">Thickness: {lineSettings.secondaryWidth}px</label>
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        step="0.5"
                        value={lineSettings.secondaryWidth}
                        onChange={e => onUpdateLineSettings({...lineSettings, secondaryWidth: parseFloat(e.target.value)})}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* General */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">General</h4>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Corner Radius: {lineSettings.cornerRadius}px</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="30" 
                    step="1"
                    value={lineSettings.cornerRadius}
                    onChange={e => onUpdateLineSettings({...lineSettings, cornerRadius: parseInt(e.target.value)})}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowLineSettings(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
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
                  <div className="relative">
                    <select 
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white appearance-none cursor-pointer transition-all"
                      value={newPerson.location || ''}
                      onChange={e => setNewPerson({...newPerson, location: e.target.value})}
                    >
                      {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
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
          onClick={() => setShowCardSettings(true)}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          title="Card Appearance"
        >
          <Palette size={20} />
        </button>
        <button 
          onClick={() => setShowLineSettings(true)}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          title="Line Settings"
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
        className="w-full h-full cursor-grab active:cursor-grabbing bg-dot-pattern"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div 
          className="origin-top-left transition-transform duration-300 ease-out"
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            minWidth: '100%',
            minHeight: '100%'
          }}
        >
          <div id="chart-content" className="inline-block min-w-max p-24 relative">
            
            {/* Lines Layer - z-index 5, above backgrounds (2), below cards (40+) */}
            <Lines people={people} deptHeads={deptHeads} scale={scale} settings={lineSettings} />

            <div className="flex flex-col items-center gap-20 relative">
              
              {/* Level 1: Executive */}
              {rootPeople.length > 0 ? (
                <div className="flex justify-center gap-16 shrink-0">
                  {rootPeople.map(person => (
                    <div key={person.id} className="card-node shrink-0 relative">
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
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-red-500 font-bold p-10 bg-white rounded shadow">
                  No root node found.
                </div>
              )}

              {/* Level 2: Departments */}
              <div className="flex gap-24 items-start shrink-0">
                {allDeptNames.map(deptName => {
                  const heads = departments[deptName];
                  if (!heads || heads.length === 0) return null;

                  return (
                    <div key={deptName} className="flex flex-col items-center shrink-0">
                       <div className="relative bg-white/40 border border-slate-200/60 rounded-[2rem] px-8 py-12 shadow-sm hover:shadow-md transition-shadow shrink-0" style={{ zIndex: 1 }}>
                          
                          {/* Department Badge - Clickable */}
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2" style={{ zIndex: 110 }}>
                            <button
                              id={`dept-badge-${deptName}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setColorPickerDept(colorPickerDept === deptName ? null : deptName);
                              }}
                              className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm border-2 border-white cursor-pointer hover:scale-105 transition-transform ${getDeptBadgeClasses(deptName)}`}
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

                          <div className="flex gap-16 shrink-0" style={{ zIndex: 60 }}>
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
  cardSettings?: CardSettings;
  level?: number;
}

const HierarchyTree: React.FC<TreeProps> = ({ root, people, onPersonClick, onDragStart, onDragEnd, onDrop, draggedId, getSecondaryManager, onEdit, onDelete, onDeletePerson, isInsideParentTeam = false, departmentColors = {}, locationColors = {}, onAddDirectReport, cardSettings, level = 0 }) => {
  
  // Find direct reports
  const directReports = useMemo(() => {
    return people.filter(p => p.managerId === root.id);
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

  const hasChildren = directReports.length > 0;

  // Calculate tier offset (push down)
  // Assuming ~200px per level. If tier is set and greater than current level, add margin.
  const tierOffset = (root.tier && root.tier > level) ? (root.tier - level) * 200 : 0;

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
      <div style={{ marginTop: tierOffset }}>
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
          cardSettings={cardSettings}
          level={level}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center" style={{ marginTop: tierOffset }}>
      {/* The Manager Card */}
      <div className="card-node shrink-0 mb-12 relative group/add">
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
      </div>

      {/* Children Container */}
      {hasChildren && (
        <div className="flex items-start gap-8 relative">
          
          {/* Render Named Teams - Always show team grouping background */}
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
                  cardSettings={cardSettings}
                  level={level + 1}
               />
             );
          })}

          {/* Render Others (No Team, No Location Grouping) */}
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
                     cardSettings={cardSettings}
                     level={level + 1}
                   />
                ))}
             </div>
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
  cardSettings?: CardSettings;
  level?: number;
}> = ({ teamName, members, people, onPersonClick, onDragStart, onDragEnd, onDrop, draggedId, getSecondaryManager, onDeletePerson, includeRootAsHead, rootPerson, onRootEdit, onRootDelete, teamColor, otherTeams, others, departmentColors = {}, locationColors = {}, onAddDirectReport, cardSettings, level = 0 }) => {
  
  // Sort: Team Leader first, then root if included
  const sortedMembers = useMemo(() => {
    if (includeRootAsHead && rootPerson) {
      // Root is displayed separately at top, filter out from members
      const withoutRoot = members.filter(m => m.id !== rootPerson.id);
      return [...withoutRoot].sort((a, b) => (b.isTeamLead ? 1 : 0) - (a.isTeamLead ? 1 : 0));
    }
    return [...members].sort((a, b) => (b.isTeamLead ? 1 : 0) - (a.isTeamLead ? 1 : 0));
  }, [members, includeRootAsHead, rootPerson]);

  // Color presets for teams
  const colorStyles: Record<string, { bg: string; border: string; label: string; labelBorder: string }> = {
    indigo: { bg: 'bg-indigo-50/50', border: 'border-indigo-200', label: 'bg-indigo-100 text-indigo-700', labelBorder: 'border-indigo-200' },
    emerald: { bg: 'bg-emerald-50/50', border: 'border-emerald-200', label: 'bg-emerald-100 text-emerald-700', labelBorder: 'border-emerald-200' },
    amber: { bg: 'bg-amber-50/50', border: 'border-amber-200', label: 'bg-amber-100 text-amber-700', labelBorder: 'border-amber-200' },
    rose: { bg: 'bg-rose-50/50', border: 'border-rose-200', label: 'bg-rose-100 text-rose-700', labelBorder: 'border-rose-200' },
    cyan: { bg: 'bg-cyan-50/50', border: 'border-cyan-200', label: 'bg-cyan-100 text-cyan-700', labelBorder: 'border-cyan-200' },
    purple: { bg: 'bg-purple-50/50', border: 'border-purple-200', label: 'bg-purple-100 text-purple-700', labelBorder: 'border-purple-200' },
    blue: { bg: 'bg-blue-50/50', border: 'border-blue-200', label: 'bg-blue-100 text-blue-700', labelBorder: 'border-blue-200' },
    orange: { bg: 'bg-orange-50/50', border: 'border-orange-200', label: 'bg-orange-100 text-orange-700', labelBorder: 'border-orange-200' },
  };
  const colors = colorStyles[teamColor || 'indigo'] || colorStyles.indigo;

  return (
    <div className="flex flex-col items-center relative">
        {/* Background container - z-index -10, lines (-5) appear above it */}
        <div 
            className={`${colors.bg} border border-dashed ${colors.border} rounded-2xl absolute inset-0`}
            style={{ zIndex: -10 }}
        ></div>
        {/* Team Label - z-index 100, above everything */}
        <div 
            className={`px-3 py-1 ${colors.label} border ${colors.labelBorder} rounded-md text-[10px] font-bold uppercase tracking-wide shadow-sm whitespace-nowrap`}
            style={{ zIndex: 100, position: 'relative', marginTop: '-12px', marginBottom: '8px' }}
        >
            {teamName}
        </div>
        {/* Content container */}
        <div className="p-4 pt-0 flex flex-col gap-8 items-center relative">

            {/* If root is included as head, render it first */}
            {includeRootAsHead && rootPerson && (
              <div className="card-node shrink-0 relative group/add">
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
                  />
                ))}
              </div>
            )}
        </div>
    </div>
  );
};

