import React from 'react';
import { Palette } from 'lucide-react';
import type { NodeData } from '../types/poker';
import type { SettingsData } from '../contexts/DataContext';
import { formatBB as formatBBUtil, isActionAllIn } from '../utils/poker-utils';

interface DynamicLegendProps {
  nodeData: NodeData;
  settings: SettingsData;
}

const DynamicLegend: React.FC<DynamicLegendProps> = ({ nodeData, settings }) => {
  const formatBB = (amount: number) => {
    return formatBBUtil(amount, settings.blinds.bb);
  };

  const getRaiseColor = (actionIndex: number) => {
    const action = nodeData.actions?.[actionIndex];
    if (!action || (action.type !== 'R' && action.type !== 'A')) return '#94a3b8';
    
    // Calculate if this is an all-in based on player stack
    const playerIndex = nodeData.player;
    const actionAmount = action.amount;
    const isAllIn = isActionAllIn(actionAmount, playerIndex, settings, nodeData.sequence);
    
    if (isAllIn) {
      return '#e1bee1'; // Purple for all-in
    }
    
    const bbAmount = action.amount / (settings?.blinds?.bb || 100000);
    
    // Gradient from light red (#ffa4a4) at 2BB to vibrant red (#DC143C) at 20BB+
    if (bbAmount <= 2) return '#ffa4a4';
    if (bbAmount >= 20) return '#DC143C';
    
    // Calculate gradient between the two colors
    const ratio = (bbAmount - 2) / (20 - 2);
    const r1 = 255, g1 = 164, b1 = 164; // #ffa4a4
    const r2 = 220, g2 = 20, b2 = 60;   // #DC143C
    
    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Analyze current node data to determine which actions are actually used
  const getVisibleActions = () => {
    const actionDetails: { [key: string]: { color: string; amount: number; type: string; bbAmount: number; actionIndex: number } } = {};

    if (!nodeData?.hands || !nodeData?.actions) return { actionDetails };

    // Check all hands to see which actions are actually played
    Object.values(nodeData.hands).forEach(handData => {
      if (handData.played && handData.weight > 0) {
        handData.played.forEach((frequency, index) => {
          if (frequency > 0) {
            const action = nodeData.actions[index];
            if (action) {
              let actionKey = '';
              let color = '';
              let actionType = '';
              
              switch (action.type) {
                case 'F':
                  // Skip fold actions completely - don't add to legend
                  return;
                case 'C':
                case 'X':
                  actionKey = 'call';
                  color = '#bee1be'; // Keep green for call/check
                  actionType = 'call';
                  break;
                case 'R':
                case 'A':
                  const bbAmount = action.amount / (settings?.blinds?.bb || 100000);
                  
                  // Calculate if this is an all-in based on player stack
                  const playerIndex = nodeData.player;
                  const actionAmount = action.amount;
                  const isAllIn = isActionAllIn(actionAmount, playerIndex, settings, nodeData.sequence);
                  
                  if (isAllIn) {
                    actionKey = `allin-${action.amount}`;
                    color = '#e1bee1';
                    actionType = 'allin';
                  } else {
                    actionKey = `raise-${action.amount}`;
                    color = getRaiseColor(index);
                    actionType = 'raise';
                  }
                  actionDetails[actionKey] = {
                    color,
                    amount: action.amount,
                    type: actionType,
                    bbAmount,
                    actionIndex: index
                  };
                  return;
              }
              
              if (actionKey) {
                actionDetails[actionKey] = {
                  color,
                  amount: action.amount,
                  type: actionType,
                  bbAmount: 0,
                  actionIndex: index
                };
              }
            }
          }
        });
      }
    });

    return { actionDetails };
  };

  const { actionDetails } = getVisibleActions();

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'call': return 'Call/Check';
      case 'raise': return 'Raise';
      case 'allin': return 'All-in';
      default: return actionType;
    }
  };

  const getActionDescription = (actionType: string, amount: number) => {
    if ((actionType === 'raise' || actionType === 'allin') && amount > 0) {
      return formatBB(amount);
    }
    return '';
  };

  // Sort actions for consistent display order
  const sortedActionKeys = Object.keys(actionDetails).sort((a, b) => {
    const aDetails = actionDetails[a];
    const bDetails = actionDetails[b];
    
    // Sort by type priority: call, raise (by amount), allin (by amount)
    const typePriority = { call: 0, raise: 1, allin: 2 };
    const aPriority = typePriority[aDetails.type as keyof typeof typePriority] || 4;
    const bPriority = typePriority[bDetails.type as keyof typeof typePriority] || 4;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // If same type, sort by BB amount
    return aDetails.bbAmount - bDetails.bbAmount;
  });

  if (sortedActionKeys.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
          <Palette className="w-4 h-4 mr-2 text-emerald-400" />
          Legend
        </h3>
        <div className="text-slate-400 text-sm text-center py-4">
          No actions in current view
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
        <Palette className="w-4 h-4 mr-2 text-white-400" />
        Legend
      </h3>
      <div className="space-y-3">
        {sortedActionKeys.map(actionKey => {
          const details = actionDetails[actionKey];
          const description = getActionDescription(details.type, details.amount);
          
          return (
            <div key={actionKey} className="flex items-start space-x-3">
              <div 
                className="w-4 h-4 rounded border border-black flex-shrink-0 mt-0.5 shadow-sm"
                style={{ backgroundColor: details.color }}
              ></div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium leading-tight">
                  {getActionLabel(details.type)}
                  {description && (
                    <span className="text-slate-400 ml-1 text-sm">
                      {description}
                    </span>
                  )}
                </div>
                {/* Show frequency if available */}
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DynamicLegend;