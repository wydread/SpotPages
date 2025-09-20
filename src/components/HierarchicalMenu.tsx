import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Target, User, X, Search } from 'lucide-react';
import type { OptimizedTree, CompactTreeNode } from '../types/optimized-tree';
import { CompactTreeNavigator } from '../utils/compact-tree-navigator';
import type { SettingsData } from '../contexts/DataContext';

interface HierarchicalMenuProps {
  optimizedTree: OptimizedTree | undefined;
  currentNodeId: string;
  onNodeChange: (nodeId: string) => void;
  settings: SettingsData;
  onClose?: () => void;
}

const HierarchicalMenu: React.FC<HierarchicalMenuProps> = ({ 
  optimizedTree, 
  currentNodeId, 
  onNodeChange, 
  settings,
  onClose 
}) => {
  // Early return if optimizedTree is not available
  if (!optimizedTree) {
    return (
      <div className="h-full flex flex-col bg-slate-900 border-r border-slate-800">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Target className="w-5 h-5 mr-2 text-emerald-400" />
            Decision Tree
          </h3>
          {onClose && (
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-400 text-sm">Loading decision tree...</div>
        </div>
      </div>
    );
  }

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Helper function to get position names
  const getPositionNames = (playerCount: number): string[] => {
    if (playerCount === 2) return ['SB', 'BB'];
    if (playerCount === 3) return ['BU', 'SB', 'BB'];
    if (playerCount === 4) return ['CO', 'BU', 'SB', 'BB'];
    if (playerCount === 5) return ['HJ', 'CO', 'BU', 'SB', 'BB'];
    if (playerCount === 6) return ['MP', 'HJ', 'CO', 'BU', 'SB', 'BB'];
    if (playerCount === 7) return ['UTG', 'MP', 'HJ', 'CO', 'BU', 'SB', 'BB'];
    if (playerCount === 8) return ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BU', 'SB', 'BB'];
    if (playerCount === 9) return ['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BU', 'SB', 'BB'];
    return ['SB', 'BB'];
  };

  // Helper function to format action labels
  const formatActionLabel = (actionType: string, amount: number, settings: SettingsData): string => {
    const formatBB = (amt: number) => {
      if (!settings?.blinds?.bb || settings.blinds.bb <= 0) {
        return 'N/A BB';
      }
      const bb = amt / settings.blinds.bb;
      return bb % 1 === 0 ? `${bb}BB` : `${bb.toFixed(1)}BB`;
    };

    switch (actionType) {
      case 'F': return 'Fold';
      case 'C': return 'Call';
      case 'X': return 'Check';
      case 'R': return amount > 0 ? formatBB(amount) : 'Raise';
      case 'A': return amount > 0 ? `All-in ${formatBB(amount)}` : 'All-in';
      default: return actionType;
    }
  };

  // Helper function to get node action title
  const getNodeActionTitle = (node: CompactTreeNode, optimizedTree: OptimizedTree, settings: SettingsData): string => {
    if (node.id === optimizedTree!.root) {
      return 'Root';
    }
    
    // Find parent node and the action that led to this node
    if (node.p) {
      const parentNode = optimizedTree!.nodes[node.p];
      if (parentNode) {
        const actionToChild = parentNode.a.find(action => action.n === node.id);
        if (actionToChild) {
          return formatActionLabel(actionToChild.t, actionToChild.amt || 0, settings);
        }
      }
    }
    
    return `Player ${node.pl}`;
  };

  // Helper function to get node player position
  const getNodePlayerPosition = (node: CompactTreeNode, settings: SettingsData): string => {
    const positions = getPositionNames(settings.playerCount);
    return positions[node.pl] || `P${node.pl}`;
  };

  // Auto-expand path to current node
  useEffect(() => {
    const pathToExpand = new Set<string>();
    let current = optimizedTree!.nodes[currentNodeId];
    
    // Expand all parent nodes leading to current node
    while (current && current.p) {
      pathToExpand.add(current.p);
      current = optimizedTree!.nodes[current.p];
    }
    
    setExpandedNodes(pathToExpand);
  }, [currentNodeId, optimizedTree]);

  const toggleExpanded = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleNodeClick = (nodeId: string) => {
    onNodeChange(nodeId);
    onClose?.(); // Close modal/drawer on selection for mobile
  };

  const getActionFrequency = (node: CompactTreeNode) => {
    // Since we don't have hands data in lightweight nodes, return 0
    // This could be enhanced later by calculating frequencies from raw nodes if needed
    return 0;
  };

  const filteredNodes = React.useMemo(() => {
    if (!searchTerm) {
      // Get root nodes from optimized tree
      return Object.values(optimizedTree!.nodes).filter(node => !node.p);
    }
    
    const searchLower = searchTerm.toLowerCase();
    const matchingNodes: CompactTreeNode[] = [];
    
    Object.values(optimizedTree!.nodes).forEach(node => {
      const actionTitle = getNodeActionTitle(node, optimizedTree!, settings);
      const playerPosition = getNodePlayerPosition(node, settings);
      
      if (
        actionTitle.toLowerCase().includes(searchLower) ||
        playerPosition.toLowerCase().includes(searchLower) ||
        node.id.includes(searchTerm)
      ) {
        matchingNodes.push(node);
      }
    });
    
    return matchingNodes;
  }, [searchTerm, optimizedTree, settings]);

  const renderChildrenGrid = (children: CompactTreeNode[]) => {
    if (children.length === 0) return null;
    
    return (
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 px-2">
        {children.map(child => {
          const frequency = getActionFrequency(child);
          const isSelected = currentNodeId === child.id;
          const actionTitle = getNodeActionTitle(child, optimizedTree!, settings);
          
          return (
            <div
              key={child.id}
              onClick={() => handleNodeClick(child.id)}
              className={`
                p-2 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 border
                ${isSelected
                  ? 'bg-purple-600 text-white border-purple-400'
                  : 'bg-slate-700/50 hover:bg-slate-600 text-slate-200 border-slate-600 hover:border-slate-500'
                }
              `}
            >
              <div className="text-center">
                <div className="font-semibold truncate">{actionTitle}</div>
                {frequency > 0 && (
                  <div className="text-xs opacity-75 mt-1">
                    {frequency.toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderNode = (node: CompactTreeNode, level: number = 0) => {
    const children = node.a.filter(action => action.n).map(action => optimizedTree!.nodes[action.n!]).filter(Boolean);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = currentNodeId === node.id;
    const frequency = getActionFrequency(node);
    const actionTitle = getNodeActionTitle(node, optimizedTree!, settings);
    const playerPosition = getNodePlayerPosition(node, settings);

    return (
      <div key={node.id} className="select-none">
        <div
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer
            ${isSelected
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }
          `}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => handleNodeClick(node.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpanded(node.id, e)}
              className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-4 flex-shrink-0" />
          )}

          {level === 0 ? (
            <User className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <Target className="w-4 h-4 text-blue-400 flex-shrink-0" />
          )}
          
          <div className="flex-1 min-w-0 flex items-center justify-between">
            <span className="font-medium truncate">{actionTitle}</span>
            
            <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
              {frequency > 0 && (
                <span className="text-xs bg-slate-600/50 px-1.5 py-0.5 rounded">
                  {frequency.toFixed(0)}%
                </span>
              )}
              {hasChildren && (
                <span className="text-xs text-slate-500">
                  {children.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Render children in adaptive grid */}
        {isExpanded && hasChildren && renderChildrenGrid(children)}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-r border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Target className="w-5 h-5 mr-2 text-emerald-400" />
          Decision Tree
        </h3>
        {onClose && (
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600 p-4">
        <div className="space-y-1">
          {searchTerm ? (
            // Search results
            filteredNodes.length > 0 ? (
              <div className="space-y-1">
                <div className="text-xs text-slate-500 mb-2">
                  {filteredNodes.length} result{filteredNodes.length !== 1 ? 's' : ''}
                </div>
                {filteredNodes.map(node => (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    className={`
                      flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200
                      ${currentNodeId === node.id
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }
                    `}
                  >
                    <Target className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{getNodeActionTitle(node, optimizedTree!, settings)}</div>
                      <div className="text-xs text-slate-400">
                        {getNodePlayerPosition(node, settings)} • Depth {node.d}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <div className="text-sm">No nodes found</div>
              </div>
            )
          ) : (
            // Full tree view
            Object.values(optimizedTree!.nodes).filter(node => !node.p)
              .map(node => renderNode(node))
          )}
        </div>
      </div>

      {/* Footer with stats */}
      <div className="p-4 border-t border-slate-800 flex-shrink-0">
        <div className="text-xs text-slate-500 space-y-1">
          <div className="flex justify-between">
            <span>Total Nodes:</span>
            <span>{Object.keys(optimizedTree!.nodes).length}</span>
          </div>
          <div className="flex justify-between">
            <span>Current Depth:</span>
            <span>{optimizedTree!.nodes[currentNodeId]?.d || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HierarchicalMenu;