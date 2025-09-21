import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import type { CompactTreeNode, CompactAction, OptimizedTree } from '../types/optimized-tree';
import { CompactTreeNavigator } from '../utils/compact-tree-navigator';
import type { SettingsData } from '../contexts/DataContext';

interface TopNavigationProps {
  navigationPath: CompactTreeNode[];
  currentNodeId: string;
  onNodeChange: (nodeId: string) => void;
  optimizedTree: OptimizedTree | undefined;
  settings: SettingsData;
}

const TopNavigation: React.FC<TopNavigationProps> = ({
  navigationPath,
  currentNodeId,
  onNodeChange,
  optimizedTree,
  settings
}) => {
  // Component now assumes optimizedTree is always available since SpotPage conditionally renders it

  const formatBB = (amount: number) => {
    if (!settings?.blinds?.bb || settings.blinds.bb <= 0) {
      return 'N/A BB';
    }
    const bb = amount / settings.blinds.bb;
    return bb % 1 === 0 ? `${bb}BB` : `${bb.toFixed(1)}BB`;
  };

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

  // Calculate player's absolute stack value at a specific node
  const calculatePlayerStackAbsolute = React.useCallback((treeNode: CompactTreeNode): number => {
    const playerIndex = treeNode.pl;
    const initialStacks = settings?.stacks || [4000000, 4000000];
    let currentStack = initialStacks[playerIndex] || 4000000;
    const sb = settings?.blinds?.sb || 0;
    const bb = settings?.blinds?.bb || 0;
    const ante = settings?.blinds?.ante || 0;
    
    // Subtract blinds and antes for initial setup
    const positions = getPositionNames(settings?.playerCount || 2);
    const playerPosition = positions[playerIndex];
    
    if (playerPosition === 'SB') currentStack -= sb;
    if (playerPosition === 'BB') currentStack -= bb;
    if (ante > 0) currentStack -= ante;
    
    // Use the navigationPath to reconstruct the sequence of actions
    const nodeIndex = navigationPath.findIndex(node => node.id === treeNode.id);
    if (nodeIndex === -1) {
      return currentStack;
    }
    
    // Process actions from the navigation path up to this node
    for (let i = 1; i <= nodeIndex; i++) {
      const currentPathNode = navigationPath[i];
      const parentPathNode = navigationPath[i - 1];
      
      if (parentPathNode && parentPathNode.pl === playerIndex) {
        // Find the action that led from parent to current node
        const actionToChild = parentPathNode.a.find(action => action.n === currentPathNode.id);
        if (actionToChild && (actionToChild.t === 'C' || actionToChild.t === 'R' || actionToChild.t === 'A')) {
          const actionAmount = actionToChild.amt || 0;
          currentStack -= actionAmount;
        }
      }
    }
    
    return currentStack;
  }, [navigationPath, settings]);

  // Calculate player's stack in BB at a specific node
  const calculatePlayerStackAtNodeInBB = React.useCallback((treeNode: CompactTreeNode): number => {
    const absoluteStack = calculatePlayerStackAbsolute(treeNode);
    const bbValue = settings?.blinds?.bb || 100000;
    
    if (bbValue <= 0) return 0;
    return Math.round(absoluteStack / bbValue);
  }, [calculatePlayerStackAbsolute, settings]);

  // Color utility function to get highlight colors for taken actions
  const getActionHighlightColor = React.useCallback((
    action: CompactAction, 
    node: CompactTreeNode
  ): { backgroundColor: string; textColor: string } => {
    switch (action.t) {
      case 'F':
        return { backgroundColor: '#cbd5e1', textColor: 'black' }; // Light grey for fold (slate-300)
      case 'C':
      case 'X':
        return { backgroundColor: '#bee1be', textColor: 'black' }; // Green for call/check
      case 'R':
      case 'A':
        // Check if this is an all-in by comparing action amount with player's stack
        const playerStackAbsolute = calculatePlayerStackAbsolute(node);
        const actionAmount = action.amt || 0;
        
        // If action amount >= player's stack, it's an all-in
        if (actionAmount >= playerStackAbsolute) {
          return { backgroundColor: '#e1bee1', textColor: 'black' }; // Purple for all-in
        }
        
        // Regular raise - use red gradient based on BB amount
        const bbAmount = actionAmount / settings.blinds.bb;
        
        // Gradient from light red (#ffa4a4) at 2BB to a medium red (#ff6666) at 20BB+
        if (bbAmount <= 2) return { backgroundColor: '#ffa4a4', textColor: 'black' }; // Light red
        if (bbAmount >= 20) return { backgroundColor: '#ff6666', textColor: 'black' }; // Medium red
        
        // Calculate gradient between the two colors
        const ratio = (bbAmount - 2) / (20 - 2);
        const r1 = 255, g1 = 164, b1 = 164; // #ffa4a4
        const r2 = 255, g2 = 102, b2 = 102; // #ff6666
        
        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);
        
        return { backgroundColor: `rgb(${r}, ${g}, ${b})`, textColor: 'black' };
      default:
        return { backgroundColor: '#94a3b8', textColor: 'white' }; // Default grey
    }
  }, [calculatePlayerStackAbsolute, settings]);

  const getAvailableActionsForNode = (nodeId: string) => {
    const navigator = new CompactTreeNavigator(optimizedTree!);
    const navPath = navigator.getNavigationPath(nodeId, false, true);
    if (!navPath || !navPath.actions) return [];

    return navPath.actions.map((action, index) => {
      const targetNodeId = action.targetNode;
      let actionTitle = '';
      
      // Always use custom formatting for consistent display
      switch (action.type) {
        case 'F':
          actionTitle = 'Fold';
          break;
        case 'C':
          actionTitle = 'Call';
          break;
        case 'X':
          actionTitle = 'Check';
          break;
        case 'R':
          if (action.amount) {
            actionTitle = formatBB(action.amount);
          } else {
            actionTitle = 'Raise';
          }
          break;
        case 'A':
          if (action.amount) {
            actionTitle = `All-in ${formatBB(action.amount)}`;
          } else {
            actionTitle = 'All-in';
          }
          break;
        default:
          actionTitle = action.type;
      }

      return {
        action: {
          t: action.type,
          amt: action.amount,
          n: targetNodeId
        },
        actionTitle,
        targetNodeId,
        index
      };
    });
  };

  const isPlayerFoldedInNodeSequence = (node: CompactTreeNode): boolean => {
    const navigator = new CompactTreeNavigator(optimizedTree!);
    const breadcrumbs = navigator.getBreadcrumbs(node.id);
    
    // Check if this player folded in the sequence
    const playerBreadcrumbs = breadcrumbs.filter(breadcrumb => breadcrumb.player === node.pl);
    const lastAction = playerBreadcrumbs[playerBreadcrumbs.length - 1];
    
    return lastAction?.action === 'F';
  };

  // Mobile Layout (existing compact breadcrumb + actions)
  const renderMobileLayout = () => {
    const currentNode = optimizedTree!.nodes[currentNodeId];
    const availableActions = getAvailableActionsForNode(currentNodeId);

    return (
      <div className="flex items-center space-x-2 overflow-x-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
        {/* Navigation Path */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Home/Root */}
          <button
            onClick={() => onNodeChange('0')}
            className={`
              flex items-center space-x-1 px-2 py-1.5 rounded-md transition-all duration-200 text-sm font-medium
              ${currentNodeId === '0'
                ? 'bg-purple-600/30 text-white font-semibold' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }
            `}
            title="Return to root"
          >
            <Home className="w-3 h-3" />
            <span className="hidden sm:inline">Root</span>
          </button>

          {/* Path segments */}
          {navigationPath.slice(1).map((node: any, index) => {
            const isLast = index === navigationPath.length - 2;
            
            return (
              <React.Fragment key={node.id}>
                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <button
                  onClick={() => onNodeChange(node.id)}
                  className={`
                    px-2 sm:px-3 py-1.5 rounded-md transition-all duration-200 text-sm font-medium flex-shrink-0
                    ${isLast
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }
                  `}
                  title={node.actionTitle}
                >
                  {node.actionTitle}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Separator */}
        {availableActions.length > 0 && (
          <div className="w-px h-6 bg-slate-700 mx-2 flex-shrink-0"></div>
        )}

        {/* Available Actions */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {availableActions.map((actionData, index) => (
            <button
              key={index}
              onClick={() => {
                if (actionData.targetNodeId) {
                  onNodeChange(actionData.targetNodeId);
                }
              }}
              disabled={!actionData.targetNodeId}
              className={`
                px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 border flex-shrink-0
                ${actionData.targetNodeId 
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white border-slate-600 hover:border-slate-500 cursor-pointer'
                  : 'bg-slate-700/50 text-slate-500 border-slate-600/50 cursor-not-allowed'
                }
              `}
              title={actionData.targetNodeId ? `Navigate to ${actionData.actionTitle}` : 'No target node'}
            >
              {actionData.actionTitle}
            </button>
          ))}
        </div>

        {/* Current Node Info */}
        <div className="ml-auto flex items-center space-x-3 text-xs text-slate-500 flex-shrink-0">
          <span className="hidden md:inline">
            {currentNode ? getPositionNames(settings.playerCount)[currentNode.pl] || `Player ${currentNode.pl}` : 'Unknown'}
          </span>
          <span className="hidden lg:inline">
            Depth: {navigationPath.length - 1}
          </span>
          <span className="hidden xl:inline">
            Actions: {availableActions.length}
          </span>
        </div>
      </div>
    );
  };

  // Desktop Layout (new node cards system)
  const renderDesktopLayout = () => {
    return (
      <div className="flex items-start gap-1 overflow-x-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600 pb-2">
        {navigationPath.map((node: any, pathIndex) => {
          const isCurrentNode = node.id === currentNodeId;
          const stackBB = calculatePlayerStackAtNodeInBB(node);
          const availableActions = getAvailableActionsForNode(node.id);
          const positions = getPositionNames(settings.playerCount);
          const playerPosition = positions[node.pl] || `P${node.pl}`;
          const isPlayerFolded = isPlayerFoldedInNodeSequence(node);
          const cardWidth = isPlayerFolded ? 'w-20' : 'w-32';

          return (
            <div key={node.id} className={`
              flex-shrink-0 bg-slate-800/60 backdrop-blur-sm rounded-lg border transition-all duration-200 overflow-hidden h-36 ${cardWidth}
              cursor-pointer hover:bg-slate-700/50
              ${isCurrentNode 
                ? 'border-purple-500 shadow-lg shadow-purple-500/20' 
                : 'border-slate-700 hover:border-slate-600'
              }
            `}
            onClick={() => onNodeChange(node.id)}
            >
              {/* Node Header - Clickable to navigate to this node */}
              <div className={`
                w-full px-3 py-2 text-center transition-all duration-200 relative
                ${isCurrentNode 
                  ? 'bg-purple-600/20 text-white' 
                  : 'text-slate-300'
                }
              `}>
                <div className="absolute top-1 left-3 font-bold text-sm">{playerPosition}</div>
                <div className={`absolute top-1 right-3 text-xs ${isCurrentNode ? 'opacity-90' : 'opacity-75'}`}>{stackBB}BB</div>
              </div>

              {/* Actions Grid - Each action clickable to navigate to target node */}
              <div className="border-t border-slate-700/50 p-1 flex-1 flex flex-col">
                <div className="grid grid-cols-1 gap-0.5 flex-1">
                  {/* Render up to 5 actual actions only */}
                  {availableActions.slice(0, 5).map((actionData, actionIndex) => {
                    // Determine if this action was taken to reach the next node in the path
                    const nextNodeInPath = navigationPath[pathIndex + 1];
                    const isActionTaken = nextNodeInPath && actionData.targetNodeId === nextNodeInPath.id;
                    
                    // Get highlight colors if action was taken
                    const highlightColors = isActionTaken ? getActionHighlightColor(actionData.action, node) : null;
                    
                    return (
                      <button
                        key={actionIndex}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (actionData.targetNodeId) {
                            onNodeChange(actionData.targetNodeId);
                          }
                        }}
                        disabled={!actionData.targetNodeId}
                        className={`
                          px-2 py-0.5 rounded text-xs font-medium transition-all duration-200 text-center border
                          ${actionData.targetNodeId 
                            ? !isActionTaken
                              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white cursor-pointer border-slate-600'
                              : 'cursor-pointer border-slate-500'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700'
                          }
                        `}
                        style={highlightColors ? { 
                          backgroundColor: highlightColors.backgroundColor,
                          color: highlightColors.textColor
                        } : undefined}
                        title={actionData.targetNodeId ? `Navigate to ${actionData.actionTitle}` : 'No target node'}
                      >
                        {actionData.actionTitle}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

return (
  <>
    {/* Mobile Layout (lg and below) */}
    <div className="lg:hidden">
      {renderMobileLayout()}
    </div>

    {/* Desktop Layout (lg and above) */}
    <div className="hidden lg:block">
      {renderDesktopLayout()}
    </div>
  </>
  );
};

export default TopNavigation;