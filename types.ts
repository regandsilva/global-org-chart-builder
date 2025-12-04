export enum Country {
  UK = 'UK',
  HK = 'Hong Kong',
  CN = 'China'
}

export interface Person {
  id: string;
  name: string;
  title: string;
  department: string;
  location: Country | string;
  managerId?: string | null;
  secondaryManagerIds?: string[]; // New field for dotted-line reporting
  photoUrl?: string;
  teamName?: string; // New field for sub-team grouping
  isTeamLead?: boolean; // New field to designate team leaders
  teamColor?: string; // Custom color for team grouping background
  deptColor?: string; // Custom color for department badge
  email?: string;
  phone?: string;
  isVacancy?: boolean; // New field for future roles/vacancies
}

export interface ChartData {
  people: Person[];
}

export interface LineSettings {
  primaryColor: string;
  primaryWidth: number;
  secondaryWidth: number;
  secondaryStyle: 'dotted' | 'dashed' | 'solid';
  cornerRadius: number;
  useRandomSecondaryColors: boolean;
  secondaryColor: string; // Fallback/Base color if not random
}

export interface CardSettings {
  // ═══════════════════════════════════════
  // THEME & COLORS
  // ═══════════════════════════════════════
  headerBgColor: string;
  headerTextColor: string;
  cardBgColor: string;
  cardTextColor: string;
  borderColor: string;
  
  // Department Color Options
  useDeptColorForHeader: boolean;
  useDeptColorForBadge: boolean;
  useDeptColorForBorder: boolean;
  
  // ═══════════════════════════════════════
  // DIMENSIONS & SHAPE
  // ═══════════════════════════════════════
  width: number;
  borderRadius: number;
  borderWidth: number;
  shadow: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  padding: 'compact' | 'normal' | 'spacious';
  
  // ═══════════════════════════════════════
  // HEADER SECTION
  // ═══════════════════════════════════════
  headerAlignment: 'left' | 'center' | 'right';
  nameSize: 'small' | 'medium' | 'large';
  titleSize: 'small' | 'medium' | 'large';
  showTitle: boolean;
  
  // ═══════════════════════════════════════
  // BODY SECTION
  // ═══════════════════════════════════════
  bodyAlignment: 'left' | 'center' | 'right';
  showAvatar: boolean;
  avatarSize: 'small' | 'medium' | 'large';
  avatarPosition: 'left' | 'right';
  avatarShape: 'circle' | 'rounded' | 'square';
  showDepartment: boolean;
  showLocation: boolean;
  
  // ═══════════════════════════════════════
  // ADDITIONAL INFO (New Section)
  // ═══════════════════════════════════════
  showEmail: boolean;
  showPhone: boolean;
  showSecondaryManager: boolean;
  
  // ═══════════════════════════════════════
  // TYPOGRAPHY
  // ═══════════════════════════════════════
  fontFamily: 'default' | 'serif' | 'mono';
  
  // ═══════════════════════════════════════
  // EFFECTS & INTERACTIONS
  // ═══════════════════════════════════════
  hoverEffect: 'lift' | 'glow' | 'scale' | 'none';
  showGradientHeader: boolean;
}

export type LineCoords = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};