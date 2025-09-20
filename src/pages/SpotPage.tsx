import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { ArrowLeft, Pencil, Check, X, Menu } from 'lucide-react';
import StrategyGrid from '../components/StrategyGrid';
import TopNavigation from '../components/TopNavigation';
import PokerTablePreview from '../components/PokerTablePreview';
import PrizeStructure from '../components/PrizeStructure';
import DynamicLegend from '../components/DynamicLegend';
import HierarchicalMenu from '../components/HierarchicalMenu';
import { CompactTreeNavigator } from '../utils/compact-tree-navigator';
import type { CompactTreeNode, BreadcrumbItem } from '../types/optimized-tree';
import type { NodeData } from '../types/poker';

const SpotPage: React.FC = () => {
  const { spotId } = useParams<{ spotId: string }>();
  const { fetchFullSpot, updateSpotName, fetchNodeDataFromZip } = useData();
  const navigate = useNavigate();
  const [spot, setSpot] = useState<any>(null);
  const [isLoadingSpot, setIsLoadingSpot] = useState(true);
  const [currentNode, setCurrentNode] = useState('0');
  const [navigationPath, setNavigationPath] = useState<CompactTreeNode[]>([]);
  const [CNodeData, setCNodeData] = useState<NodeData | null>(null);
  const [isLoadingNodeData, setIsLoadingNodeData] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Effect to fetch full spot data when spotId changes
  useEffect(() => {
    const loadFullSpot = async () => {
      if (!spotId) {
        navigate('/profile');
        return;
      }

      setIsLoadingSpot(true);
      try {
        console.log('🔍 SpotPage - Starting to fetch full spot for spotId:', spotId);
        const fullSpot = await fetchFullSpot(spotId);
        console.log('🔍 SpotPage - Received fullSpot:', fullSpot);
        console.log('🔍 SpotPage - fullSpot.optimizedTreeData:', fullSpot.optimizedTreeData);
        console.log('🔍 SpotPage - fullSpot.zipStoragePath:', fullSpot.zipStoragePath);
        console.log('🔍 SpotPage - fullSpot.treeStoragePath:', fullSpot.treeStoragePath);
        setSpot(fullSpot);
        console.log('🔍 SpotPage - Set spot state with fullSpot');
      } catch (error) {
        console.error('Failed to load spot:', error);
        navigate('/profile');
      } finally {
        setIsLoadingSpot(false);
      }
    };

    loadFullSpot();
  }, [spotId, fetchFullSpot, navigate]);

  // Effect to read currentNode from URL on load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nodeId = params.get('node') || '0';
    setCurrentNode(nodeId);
  }, [location.search]);

  // Effect to update URL when currentNode changes
  useEffect(() => {
    if (currentNode !== '0') {
      navigate(`?node=${currentNode}`, { replace: true });
    } else {
      navigate('', { replace: true });
    }
  }, [currentNode, navigate]);

  const buildNavigationPath = (nodeId: string): CompactTreeNode[] => {
    if (!spot?.optimizedTreeData) return [];
    
    const navigator = new CompactTreeNavigator(spot.optimizedTreeData);
    const breadcrumbs = navigator.getBreadcrumbs(nodeId);
    
    // Convert breadcrumbs to CompactTreeNode array
    const path: CompactTreeNode[] = [];
    breadcrumbs.forEach(breadcrumb => {
      const node = spot.optimizedTreeData!.nodes[breadcrumb.nodeId];
      if (node) {
        path.push(node);
      }
    });
    
    // Add current node if not already included
    const currentNodeObj = spot.optimizedTreeData!.nodes[nodeId];
    if (currentNodeObj && !path.find(n => n.id === nodeId)) {
      path.push(currentNodeObj);
    }
    
    return path;
  };

  // Update navigation path when current node or spot changes
  useEffect(() => {
    if (spot?.optimizedTreeData) {
      const newPath = buildNavigationPath(currentNode);
      setNavigationPath(newPath);
    }
  }, [currentNode, spot?.optimizedTreeData]);

  // Effect to fetch NodeData when currentNode changes
  useEffect(() => {
    const fetchCurrentNodeData = async () => {
      if (!spot || !spot.zipStoragePath || !currentNode) {
        console.log('🔍 SpotPage - Skipping node data fetch:', {
          hasSpot: !!spot,
          hasZipStoragePath: !!spot?.zipStoragePath,
          currentNode: currentNode
        });
        setCNodeData(null);
        setIsLoadingNodeData(false);
        return;
      }

      console.log('🔍 SpotPage - Fetching node data for:', currentNode);
      setIsLoadingNodeData(true);
      
      try {
        const nodeData = await fetchNodeDataFromZip(spot.id, spot.zipStoragePath, currentNode);
        console.log('🔍 SpotPage - Received nodeData for node', currentNode, ':', nodeData);
        setCNodeData(nodeData);
        console.log('🔍 SpotPage - Successfully fetched node data:', nodeData ? 'Found' : 'Not found');
      } catch (error) {
        console.error('🔍 SpotPage - Failed to fetch node data:', error);
        setCNodeData(null);
      } finally {
        setIsLoadingNodeData(false);
      }
    };

    fetchCurrentNodeData();
  }, [currentNode, spot, fetchNodeDataFromZip]);

  const handleStartRename = () => {
    setEditingName(spot?.name || '');
    setIsEditingName(true);
  };

  const handleSaveRename = async () => {
    if (!spot || !editingName.trim()) return;
    
    setIsUpdatingName(true);
    try {
      await updateSpotName(spot.id, editingName.trim());
      setSpot(prev => prev ? { ...prev, name: editingName.trim() } : null);
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update spot name:', error);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleCancelRename = () => {
    setIsEditingName(false);
    setEditingName('');
  };

  // Helper function to get position names
  const getPositionNames = (playerCount: number): string[] => {
    if (playerCount === 2) return ['SB', 'BB'];
    if (playerCount === 3) return ['BU', 'SB', 'BB'];
    if (playerCount === 4) return ['CO', 'BU', 'SB', 'BB'];
    if (playerCount === 5) return ['HJ', 'CO', 'BU', 'SB', 'BB'];
    if (playerCount === 6) return ['MP', 'HJ', 'CO', 'BU', 'SB', 'BB'];
    return ['SB', 'BB'];
  };

  // Helper function to format action labels
  const formatActionLabel = (actionType: string, amount: number, settings: any): string => {
    const formatBB = (amt: number) => {
      const bb = amt / settings.blinds.bb;
      return bb % 1 === 0 ? `${bb}BB` : `${bb.toFixed(1)}BB`;
    };

    switch (actionType) {
      case 'F': return 'Fold';
      case 'C': return 'Call';
      case 'X': return 'Check';
      case 'R': return amount > 0 ? `Raise ${formatBB(amount)}` : 'Raise';
      case 'A': return 'All-in';
      default: return actionType;
    }
  };

  // Helper function to get action title for a node
  const getNodeActionTitle = (node: CompactTreeNode): string => {
    if (node.id === spot?.optimizedTreeData?.root) {
      return 'Root';
    }
    
    // Find parent node and the action that led to this node
    if (node.p) {
      const parentNode = spot?.optimizedTreeData?.nodes[node.p];
      if (parentNode) {
        const actionToChild = parentNode.a.find(action => action.n === node.id);
        if (actionToChild) {
          return formatActionLabel(actionToChild.t, actionToChild.amt || 0, spot.settings);
        }
      }
    }
    
    return `Player ${node.pl}`;
  };

  // Helper function to get player position
  const getNodePlayerPosition = (node: CompactTreeNode): string => {
    const positions = getPositionNames(spot?.settings?.playerCount || 2);
    return positions[node.pl] || `P${node.pl}`;
  };

  // Add action titles and player positions to navigation path
  const enrichedNavigationPath = navigationPath.map(node => ({
    ...node,
    actionTitle: getNodeActionTitle(node),
    playerPosition: getNodePlayerPosition(node)
  }));

  const handlePositionClick = (playerIndex: number) => {
    console.log('🎯 handlePositionClick - Looking for opening action for player:', playerIndex);
    
    if (spot?.optimizedTreeData?.meta?.openingActions) {
      const targetNodeId = spot.optimizedTreeData.meta.openingActions[playerIndex];
      
      if (targetNodeId) {
        console.log('🎯 handlePositionClick - Found opening action node:', targetNodeId, 'for player', playerIndex);
        
        // Check if current node is already the target
        if (currentNode === targetNodeId) {
          console.log('🎯 handlePositionClick - Already at target node for player:', playerIndex);
          return;
        }
        
        console.log('🎯 handlePositionClick - Navigating to opening action node:', targetNodeId);
        setCurrentNode(targetNodeId);
      } else {
        console.warn('🎯 handlePositionClick - No opening action found for player:', playerIndex);
      }
    } else {
      console.warn('🎯 handlePositionClick - No opening actions available in tree metadata');
    }
  };

  if (isLoadingSpot || !spot) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full"></div>
          <div className="text-white text-lg">Loading spot...</div>
        </div>
      </div>
    );
  }

  const optimizedTree = spot.optimizedTreeData;
  if (!optimizedTree) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div>Error: Optimized tree not available. Please try re-importing this spot.</div>
      </div>
    );
  }

  const compactCurrentNode = spot.optimizedTreeData.nodes[currentNode];

  // Final data check before rendering
  console.log('🔍 SpotPage - Final render data check:', {
    hasSpot: !!spot,
    hasOptimizedTreeData: !!spot?.optimizedTreeData,
    optimizedTreeNodeCount: spot?.optimizedTreeData ? Object.keys(spot.optimizedTreeData.nodes).length : 0,
    currentNode: currentNode,
    hasCompactCurrentNode: !!compactCurrentNode,
    hasCNodeData: !!CNodeData,
    isLoadingNodeData: isLoadingNodeData,
    navigationPathLength: navigationPath.length
  });

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Navigation */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/profile')} 
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          {/* Mobile menu toggle */}
          <button 
            onClick={() => setIsMenuOpen(true)} 
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          {/* Spot Name Editing */}
          {isEditingName ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="bg-slate-800 text-white px-3 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') handleCancelRename();
                }}
              />
              <button
                onClick={handleSaveRename}
                disabled={isUpdatingName}
                className="text-green-400 hover:text-green-300 disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={handleCancelRename}
                disabled={isUpdatingName}
                className="text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white">{spot.name}</h1>
              <button
                onClick={handleStartRename}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top Navigation - Only render when optimizedTreeData is available */}
      {spot?.optimizedTreeData && (
        <TopNavigation 
          navigationPath={enrichedNavigationPath} 
          currentNodeId={currentNode}
          onNodeChange={setCurrentNode}
          optimizedTree={spot.optimizedTreeData}
          settings={spot.settings}
        />
      )}

      {/* Main Content - Asymmetric Two Column Layout */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Strategy Grid - Full Width */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          <div className="w-full lg:w-4/5 bg-black flex-1 flex flex-col min-h-0">
            {isLoadingNodeData ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full"></div>
                  <div className="text-white text-lg">Loading node data...</div>
                </div>
              </div>
            ) : CNodeData ? (
              <StrategyGrid
                nodeData={CNodeData}
                equity={spot.equity}
                settings={spot.settings}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-white text-lg">No data available for this node</div>
              </div>
            )}
          </div>
          <div className="w-full lg:w-1/5 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-3 sm:p-4 flex-shrink-0 flex flex-col">
            {CNodeData && spot?.optimizedTreeData && (
              <div className="mb-2 sm:mb-3 flex-shrink-0">
                <DynamicLegend nodeData={CNodeData} settings={spot.settings} />
              </div>
            )}
            {CNodeData && spot?.optimizedTreeData && compactCurrentNode && (
              <div className="flex-1 flex flex-col justify-center min-h-0">
                <PokerTablePreview
                  settings={spot.settings}
                  currentNode={CNodeData}
                  onPositionClick={handlePositionClick}
                  optimizedTree={spot.optimizedTreeData}
                  compactCurrentNode={compactCurrentNode}
                  navigationPath={enrichedNavigationPath}
                />
              </div>
            )}
            <div className="flex-shrink-0 mt-2 sm:mt-3">
              <PrizeStructure settings={spot.settings} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Hierarchical Menu Modal */}
      {isMenuOpen && spot?.optimizedTreeData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex lg:hidden">
          <div className="w-full max-w-sm bg-slate-900 h-full">
            <HierarchicalMenu
              optimizedTree={spot.optimizedTreeData}
              currentNodeId={currentNode}
              onNodeChange={setCurrentNode}
              settings={spot.settings}
              onClose={() => setIsMenuOpen(false)}
            />
          </div>
          <div className="flex-1" onClick={() => setIsMenuOpen(false)}></div>
        </div>
      )}
    </div>
  );
};

export default SpotPage;