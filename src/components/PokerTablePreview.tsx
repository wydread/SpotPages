import React from 'react';
import type { NodeData } from '../types/poker';
import type { SettingsData } from '../contexts/DataContext';
import type { OptimizedTree, CompactTreeNode } from '../types/optimized-tree';
import { getPositionNames, formatBB as formatBBUtil } from '../utils/poker-utils';

interface PokerTablePreviewProps {
  settings: SettingsData;
  currentNode: NodeData;
  onPositionClick?: (playerIndex: number) => void;
  optimizedTree: OptimizedTree | undefined;
  compactCurrentNode: CompactTreeNode;
  navigationPath: CompactTreeNode[];
}

const PokerTablePreview: React.FC<PokerTablePreviewProps> = ({ settings, currentNode, onPositionClick, optimizedTree, compactCurrentNode, navigationPath }) => {
  console.log('🏓 PokerTablePreview - Rendering with:', {
    settingsBlindsBB: settings?.blinds?.bb,
    currentNodeSequence: currentNode?.sequence,
    compactCurrentNodeStreet: compactCurrentNode?.s,
    navigationPathLength: navigationPath?.length
  });
  
  const formatBB = (amount: number) => {
    return formatBBUtil(amount, settings?.blinds?.bb || 0);
  };

  const formatActionLabel = (actionType: string, amount: number): string => {
    switch (actionType) {
      case 'F': return 'Fold';
      case 'C': return 'Call';
      case 'X': return 'Check';
      case 'R': return amount > 0 ? `Raise ${formatBB(amount)}` : 'Raise';
      case 'A': return 'All-in';
      default: return actionType;
    }
  };

  const getLastAction = () => {
    if (!currentNode?.sequence || currentNode.sequence.length === 0) {
      return null;
    }
    
    const lastAction = currentNode.sequence[currentNode.sequence.length - 1];
    return {
      player: lastAction.player,
      actionLabel: formatActionLabel(lastAction.type, lastAction.amount || 0),
      amount: lastAction.amount || 0
    };
  };

  const calculatePotAndContributions = () => {
    console.log('🏓 calculatePotAndContributions - Starting calculation');
    
    let totalPot = 0;
    const playerCurrentStreetContributions = new Array(settings.playerCount).fill(0);
    const playerTotalContributions = new Array(settings.playerCount).fill(0);
    const positions = getPositionNames(settings.playerCount);
    
    // Add antes to total pot
    const ante = settings?.blinds?.ante || 0;
    if (ante > 0) {
      totalPot += ante * settings.playerCount;
      console.log('🏓 calculatePotAndContributions - Added antes to pot:', ante * settings.playerCount);
    }
    
    // Find SB and BB player indices for initial blinds
    const sbIndex = positions.indexOf('SB');
    const bbIndex = positions.indexOf('BB');
    const sb = settings?.blinds?.sb || 0;
    const bb = settings?.blinds?.bb || 0;
    
    // Add initial blinds to total pot
    totalPot += sb + bb;
    console.log('🏓 calculatePotAndContributions - Added blinds to pot:', sb + bb);
    
    // Track initial blind contributions
    if (sbIndex !== -1) {
      playerTotalContributions[sbIndex] += sb;
      if (compactCurrentNode.s === 0) {
        playerCurrentStreetContributions[sbIndex] = sb;
      }
    }
    if (bbIndex !== -1) {
      playerTotalContributions[bbIndex] += bb;
      if (compactCurrentNode.s === 0) {
        playerCurrentStreetContributions[bbIndex] = bb;
      }
    }

    // Process actions from currentNode.sequence
    if (currentNode?.sequence) {
      console.log('🏓 calculatePotAndContributions - Processing sequence:', currentNode.sequence);
      
      currentNode.sequence.forEach((action, index) => {
        const actionAmount = action.amount || 0;
        const actionPlayer = action.player;
        const actionStreet = action.street;
        
        console.log('🏓 calculatePotAndContributions - Processing action:', {
          index,
          player: actionPlayer,
          type: action.type,
          amount: actionAmount,
          street: actionStreet
        });
        
        if (action.type !== 'F' && action.type !== 'X' && actionAmount > 0) {
          // Add to total pot
          totalPot += actionAmount;
          
          // Track player's total contribution
          if (actionPlayer < playerTotalContributions.length) {
            playerTotalContributions[actionPlayer] += actionAmount;
            
            // If this action is on the current street, update current street contribution
            if (actionStreet === compactCurrentNode.s) {
              if (action.type === 'C') {
                // Call: add to current street contribution
                playerCurrentStreetContributions[actionPlayer] += actionAmount;
              } else if (action.type === 'R') {
                // Raise: set as current street contribution (total bet on this street)
                playerCurrentStreetContributions[actionPlayer] = actionAmount;
              }
            }
          }
        }
      });
    }
    
    console.log('🏓 calculatePotAndContributions - Final results:', {
      totalPot,
      playerCurrentStreetContributions,
      playerTotalContributions
    });
    
    return { totalPot, playerCurrentStreetContributions, playerTotalContributions };
  };

  const getButtonPlayerIndex = () => {
    const positions = getPositionNames(settings.playerCount);
    if (settings.playerCount === 2) {
      // In heads-up, SB is the button
      return positions.indexOf('SB');
    } else {
      // Otherwise, BU is the button
      return positions.indexOf('BU');
    }
  };

  const getPlayerStatus = (playerIndex: number) => {
    // Check if player folded in the currentNode.sequence
    if (!currentNode?.sequence) return 'active';
    
    // Find the last action by this player in the sequence
    let lastActionByPlayer = null;
    for (let i = currentNode.sequence.length - 1; i >= 0; i--) {
      const action = currentNode.sequence[i];
      if (action.player === playerIndex) {
        lastActionByPlayer = action;
        break;
      }
    }
    
    if (lastActionByPlayer?.type === 'F') return 'folded';
    
    return 'active';
  };

  const getPlayerStacks = () => {
    console.log('🏓 getPlayerStacks - Starting with initial stacks:', settings.stacks);
    
    const stacks = [...(settings.stacks || [])];
    const positions = getPositionNames(settings.playerCount);
    const sb = settings?.blinds?.sb || 0;
    const bb = settings?.blinds?.bb || 0;
    const ante = settings?.blinds?.ante || 0;
    
    // Subtract blinds and antes
    positions.forEach((pos, index) => {
      if (pos === 'SB' && index < stacks.length) stacks[index] -= sb;
      if (pos === 'BB' && index < stacks.length) stacks[index] -= bb;
      if (ante > 0 && index < stacks.length) stacks[index] -= ante;
    });
    
    console.log('🏓 getPlayerStacks - After blinds/antes:', stacks);
    
    // Subtract actions from currentNode.sequence
    if (currentNode?.sequence) {
      currentNode.sequence.forEach((action, index) => {
        const actionAmount = action.amount || 0;
        const actionPlayer = action.player;
        
        if (action.type !== 'F' && action.type !== 'X' && actionAmount > 0) {
          if (actionPlayer < stacks.length) {
            stacks[actionPlayer] -= actionAmount;
            console.log('🏓 getPlayerStacks - Player', actionPlayer, 'action', action.type, 'amount', actionAmount, 'new stack:', stacks[actionPlayer]);
          }
        }
      });
    }
    
    console.log('🏓 getPlayerStacks - Final stacks:', stacks);
    return stacks;
  };

  // Position players around oval table
  const getPlayerPosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radiusX = 40;
    const radiusY = 38;
    
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    return { x, y };
  };

// Position bet boxes between players and pot
  const getBetBoxPosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radiusX = 20; // Smaller radius for bet boxes
    const radiusY = 15; // Smaller radius for bet boxes
  
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    return { x, y };
  };

  
  const positions = getPositionNames(settings.playerCount);
  const playerStacks = getPlayerStacks();
  const currentPlayer = compactCurrentNode.pl;
  const buttonPlayerIndex = getButtonPlayerIndex();
  const { totalPot, playerCurrentStreetContributions } = calculatePotAndContributions();
  const lastAction = getLastAction();

  return (
    <div className="space-y-4">
      {/* Table Container */}
      <div className="relative w-full aspect-[4/3] mx-auto">
        {/* Oval Table Surface */}
        <div className="absolute inset-8 sm:inset-12 bg-black rounded-full border-2 border-purple-500 shadow-inner transform scale-x-110">
          {/* Central Pot */}
          <div className="absolute inset-0 flex items-center justify-center transform scale-x-90">
            <div className="bg-slate-900/90 backdrop-blur-sm rounded px-2 sm:px-3 py-1 sm:py-2 border border-slate-600 shadow-lg text-center">
              <div className="text-white font-bold text-sm">
                Pot: {formatBB(totalPot)}
              </div>
            </div>
          </div>
        </div>

  {positions.map((position, index) => {
    const playerPos = getPlayerPosition(index, settings.playerCount); // Renamed variable
      const betBoxPos = getBetBoxPosition(index, settings.playerCount); // New variable for bet box position
      const status = getPlayerStatus(index);
      const isCurrent = currentPlayer === index;
      const isButton = index === buttonPlayerIndex;
      const stack = playerStacks[index];
      const currentStreetContribution = playerCurrentStreetContributions[index];
  
    return (
      <React.Fragment key={index}> {/* Use React.Fragment to group elements */}
        <div
          className="absolute"
          style={{
            left: `calc(50% + ${playerPos.x}%)`,
            top: `calc(50% + ${playerPos.y}%)`,
            transform: `translate(-50%, -50%)`
        }}
      >
              {/* Cards positioned above player rectangle */}
              {status === 'active' && (
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 flex space-x-1 z-0">
                  <div className="w-6 h-8 bg-red-600 rounded-t border border-b-0 border-white shadow-md"></div>
                  <div className="w-6 h-8 bg-red-600 rounded-t border border-b-0 border-white shadow-md"></div>
                </div>
              )}

              {/* Player Rectangle */}
              <div className={`relative bg-slate-900/90 backdrop-blur-sm rounded-md border px-1 py-0.5 sm:px-2 sm:py-1 xl:px-4 xl:py-2 min-w-12 sm:min-w-18 xl:min-w-28 text-center transition-all duration-200 shadow-lg z-10 cursor-pointer hover:border-purple-500
                ${isCurrent ? 'border-purple-400 shadow-purple-400/50 bg-purple-600 ring-1 ring-purple-400/30' : 'border-slate-600'}
                ${status === 'folded' ? 'opacity-60 bg-slate-700/60' : status === 'inactive' ? 'opacity-40' : ''}
                ${status === 'active' ? 'hover:bg-slate-800/70 cursor-pointer' : 'cursor-default'}`}>
                <div 
                  onClick={() => onPositionClick?.(index)}
                  className="w-full h-full"
                >
                  {/* Position Label */}
                  <div className={`font-bold text-sm mb-1 ${status === 'folded' ? 'text-slate-500' : isCurrent ? 'text-white-200' : 'text-white'}`}>
                    {position}
                  </div>
                
                  {/* Stack Size */}
                  <div className={`text-xs font-medium leading-none ${status === 'folded' ? 'text-slate-600' : isCurrent ? 'text-white-300' : 'text-slate-300'}`}>
                    {formatBB(Math.max(0, stack))}
                  </div>
                </div>
                
                {/* Dealer Button */}
                {isButton && (
                  <div className="absolute -bot+10 -left-11 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center border border-white">
                    <span className="text-white text-xs font-bold">D</span>
                  </div>
                )}
              </div>
            </div>
 {/* Player Bet Box - Positioned relative to table container */}
    {currentStreetContribution > 0 && status !== 'folded' && (
      <div
        className="absolute z-20"
        style={{
          left: `calc(50% + ${betBoxPos.x}%)`,
          top: `calc(50% + ${betBoxPos.y}%)`,
          transform: `translate(-50%, -50%)`
        }}
          >
            <div className="bg-slate-900/90 backdrop-blur-sm rounded px-1 py-0.5 border border-slate-600 shadow-lg">
                <div className="text-white font-bold text-xs text-center whitespace-nowrap">
                  {formatBB(currentStreetContribution)}
                </div>
              </div>
            </div>
          )}
        </React.Fragment>
        );
      })}
      </div>
    </div>
  );
};

export default PokerTablePreview;