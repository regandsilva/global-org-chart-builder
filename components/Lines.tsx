import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Person, LineSettings } from '../types';

interface LinesProps {
  people: Person[];
  deptHeads?: Person[];
  scale: number;
  settings?: LineSettings;
}

interface NodePosition {
  id: string;
  centerX: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface PathData {
  key: string;
  d: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity?: number;
}

export const Lines: React.FC<LinesProps> = ({ people, deptHeads = [], scale, settings }) => {
  const [pathsData, setPathsData] = useState<PathData[]>([]);
  const prevScaleRef = useRef(scale);
  const animationFrameRef = useRef<number | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const positionCacheRef = useRef<Map<string, NodePosition>>(new Map());

  // Default settings if not provided
  const primaryColor = settings?.primaryColor || '#94a3b8';
  const primaryWidth = settings?.primaryWidth || 2;
  const secondaryWidth = settings?.secondaryWidth || 2;
  const secondaryStyle = settings?.secondaryStyle || 'dotted';
  const cornerRadius = settings?.cornerRadius ?? 10;
  const useRandomSecondaryColors = settings?.useRandomSecondaryColors ?? true;
  const secondaryBaseColor = settings?.secondaryColor || '#f59e0b';

  // Memoize dept head IDs for quick lookup
  const deptHeadIds = useMemo(() => new Set(deptHeads.map(h => h.id)), [deptHeads]);

  // Memoize connections by manager
  const connectionsByManager = useMemo(() => {
    const connections: Record<string, string[]> = {};
    people.forEach(p => {
      if (p.managerId) {
        if (!connections[p.managerId]) connections[p.managerId] = [];
        connections[p.managerId].push(p.id);
      }
    });
    return connections;
  }, [people]);

  // Get node position with caching
  const getNodePosition = useCallback((nodeId: string, containerRect: DOMRect, forceRefresh = false): NodePosition | null => {
    const cacheKey = `${nodeId}-${scale}`;
    
    if (!forceRefresh && positionCacheRef.current.has(cacheKey)) {
      return positionCacheRef.current.get(cacheKey)!;
    }

    const node = document.getElementById(`node-${nodeId}`);
    if (!node) return null;

    const rect = node.getBoundingClientRect();
    const position: NodePosition = {
      id: nodeId,
      centerX: (rect.left + rect.width / 2 - containerRect.left) / scale,
      top: (rect.top - containerRect.top) / scale,
      bottom: (rect.bottom - containerRect.top) / scale,
      left: (rect.left - containerRect.left) / scale,
      right: (rect.right - containerRect.left) / scale,
    };

    positionCacheRef.current.set(cacheKey, position);
    return position;
  }, [scale]);

  // Get badge position
  const getBadgePosition = useCallback((deptName: string, containerRect: DOMRect): NodePosition | null => {
    const badge = document.getElementById(`dept-badge-${deptName}`);
    if (!badge) return null;

    const rect = badge.getBoundingClientRect();
    return {
      id: deptName,
      centerX: (rect.left + rect.width / 2 - containerRect.left) / scale,
      top: (rect.top - containerRect.top) / scale,
      bottom: (rect.bottom - containerRect.top) / scale,
      left: (rect.left - containerRect.left) / scale,
      right: (rect.right - containerRect.left) / scale,
    };
  }, [scale]);

  // Create smooth elbow path with consistent rounded corners
  const createElbowPath = useCallback((
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number,
    radius: number = 10
  ): string => {
    let midY = startY + (endY - startY) * 0.5;
    
    // Adjust midY to be higher (closer to startY) to avoid overlapping with team badges
    // Max drop of 25px seems safe given the layout
    if (endY > startY) {
      midY = startY + Math.min((endY - startY) * 0.5, 25);
    }

    const dx = endX - startX;
    
    // Straight vertical line if horizontally aligned
    if (Math.abs(dx) < 1) {
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }

    // Clamp radius to available space
    const maxRadiusH = Math.abs(dx) / 2;
    const maxRadiusV = Math.min(Math.abs(midY - startY), Math.abs(endY - midY)) / 2;
    const r = Math.min(radius, maxRadiusH, maxRadiusV, cornerRadius); // Use dynamic corner radius

    if (r < 2) {
      // Too small for curves, use straight lines
      return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    }

    const goingRight = dx > 0;
    
    if (goingRight) {
      return `M ${startX} ${startY} 
              L ${startX} ${midY - r} 
              Q ${startX} ${midY} ${startX + r} ${midY} 
              L ${endX - r} ${midY} 
              Q ${endX} ${midY} ${endX} ${midY + r} 
              L ${endX} ${endY}`;
    } else {
      return `M ${startX} ${startY} 
              L ${startX} ${midY - r} 
              Q ${startX} ${midY} ${startX - r} ${midY} 
              L ${endX + r} ${midY} 
              Q ${endX} ${midY} ${endX} ${midY + r} 
              L ${endX} ${endY}`;
    }
  }, []);

  // Create optimized tree connector - single continuous path
  const createTreePath = useCallback((
    parentX: number,
    parentY: number,
    children: Array<{ x: number; y: number }>,
    radius: number = 10
  ): string => {
    if (children.length === 0) return '';

    // Sort children left to right
    const sorted = [...children].sort((a, b) => a.x - b.x);
    const childrenTopY = Math.min(...sorted.map(c => c.y));
    
    // Adjust midY to be higher (closer to parentY) to avoid overlapping with team badges
    // Max drop of 25px seems safe given the layout
    const midY = parentY + Math.min((childrenTopY - parentY) * 0.5, 25);

    // Single child - simple elbow
    if (sorted.length === 1) {
      return createElbowPath(parentX, parentY, sorted[0].x, sorted[0].y, radius);
    }

    const leftX = sorted[0].x;
    const rightX = sorted[sorted.length - 1].x;
    
    // Clamp radius
    const maxRadiusV = Math.min(midY - parentY, childrenTopY - midY) / 2;
    const r = Math.min(radius, maxRadiusV, cornerRadius); // Use dynamic corner radius

    let path = '';

    // Stem from parent down to midY
    path = `M ${parentX} ${parentY} L ${parentX} ${midY}`;

    // Horizontal spine from leftmost to rightmost child
    path += ` M ${leftX} ${midY} L ${rightX} ${midY}`;

    // Vertical drops to each child
    sorted.forEach(child => {
      path += ` M ${child.x} ${midY} L ${child.x} ${child.y}`;
    });

    // Connect parent stem to spine with rounded corners if parent not at edge
    if (parentX > leftX && parentX < rightX) {
      // Parent is between children - already connected via stem to midY
      // Spine passes through parent position
    } else if (parentX <= leftX) {
      // Parent at or left of leftmost - connect with curve to left side
      if (Math.abs(parentX - leftX) > r * 2) {
        // Add horizontal connection from parent to spine
        path += ` M ${parentX} ${midY - r} Q ${parentX} ${midY} ${parentX + r} ${midY}`;
      }
    } else {
      // Parent at or right of rightmost - connect with curve to right side
      if (Math.abs(parentX - rightX) > r * 2) {
        path += ` M ${parentX} ${midY - r} Q ${parentX} ${midY} ${parentX - r} ${midY}`;
      }
    }

    return path;
  }, [createElbowPath]);

  // Generate a consistent color from a string ID
  const getColorFromId = useCallback((id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }, []);

  // Main path calculation
  const calculatePaths = useCallback((forceRefresh = false) => {
    const container = document.getElementById('chart-content');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const newPaths: PathData[] = [];

    if (forceRefresh) {
      positionCacheRef.current.clear();
    }

    // Find root people (executives)
    const rootPeople = people.filter(p => !p.managerId || !people.find(m => m.id === p.managerId));
    const execPos = rootPeople.length > 0 ? getNodePosition(rootPeople[0].id, containerRect, forceRefresh) : null;

    // Collect department badge positions
    const badgePositions: Array<{ dept: string; x: number; y: number; bottom: number }> = [];
    const uniqueDepts = new Set<string>();
    
    deptHeads.forEach(head => {
      if (!uniqueDepts.has(head.department)) {
        const pos = getBadgePosition(head.department, containerRect);
        if (pos) {
          badgePositions.push({
            dept: head.department,
            x: pos.centerX,
            y: pos.top,
            bottom: pos.bottom
          });
          uniqueDepts.add(head.department);
        }
      }
    });

    // 1. Executive to department badges
    if (execPos && badgePositions.length > 0) {
      const childPositions = badgePositions.map(b => ({ x: b.x, y: b.y }));
      const treePath = createTreePath(execPos.centerX, execPos.bottom, childPositions, cornerRadius);
      
      if (treePath) {
        newPaths.push({
          key: 'exec-to-depts',
          d: treePath,
          stroke: primaryColor,
          strokeWidth: primaryWidth
        });
      }
    }

    // 2. Department badges to department heads
    deptHeads.forEach(head => {
      const badgePos = getBadgePosition(head.department, containerRect);
      const headPos = getNodePosition(head.id, containerRect, forceRefresh);

      if (badgePos && headPos) {
        const path = createElbowPath(badgePos.centerX, badgePos.bottom, headPos.centerX, headPos.top, cornerRadius);
        newPaths.push({
          key: `badge-to-head-${head.id}`,
          d: path,
          stroke: primaryColor,
          strokeWidth: primaryWidth
        });
      }
    });

    // 3. Manager to direct reports (within departments)
    Object.entries(connectionsByManager).forEach(([mgrId, childIds]: [string, string[]]) => {
      const mgrPos = getNodePosition(mgrId, containerRect, forceRefresh);
      if (!mgrPos) return;

      // Filter out dept heads (they connect via badges)
      const validChildren = childIds
        .filter(id => !deptHeadIds.has(id))
        .map(id => {
          const pos = getNodePosition(id, containerRect, forceRefresh);
          return pos ? { x: pos.centerX, y: pos.top } : null;
        })
        .filter(Boolean) as Array<{ x: number; y: number }>;

      if (validChildren.length === 0) return;

      const treePath = createTreePath(mgrPos.centerX, mgrPos.bottom, validChildren, cornerRadius);
      if (treePath) {
        newPaths.push({
          key: `tree-${mgrId}`,
          d: treePath,
          stroke: primaryColor,
          strokeWidth: primaryWidth
        });
      }
    });

    // 4. Secondary manager lines (dotted)
    people.forEach(person => {
      if (person.secondaryManagerIds?.length) {
        person.secondaryManagerIds.forEach(secMgrId => {
          const personPos = getNodePosition(person.id, containerRect, forceRefresh);
          const secMgrPos = getNodePosition(secMgrId, containerRect, forceRefresh);

          if (personPos && secMgrPos) {
            // Determine which side is closer
            const isRightSide = personPos.centerX > secMgrPos.centerX;
            
            // Start from Manager's side
            const startX = isRightSide ? secMgrPos.right : secMgrPos.left;
            const startY = secMgrPos.top + (secMgrPos.bottom - secMgrPos.top) / 2; // Center vertically
            
            // End at Person's side (opposite to manager)
            // If manager is to the left (isRightSide=true), enter person from left
            // If manager is to the right (isRightSide=false), enter person from right
            const endX = isRightSide ? personPos.left : personPos.right;
            const endY = personPos.top + (personPos.bottom - personPos.top) / 2; // Center vertically
            
            const midX = isRightSide ? startX + 20 : startX - 20; // Go out 20px from manager
            // We need a second midX for the entry into the person
            const entryMidX = isRightSide ? endX - 20 : endX + 20; // Go out 20px from person

            // Calculate a midpoint X that is halfway between the two cards
            const centerMidX = startX + (endX - startX) / 2;

            let path = '';
            
            // Orthogonal path (Manhattan routing)
            // Start -> Horizontal to Center -> Vertical to Target Y -> Horizontal to End
            
            path = `M ${startX} ${startY} 
                    L ${centerMidX} ${startY} 
                    L ${centerMidX} ${endY} 
                    L ${endX} ${endY}`;

            newPaths.push({
              key: `secondary-${person.id}-${secMgrId}`,
              d: path,
              stroke: useRandomSecondaryColors ? getColorFromId(`${person.id}-${secMgrId}`) : secondaryBaseColor,
              strokeWidth: secondaryWidth,
              strokeDasharray: secondaryStyle === 'dotted' ? '6 4' : secondaryStyle === 'dashed' ? '12 6' : undefined,
              opacity: 1
            });
          }
        });
      }
    });

    // 5. Support lines (dotted blue)
    // First, collect ALL support relationships to know how many lines target each person
    const allSupportLinks: Array<{ supporterId: string; supportedId: string; person: typeof people[0] }> = [];
    people.forEach(person => {
      if (person.supportedIds?.length) {
        person.supportedIds.forEach(supportedId => {
          allSupportLinks.push({
            supporterId: person.id,
            supportedId,
            person
          });
        });
      }
    });

    // Group by supported person (target) to track how many lines go to each target
    const linksByTarget: Record<string, typeof allSupportLinks> = {};
    allSupportLinks.forEach(link => {
      if (!linksByTarget[link.supportedId]) {
        linksByTarget[link.supportedId] = [];
      }
      linksByTarget[link.supportedId].push(link);
    });

    // Track global index for each support person for unique routing
    let globalSupporterIndex = 0;

    // Now process each support person's links
    const supportByPerson: Record<string, Array<{ supportedId: string; person: typeof people[0] }>> = {};
    people.forEach(person => {
      if (person.supportedIds?.length) {
        supportByPerson[person.id] = person.supportedIds.map(supportedId => ({
          supportedId,
          person
        }));
      }
    });

    Object.entries(supportByPerson).forEach(([personId, links]) => {
      const personPos = getNodePosition(personId, containerRect, forceRefresh);
      if (!personPos || links.length === 0) return;

      const person = links[0].person;
      const currentSupporterIndex = globalSupporterIndex;
      globalSupporterIndex++;
      
      // Get positions of all supported people
      const supportedPositions = links.map(link => {
        // Find this link's index among all links to the same target
        const targetLinks = linksByTarget[link.supportedId] || [];
        const indexAmongTargetLinks = targetLinks.findIndex(l => l.supporterId === personId);
        const totalLinksToTarget = targetLinks.length;
        
        return {
          id: link.supportedId,
          pos: getNodePosition(link.supportedId, containerRect, forceRefresh),
          indexAmongTargetLinks,
          totalLinksToTarget
        };
      }).filter(item => item.pos !== null) as Array<{ id: string; pos: NodePosition; indexAmongTargetLinks: number; totalLinksToTarget: number }>;

      if (supportedPositions.length === 0) return;

      // Determine if most targets are to the left or right
      const avgTargetX = supportedPositions.reduce((sum, item) => sum + item.pos.centerX, 0) / supportedPositions.length;
      const isRightSide = personPos.centerX > avgTargetX;

      // Start point: from support staff's side - use unique offset per supporter
      const sideOffset = (currentSupporterIndex % 5) * 8 - 16;
      const startX = isRightSide ? personPos.left : personPos.right;
      const startY = personPos.top + (personPos.bottom - personPos.top) / 2 + sideOffset;

      // Calculate the stem X position - unique per supporter
      const stemX = startX + (isRightSide ? -40 : 40) - (currentSupporterIndex * 15);

      if (supportedPositions.length === 1) {
        // Single target - route with unique offset based on how many lines go to this target
        const target = supportedPositions[0];
        
        // Calculate card width to determine offset from center
        const cardWidth = target.pos.right - target.pos.left;
        // Base offset from center - never use center (reserved for hierarchy lines)
        // Position lines in the left or right quarter of the card
        const baseOffset = cardWidth * 0.25; // 25% from center
        
        // Calculate unique X offset for this line based on its index among lines to this target
        const spreadWidth = 20;
        const indexOffset = target.totalLinksToTarget > 1 
          ? (target.indexAmongTargetLinks - (target.totalLinksToTarget - 1) / 2) * spreadWidth
          : 0;
        
        // Determine which side to attach based on supporter position relative to target
        const attachSide = personPos.centerX < target.pos.centerX ? -1 : 1;
        const endX = target.pos.centerX + (baseOffset * attachSide) + indexOffset;
        const endY = target.pos.bottom;
        
        // Unique Y for the horizontal channel based on supporter index
        const cutY = endY + 20 + (currentSupporterIndex * 15);

        const path = `M ${startX} ${startY} 
                L ${stemX} ${startY}
                L ${stemX} ${cutY}
                L ${endX} ${cutY}
                L ${endX} ${endY}`;

        newPaths.push({
          key: `support-${personId}-${target.id}`,
          d: path,
          stroke: person.supportColor || '#3b82f6',
          strokeWidth: secondaryWidth,
          strokeDasharray: '4 4',
          opacity: 1
        });
      } else {
        // Multiple targets - shared stem that splits
        // Sort targets by X position
        const sortedTargets = [...supportedPositions].sort((a, b) => a.pos.centerX - b.pos.centerX);
        
        // Find the lowest bottom among all targets
        const maxBottom = Math.max(...sortedTargets.map(item => item.pos.bottom));
        // Unique channel Y based on supporter index
        const channelY = maxBottom + 20 + (currentSupporterIndex * 15);
        
        // Calculate end points for each target with unique offsets - never use center
        const endpoints = sortedTargets.map((target) => {
          // Calculate card width to determine offset from center
          const cardWidth = target.pos.right - target.pos.left;
          // Base offset from center - never use center (reserved for hierarchy lines)
          const baseOffset = cardWidth * 0.25;
          
          // Calculate unique X offset based on this line's index among all lines to this target
          const spreadWidth = 20;
          const indexOffset = target.totalLinksToTarget > 1 
            ? (target.indexAmongTargetLinks - (target.totalLinksToTarget - 1) / 2) * spreadWidth
            : 0;
          
          // Determine which side to attach based on supporter position relative to target
          const attachSide = personPos.centerX < target.pos.centerX ? -1 : 1;
          
          return {
            id: target.id,
            x: target.pos.centerX + (baseOffset * attachSide) + indexOffset,
            y: target.pos.bottom
          };
        });

        // Main stem path: from support staff to the horizontal channel
        let mainPath = `M ${startX} ${startY} L ${stemX} ${startY} L ${stemX} ${channelY}`;

        // Horizontal spine connecting all drop points
        const leftMostX = Math.min(...endpoints.map(e => e.x));
        const rightMostX = Math.max(...endpoints.map(e => e.x));
        
        mainPath += ` L ${leftMostX} ${channelY} M ${leftMostX} ${channelY} L ${rightMostX} ${channelY}`;

        // Add vertical drops to each target
        endpoints.forEach(endpoint => {
          mainPath += ` M ${endpoint.x} ${channelY} L ${endpoint.x} ${endpoint.y}`;
        });

        newPaths.push({
          key: `support-${personId}-multi`,
          d: mainPath,
          stroke: person.supportColor || '#3b82f6',
          strokeWidth: secondaryWidth,
          strokeDasharray: '4 4',
          opacity: 1
        });
      }
    });

    setPathsData(newPaths);
  }, [people, deptHeads, deptHeadIds, connectionsByManager, scale, getNodePosition, getBadgePosition, createElbowPath, createTreePath, primaryColor, primaryWidth, secondaryWidth, secondaryStyle, cornerRadius, useRandomSecondaryColors, secondaryBaseColor, getColorFromId]);

  // Debounced calculation
  const debouncedCalculate = useCallback((forceRefresh = false) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      calculatePaths(forceRefresh);
    }, 16); // ~1 frame
  }, [calculatePaths]);

  // Initial calculation
  useEffect(() => {
    const timeoutId = setTimeout(() => calculatePaths(true), 50);
    return () => clearTimeout(timeoutId);
  }, [calculatePaths]);

  // Scale change animation
  useEffect(() => {
    if (prevScaleRef.current !== scale) {
      prevScaleRef.current = scale;
      positionCacheRef.current.clear();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const startTime = performance.now();
      const duration = 320; // Match CSS transition

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        calculatePaths(true);

        if (elapsed < duration) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [scale, calculatePaths]);

  // Mutation observer for DOM changes
  useEffect(() => {
    const handleResize = () => debouncedCalculate(true);
    window.addEventListener('resize', handleResize);

    const observer = new MutationObserver((mutations) => {
      // Only recalculate if actual structure changed
      const shouldUpdate = mutations.some(m => 
        m.type === 'childList' || 
        (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class'))
      );
      
      if (shouldUpdate) {
        debouncedCalculate(true);
      }
    });

    const container = document.getElementById('chart-content');
    if (container) {
      observer.observe(container, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debouncedCalculate]);

  return (
    <svg
      className="pointer-events-none overflow-visible"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10
      }}
    >
      <g className="transition-opacity duration-150">
        {pathsData.map(({ key, d, stroke, strokeWidth, strokeDasharray, opacity }) => (
          <path
            key={key}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={strokeDasharray}
            opacity={opacity}
            className="transition-all duration-200 ease-out"
          />
        ))}
      </g>
    </svg>
  );
};

export default Lines;
