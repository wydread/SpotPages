import React from 'react';
import { Trophy, Award, Medal } from 'lucide-react';
import type { SettingsData } from '../contexts/DataContext';

interface PrizeStructureProps {
  settings: SettingsData;
}

const PrizeStructure: React.FC<PrizeStructureProps> = ({ settings }) => {
  // Guard against undefined settings
  if (!settings) {
    return (
      <div className="space-y-3">
        <h3 className="text-base sm:text-lg font-semibold text-white flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
          Prize Structure
        </h3>
        
        <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6 border border-slate-700 text-center">
          <Trophy className="w-8 sm:w-12 h-8 sm:h-12 text-slate-500 mx-auto mb-2 sm:mb-3" />
          <div className="text-slate-400 text-xs sm:text-sm">
            Loading prize structure...
          </div>
        </div>
      </div>
    );
  }

  const formatBB = (amount: number) => {
    const bb = amount / settings.blinds.bb;
    return bb % 1 === 0 ? `${bb} BB` : `${bb.toFixed(1)} BB`;
  };

  const prizes = Object.entries(settings.prizes);
  const totalPrizePool = Object.values(settings.prizes).reduce((sum, prize) => sum + prize, 0);
  
  // Limit to maximum 6 prizes to prevent overflow
  const displayedPrizes = prizes.slice(0, 6);
  const hasMorePrizes = prizes.length > 6;

  const getPlaceIcon = (place: string) => {
    if (place === '1') return <Trophy className="w-4 h-4 text-yellow-400" />;
    if (place === '2') return <Award className="w-4 h-4 text-slate-300" />;
    if (place === '3') return <Medal className="w-4 h-4 text-amber-600" />;
    return <div className="w-4 h-4 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white">{place}</div>;
  };

  const getPlaceName = (place: string) => {
    if (place === '1') return '1st';
    if (place === '2') return '2nd';
    if (place === '3') return '3rd';
    return `${place}th`;
  };

  if (prizes.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
          Prize Structure
        </h3>
        
        <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6 border border-slate-700 text-center">
          <Trophy className="w-8 sm:w-12 h-8 sm:h-12 text-slate-500 mx-auto mb-2 sm:mb-3" />
          <div className="text-slate-400 text-xs sm:text-sm">
            No prize structure defined in this spot
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-xl p-3 sm:p-4 border border-slate-700 shadow-lg">
        <div className="space-y-4">
          {displayedPrizes.map(([place, prize]) => (
            <div key={place} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getPlaceIcon(place)}
                <span className="text-white font-semibold text-base sm:text-lg">{getPlaceName(place)} Place</span>
              </div>
              <div className="text-right">
                <div className="text-white-400 font-bold text-base sm:text-lg">${prize.toLocaleString()}</div>
                <div className="text-slate-400 text-sm">
                  {totalPrizePool > 0 ? `${((prize / totalPrizePool) * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>
            </div>
          ))}
          
          {hasMorePrizes && (
            <div className="text-center text-slate-400 text-sm pt-2 border-t border-slate-600">
              +{prizes.length - 6} more prizes
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrizeStructure;