import React from 'react';
import type { NodeData } from '../types/poker';
import type { SettingsData } from '../contexts/DataContext';

interface StrategyGridProps {
  nodeData: NodeData;
  equity: any;
  settings: SettingsData;
}

const StrategyGrid: React.FC<StrategyGridProps> = ({ nodeData, equity, settings }) => {
  const hands = [
    ['AA', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s'],
    ['AKo', 'KK', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s'],
    ['AQo', 'KQo', 'QQ', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s'],
    ['AJo', 'KJo', 'QJo', 'JJ', 'JTs', 'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s'],
    ['ATo', 'KTo', 'QTo', 'JTo', 'TT', 'T9s', 'T8s', 'T7s', 'T6s', 'T5s', 'T4s', 'T3s', 'T2s'],
    ['A9o', 'K9o', 'Q9o', 'J9o', 'T9o', '99', '98s', '97s', '96s', '95s', '94s', '93s', '92s'],
    ['A8o', 'K8o', 'Q8o', 'J8o', 'T8o', '98o', '88', '87s', '86s', '85s', '84s', '83s', '82s'],
    ['A7o', 'K7o', 'Q7o', 'J7o', 'T7o', '97o', '87o', '77', '76s', '75s', '74s', '73s', '72s'],
    ['A6o', 'K6o', 'Q6o', 'J6o', 'T6o', '96o', '86o', '76o', '66', '65s', '64s', '63s', '62s'],
    ['A5o', 'K5o', 'Q5o', 'J5o', 'T5o', '95o', '85o', '75o', '65o', '55', '54s', '53s', '52s'],
    ['A4o', 'K4o', 'Q4o', 'J4o', 'T4o', '94o', '84o', '74o', '64o', '54o', '44', '43s', '42s'],
    ['A3o', 'K3o', 'Q3o', 'J3o', 'T3o', '93o', '83o', '73o', '63o', '53o', '43o', '33', '32s'],
    ['A2o', 'K2o', 'Q2o', 'J2o', 'T2o', '92o', '82o', '72o', '62o', '52o', '42o', '32o', '22']
  ];

  // Color conversion helpers
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const toRgba = (color: string, alpha: number): string => {
    if (color.startsWith('rgb(')) {
      const rgb = color.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
      }
    } else if (color.startsWith('#')) {
      const { r, g, b } = hexToRgb(color);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  };

  const formatBB = (amount: number) => {
    const bb = amount / settings.blinds.bb;
    return bb % 1 === 0 ? `${bb}BB` : `${bb.toFixed(1)}BB`;
  };

  const getHandData = React.useCallback((hand: string) => {
    return nodeData?.hands?.[hand];
  }, [nodeData]);


  const getRaiseColor = React.useCallback((actionIndex: number) => {
    const action = nodeData.actions?.[actionIndex];
    if (!action || (action.type !== 'R' && action.type !== 'A')) return '#94a3b8';
    
    // Use pre-calculated isAllIn flag
    if (action.isAllIn) {
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
  }, [nodeData, settings]);

  const getHandRenderData = React.useCallback((hand: string) => {
    const handData = getHandData(hand);
    
    if (!handData || !handData.played) {
      return {
        overallWeight: 0,
        absoluteActionFrequencies: [{ color: '#94a3b8', percentage: 100, type: 'previous_fold' }],
        totalNonFoldActivePercentage: 0
      };
    }

    const overallWeight = handData.weight || 0;
    const absoluteActionFrequencies: Array<{
      color: string;
      percentage: number;
      type: string;
    }> = [];
    
    const played = handData.played;
    
    // Add previous fold percentage (grey)
    const previousFoldPercentage = (1 - overallWeight) * 100;
    if (previousFoldPercentage > 0) {
      absoluteActionFrequencies.push({
        color: '#94a3b8',
        percentage: previousFoldPercentage,
        type: 'previous_fold'
      });
    }
    
    // Add current fold percentage (white)
    const currentFoldPercentage = (played[0] || 0) * overallWeight * 100;
    if (currentFoldPercentage > 0) {
      absoluteActionFrequencies.push({
        color: '#ffffff',
        percentage: currentFoldPercentage,
        type: 'current_fold'
      });
    }
    
    // Process non-fold actions (index 1 and beyond)
    played.slice(1).forEach((frequency, actionIndex) => {
      const realIndex = actionIndex + 1; // Adjust for slice
      if (frequency > 0) {
        const action = nodeData.actions?.[realIndex];
        if (!action) return;
        
        const absolutePercentage = frequency * overallWeight * 100;
        let color = '';
        let actionType = '';
        
        switch (action.type) {
          case 'C':
          case 'X':
            color = '#bee1be'; // Green for call/check
            actionType = action.type === 'C' ? 'call' : 'check';
            break;
          case 'R':
          case 'A':
            color = getRaiseColor(realIndex);
            actionType = action.isAllIn ? 'allin' : 'raise';
            break;
          default:
            color = '#94a3b8'; // Grey for unknown
            actionType = 'unknown';
        }
        
        absoluteActionFrequencies.push({
          color,
          percentage: absolutePercentage,
          type: actionType
        });
      }
    });
    
    const totalNonFoldActivePercentage = 
      absoluteActionFrequencies
        .filter(action => action.type !== 'previous_fold' && action.type !== 'current_fold')
        .reduce((sum, action) => sum + action.percentage, 0);
    
    return {
      overallWeight,
      absoluteActionFrequencies,
      totalNonFoldActivePercentage
    };
  }, [getHandData, nodeData, getRaiseColor]);

  // Calculate if we should apply thick borders (when >30% of cells have 0%)
  const shouldApplyThickBorder = React.useMemo(() => {
    let zeroCellCount = 0;
    const totalCells = 169; // 13x13 grid
    
    hands.forEach(row => {
      row.forEach(hand => {
        const renderData = getHandRenderData(hand);
        if (renderData.totalNonFoldActivePercentage === 0) {
          zeroCellCount++;
        }
      });
    });
    
    const zeroPercentage = (zeroCellCount / totalCells) * 100;
    return zeroPercentage > 30;
  }, [hands, getHandRenderData]);
  const getHandPercentages = (hand: string) => {
    const renderData = getHandRenderData(hand);
    const percentage = renderData.totalNonFoldActivePercentage;
    
    // Strict percentage display - no rounding for logical checks
    if (percentage === 0) {
      return "0%";
    } else if (percentage < 1) {
      return `${percentage.toFixed(1)}%`;
    } else {
      return `${Math.round(percentage)}%`;
    }
  };

  const getTooltipInfo = (hand: string) => {
    const renderData = getHandRenderData(hand);
    
    if (renderData.overallWeight === 0) {
      return `${hand}: Not in range`;
    }

    let tooltip = `${hand}\n`;
    tooltip += `Overall Weight: ${(renderData.overallWeight * 100).toFixed(1)}%\n`;
    
    renderData.absoluteActionFrequencies.forEach(actionData => {
      if (actionData.percentage > 0) {
        let actionName = '';
        switch (actionData.type) {
          case 'previous_fold':
            actionName = 'Previously Folded';
            break;
          case 'current_fold':
            actionName = 'Fold';
            break;
          case 'call':
            actionName = 'Call';
            break;
          case 'check':
            actionName = 'Check';
            break;
          case 'raise':
            actionName = 'Raise';
            break;
          case 'allin':
            actionName = 'All-in';
            break;
          default:
            actionName = actionData.type;
        }
        tooltip += `  ${actionName}: ${actionData.percentage.toFixed(1)}%\n`;
      }
    });

    return tooltip.trim();
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Scrollable Grid Container */}
      <div className="flex-1 flex p-1 sm:p-2 lg:p-3 min-h-0">
        <div className="w-full max-w-none h-full overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600 min-h-0 flex flex-col">
          <div className="bg-white rounded-lg overflow-hidden shadow-lg flex-1">
            <div className="grid grid-cols-13 grid-rows-13 gap-0.5 p-1 h-full">
              {hands.map((row, rowIndex) =>
                row.map((hand, colIndex) => {
                  const renderData = getHandRenderData(hand);
                  const percentage = getHandPercentages(hand);
                  const isZeroCell = renderData.totalNonFoldActivePercentage === 0; // Strict equality check
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`cursor-pointer hover:border-purple-500 transition-all duration-200 group relative overflow-hidden min-h-[40px] min-w-[40px] ${
                        isZeroCell 
                          ? `bg-gray-200 opacity-70 ${shouldApplyThickBorder ? 'border-10 border-gray-400' : 'border border-gray-300'}` 
                          : `bg-gray-100 ${shouldApplyThickBorder ? 'border-10 border-black' : 'border border-black'}`
                      }`}
                      title={getTooltipInfo(hand)}
                    >
                      {/* Background layers */}
                      <div className="absolute inset-0 flex">
                        {renderData.absoluteActionFrequencies.map((actionData, index) => (
                          <div
                            key={index}
                            style={{
                              backgroundColor: actionData.color,
                              width: `${actionData.percentage}%`
                            }}
                          />
                        ))}
                      </div>
                      
                      {/* Hand name and percentage - centered */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                        <div className={`font-bold text-sm ${isZeroCell ? 'text-gray-500' : 'text-black'}`}>
                          {hand}
                        </div>
                        <div className={`text-xs font-medium leading-none ${isZeroCell ? 'text-gray-500' : 'text-black'}`}>
                          {percentage}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyGrid;