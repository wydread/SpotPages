import type { SettingsData } from '../contexts/DataContext';
import type { NodeData } from '../types/poker';

export const getPositionNames = (playerCount: number): string[] => {
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

export const formatBB = (amount: number, bbValue: number): string => {
  if (!bbValue || bbValue <= 0) {
    return 'N/A BB';
  }
  const bb = amount / bbValue;
  return bb % 1 === 0 ? `${bb}BB` : `${bb.toFixed(1)}BB`;
};

export const calculatePlayerStackAbsolute = (
  playerIndex: number,
  settings: SettingsData,
  actionSequence: Array<{
    player: number;
    type: string;
    amount: number;
    street: number;
  }>
): number => {
  const initialStacks = settings?.stacks || [];
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
  
  // Process actions from the sequence for this player
  actionSequence.forEach((action) => {
    if (action.player === playerIndex && (action.type === 'C' || action.type === 'R' || action.type === 'A')) {
      const actionAmount = action.amount || 0;
      currentStack -= actionAmount;
    }
  });
  
  return Math.max(0, currentStack);
};

export const isActionAllIn = (
  actionAmount: number,
  playerIndex: number,
  settings: SettingsData,
  actionSequence: Array<{
    player: number;
    type: string;
    amount: number;
    street: number;
  }>
): boolean => {
  const playerStackBefore = calculatePlayerStackAbsolute(playerIndex, settings, actionSequence);
  return actionAmount >= playerStackBefore;
};