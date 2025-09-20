import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import JSZip from 'jszip';
import type { NodeData } from '../types/poker';
import type { OptimizedTree } from '../types/optimized-tree';
import type { ProcessingStatus, ProcessingInfo } from '../types/poker';

export interface SettingsData {
  blinds: {
    bb: number;
    sb: number;
    ante: number;
  };
  stacks: number[];
  playerCount: number;
  prizes: { [key: string]: number };
  skipSb: boolean;
  movingBu: boolean;
  eqModelId: string;
  anteType: string;
  straddleType: string;
}

interface PokerSpot {
  id: string;
  name: string;
  description: string;
  settings: SettingsData;
  equity: any;
  zipStoragePath: string | null;
  treeStoragePath: string | null;
  optimizedTreeData?: OptimizedTree;
  createdAt: Date;
  status: ProcessingStatus;
  error_message?: string;
  processing_started_at?: Date;
  processing_completed_at?: Date;
}

interface DataContextType {
  spots: PokerSpot[];
  addSpot: (spot: Omit<PokerSpot, 'id' | 'createdAt'>) => Promise<PokerSpot>;
  getSpot: (id: string) => PokerSpot | undefined;
  fetchFullSpot: (id: string) => Promise<PokerSpot>;
  deleteSpot: (id: string) => Promise<void>;
  updateSpotName: (id: string, newName: string) => Promise<void>;
  importSpot: (zipFile: File, files: { settings: any; equity: any; nodes: { [key: string]: any } }) => Promise<PokerSpot>;
  loadSpots: () => Promise<void>;
  fetchNodeDataFromZip: (spotId: string, zipStoragePath: string, nodeId: string) => Promise<NodeData | null>;
  isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [spots, setSpots] = useState<PokerSpot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const [realtimeChannel, setRealtimeChannel] = useState<any>(null);

  // Cache for parsed JSON file contents to avoid re-downloading
  const zipCache = new Map<string, JSZip>();
  const optimizedTreeCache = new Map<string, OptimizedTree>();

  const processSettingsData = (rawSettings: any): SettingsData => {
    console.log('🔧 processSettingsData - Input rawSettings:', rawSettings);
    const handdata = rawSettings?.handdata || {};
    const eqmodel = rawSettings?.eqmodel || {};
    const structure = eqmodel?.structure || {};
    const blindsArray = handdata?.blinds || [100000, 50000, 0];
    const stacks = handdata?.stacks || [4000000, 4000000];
    
    const processedSettings = {
      blinds: {
        bb: blindsArray[0] || 100000,
        sb: blindsArray[1] || 50000,
        ante: blindsArray[2] || 0
      },
      stacks: stacks,
      playerCount: stacks.length,
      prizes: structure?.prizes || {},
      skipSb: handdata?.skipSb || false,
      movingBu: handdata?.movingBu || false,
      eqModelId: eqmodel?.id || '',
      anteType: handdata?.anteType || 'REGULAR',
      straddleType: handdata?.straddleType || 'OFF'
    };
    
    console.log('🔧 processSettingsData - Output processedSettings:', processedSettings);
    return processedSettings;
  };

  const fetchOptimizedTreeFromStorage = async (treeStoragePath: string): Promise<OptimizedTree | null> => {
    console.log('🌳 fetchOptimizedTreeFromStorage - Fetching tree from path:', treeStoragePath);
    
    try {
      // Check if tree is already cached
      if (optimizedTreeCache.has(treeStoragePath)) {
        console.log('🌳 fetchOptimizedTreeFromStorage - Tree found in cache');
        return optimizedTreeCache.get(treeStoragePath)!;
      }

      console.log('🌳 fetchOptimizedTreeFromStorage - Tree not cached, downloading from storage...');
      
      // Download tree JSON file from storage
      const { data: treeFile, error: downloadError } = await supabase.storage
        .from('poker-spots')
        .download(treeStoragePath);

      if (downloadError || !treeFile) {
        console.error('🌳 fetchOptimizedTreeFromStorage - Failed to download tree:', downloadError);
        return null;
      }

      // Parse the JSON content
      const treeContent = await treeFile.text();
      const optimizedTree = JSON.parse(treeContent) as OptimizedTree;
      
      // Store tree in cache for future use
      optimizedTreeCache.set(treeStoragePath, optimizedTree);
      console.log('🌳 fetchOptimizedTreeFromStorage - Cached tree data');
      
      return optimizedTree;
    } catch (error) {
      console.error('🌳 fetchOptimizedTreeFromStorage - Error:', error);
      return null;
    }
  };

  const loadSpots = async () => {
    console.log('📥 loadSpots - Starting to load spots for user:', user?.id);
    if (!user) return;
    
    console.log('📥 loadSpots - Setting isLoading to true');
    setIsLoading(true);
    try {
      console.log('📥 loadSpots - Making Supabase query...');
      // Optimized query with proper ordering and pagination support
      const { data, error } = await supabase
        .from('poker_spots')
        .select('id, name, description, settings, created_at, processing_status, error_message, processing_started_at, processing_completed_at, zip_storage_path, tree_storage_path')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100); // Add pagination limit to prevent large data fetches

      console.log('📥 loadSpots - Supabase response data:', data);
      console.log('📥 loadSpots - Supabase response error:', error);

      if (error) throw error;

      const formattedSpots: PokerSpot[] = (data || []).map(spot => ({
        id: spot.id,
        name: spot.name,
        description: spot.description,
        settings: processSettingsData(spot.settings),
        equity: {},
        zipStoragePath: spot.zip_storage_path,
        treeStoragePath: spot.tree_storage_path,
        optimizedTreeData: undefined,
        createdAt: new Date(spot.created_at),
        status: spot.processing_status as ProcessingStatus,
        error_message: spot.error_message,
        processing_started_at: spot.processing_started_at ? new Date(spot.processing_started_at) : undefined,
        processing_completed_at: spot.processing_completed_at ? new Date(spot.processing_completed_at) : undefined,
      }));

      console.log('📥 loadSpots - Formatted spots:', formattedSpots);
      console.log('📥 loadSpots - Setting spots state with', formattedSpots.length, 'spots');
      setSpots(formattedSpots);
    } catch (error) {
      console.error('📥 loadSpots - Error occurred:', error);
      console.error('Error loading spots:', error);
    } finally {
      console.log('📥 loadSpots - Setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Setup Realtime subscription for poker_spots updates
  const setupRealtimeSubscription = React.useCallback(() => {
    if (!user || realtimeChannel) return;

    console.log('🔄 Setting up Realtime subscription for user:', user.id);
    
    const channel = supabase
      .channel('poker_spots_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'poker_spots',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Realtime update received:', payload);
          const updatedSpot = payload.new;
          
          setSpots(prevSpots => 
            prevSpots.map(spot => 
              spot.id === updatedSpot.id 
                ? {
                    ...spot,
                    name: updatedSpot.name,
                    status: updatedSpot.processing_status as ProcessingStatus,
                    error_message: updatedSpot.error_message,
                    processing_started_at: updatedSpot.processing_started_at ? new Date(updatedSpot.processing_started_at) : undefined,
                    processing_completed_at: updatedSpot.processing_completed_at ? new Date(updatedSpot.processing_completed_at) : undefined,
                    optimizedTreeData: spot.optimizedTreeData
                  }
                : spot
            )
          );
        }
      )
      .subscribe();

    setRealtimeChannel(channel);
  }, [user, realtimeChannel]);

  // Cleanup Realtime subscription
  const cleanupRealtimeSubscription = React.useCallback(() => {
    if (realtimeChannel) {
      console.log('🔄 Cleaning up Realtime subscription');
      supabase.removeChannel(realtimeChannel);
      setRealtimeChannel(null);
    }
  }, [realtimeChannel]);

  const addSpot = async (spotData: Omit<PokerSpot, 'id' | 'createdAt'>): Promise<PokerSpot> => {
    console.log('➕ addSpot - Starting to add spot for user:', user?.id);
    console.log('➕ addSpot - Input spotData:', spotData);
    if (!user) throw new Error('User must be authenticated');

    // First, upload the ZIP file to storage (expecting zipFile to be passed in spotData)
    const zipFile = (spotData as any).zipFile as File;
    if (!zipFile) {
      throw new Error('ZIP file is required for spot creation');
    }
    
    const zipFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('poker-spots')
      .upload(`zips/${zipFileName}`, zipFile);

    if (uploadError) {
      console.error('➕ addSpot - Failed to upload ZIP:', uploadError);
      throw new Error('Failed to upload spot data');
    }

    // Step 1: Insert the complete spot data with pending status
    console.log('➕ addSpot - Inserting spot into Supabase...');
    const { data, error } = await supabase
      .from('poker_spots')
      .insert({
        user_id: user.id,
        name: spotData.name,
        description: spotData.description,
        settings: spotData.settings,
        equity: spotData.equity,
        zip_storage_path: uploadData.path,
        processing_status: 'pending'
      })
      .select()
      .single();

    console.log('➕ addSpot - Supabase insert response data:', data);
    console.log('➕ addSpot - Supabase insert response error:', error);
    if (error) throw error;

    // Step 2: Processing will be triggered by the database trigger
    // The trigger now adds to processing queue instead of making HTTP calls
    console.log('➕ addSpot - Adding spot to processing queue...');
    // The database trigger will automatically add to queue when nodes are present
    console.log('➕ addSpot - Processing will be triggered by database trigger');

    // Step 3: Wait for processing completion via Realtime (unchanged)
    try {
      console.log('➕ addSpot - Waiting for processing completion via Realtime...');
      
      const processedSpot = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Processing timeout after 60 seconds'));
        }, 60000); // 60 second timeout
        
        const channel = supabase
          .channel(`spot_processing_${data.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'poker_spots',
              filter: `id=eq.${data.id}`
            },
            (payload) => {
              console.log('➕ addSpot - Realtime update received:', payload);
              const updatedSpot = payload.new;
              
              if (updatedSpot.processing_status === 'completed') {
                console.log('➕ addSpot - Processing completed successfully!');
                cleanup();
                resolve(updatedSpot);
              } else if (updatedSpot.processing_status === 'failed') {
                console.log('➕ addSpot - Processing failed:', updatedSpot.error_message);
                cleanup();
                reject(new Error(updatedSpot.error_message || 'Processing failed'));
              }
            }
          )
          .subscribe();
        
        const cleanup = () => {
          clearTimeout(timeout);
          supabase.removeChannel(channel);
        };
      });

      // Create the spot object using the processed data
      console.log('➕ addSpot - Creating newSpot object...');
      
      // Fetch optimized tree data if path exists
      let optimizedTreeData: OptimizedTree | undefined = undefined;
      if (processedSpot.tree_storage_path) {
        const tree = await fetchOptimizedTreeFromStorage(processedSpot.tree_storage_path);
        if (tree) {
          optimizedTreeData = tree;
        }
      }
      
      const newSpot: PokerSpot = {
        id: processedSpot.id,
        name: processedSpot.name,
        description: processedSpot.description,
        settings: processSettingsData(processedSpot.settings),
        equity: processedSpot.equity,
        zipStoragePath: processedSpot.zip_storage_path,
        treeStoragePath: processedSpot.tree_storage_path,
        optimizedTreeData: optimizedTreeData,
        createdAt: new Date(processedSpot.created_at),
        status: processedSpot.processing_status as ProcessingStatus,
        error_message: processedSpot.error_message,
        processing_started_at: processedSpot.processing_started_at ? new Date(processedSpot.processing_started_at) : undefined,
        processing_completed_at: processedSpot.processing_completed_at ? new Date(processedSpot.processing_completed_at) : undefined,
      };

      console.log('➕ addSpot - Created newSpot:', newSpot);
      console.log('➕ addSpot - Current spots state before update:', spots);
      setSpots(prev => [newSpot, ...prev]);
      console.log('➕ addSpot - Updated spots state');
      return newSpot;

    } catch (error) {
      console.error('➕ addSpot - Error during processing:', error);
      
      // If Realtime fails, try client-side fallback
      if (error instanceof Error && error.message.includes('timeout')) {
        console.warn('➕ addSpot - Processing timeout, attempting client-side fallback...');
        
        // First, check if the spot was actually completed on the server
        console.log('➕ addSpot - Checking server status before fallback...');
        const { data: serverStatus, error: statusError } = await supabase
          .from('poker_spots')
          .select('id, name, description, settings, equity, processing_status, error_message, processing_started_at, processing_completed_at, created_at, zip_storage_path, tree_storage_path')
          .eq('id', data.id)
          .single();
        
        if (!statusError && serverStatus) {
          console.log('➕ addSpot - Server status check result:', serverStatus.processing_status);
          
          if (serverStatus.processing_status === 'completed') {
            console.log('➕ addSpot - Server processing already completed, using server result');
            
            // Fetch optimized tree data if path exists
            let optimizedTreeData: OptimizedTree | undefined = undefined;
            if (serverStatus.tree_storage_path) {
              const tree = await fetchOptimizedTreeFromStorage(serverStatus.tree_storage_path);
              if (tree) {
                optimizedTreeData = tree;
              }
            }
            
            const newSpot: PokerSpot = {
              id: serverStatus.id,
              name: serverStatus.name,
              description: serverStatus.description,
              settings: processSettingsData(serverStatus.settings),
              equity: serverStatus.equity,
              zipStoragePath: serverStatus.zip_storage_path,
              treeStoragePath: serverStatus.tree_storage_path,
              optimizedTreeData: optimizedTreeData,
              createdAt: new Date(serverStatus.created_at),
              status: serverStatus.processing_status as ProcessingStatus,
              error_message: serverStatus.error_message,
              processing_started_at: serverStatus.processing_started_at ? new Date(serverStatus.processing_started_at) : undefined,
              processing_completed_at: serverStatus.processing_completed_at ? new Date(serverStatus.processing_completed_at) : undefined,
            };

            setSpots(prev => [newSpot, ...prev]);
            return newSpot;
          } else if (serverStatus.processing_status === 'failed') {
            console.log('➕ addSpot - Server processing failed:', serverStatus.error_message);
            throw new Error(serverStatus.error_message || 'Processing failed on server');
          }
          
          // If status is still 'processing' or 'pending', continue with client-side fallback
          console.log('➕ addSpot - Server still processing, proceeding with client-side fallback');
        } else {
          console.warn('➕ addSpot - Could not check server status, proceeding with client-side fallback');
        }
        
        // Process the raw settings to get the correct structure
        const processedSettingsForFallback = processSettingsData(spotData.settings);
        
        // For now, just throw the timeout error - server-side processing is required
        throw new Error('Processing timeout - please try again');
        
        // Fetch the final result
        const { data: finalData, error: finalError } = await supabase
          .from('poker_spots')
          .select('*, processing_status, error_message, processing_started_at, processing_completed_at, zip_storage_path, tree_storage_path')
          .eq('id', data.id)
          .single();
        
        if (finalError) {
          throw new Error('Failed to retrieve final processed data');
        }
        
        console.log('➕ addSpot - Client-side fallback completed successfully');
        
        // Fetch optimized tree data if path exists
        let optimizedTreeData: OptimizedTree | undefined = undefined;
        if (finalData.tree_storage_path) {
          const tree = await fetchOptimizedTreeFromStorage(finalData.tree_storage_path);
          if (tree) {
            optimizedTreeData = tree;
          }
        }
        
        // Create the spot object using the processed data
        const newSpot: PokerSpot = {
          id: finalData.id,
          name: finalData.name,
          description: finalData.description,
          settings: processSettingsData(finalData.settings),
          equity: finalData.equity,
          zipStoragePath: finalData.zip_storage_path,
          treeStoragePath: finalData.tree_storage_path,
          optimizedTreeData: optimizedTreeData,
          createdAt: new Date(finalData.created_at),
          status: finalData.processing_status as ProcessingStatus,
          error_message: finalData.error_message,
          processing_started_at: finalData.processing_started_at ? new Date(finalData.processing_started_at) : undefined,
          processing_completed_at: finalData.processing_completed_at ? new Date(finalData.processing_completed_at) : undefined,
        };

        setSpots(prev => [newSpot, ...prev]);
        return newSpot;
      }
      
      // Clean up the created spot if processing fails
      try {
        await supabase
          .from('poker_spots')
          .delete()
          .eq('id', data.id);
        console.log('➕ addSpot - Cleaned up failed spot');
      } catch (cleanupError) {
        console.error('➕ addSpot - Failed to clean up spot:', cleanupError);
      }
      
      throw error;
    }
  };

  const deleteSpot = async (id: string): Promise<void> => {
    console.log('🗑️ deleteSpot - Starting to delete spot:', id, 'for user:', user?.id);
    if (!user) throw new Error('User must be authenticated');

    console.log('🗑️ deleteSpot - Making Supabase delete call...');
    const { error } = await supabase
      .from('poker_spots')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Ensure user can only delete their own spots

    console.log('🗑️ deleteSpot - Supabase delete response error:', error);
    if (error) throw error;

    // Remove from local state
    console.log('🗑️ deleteSpot - Current spots state before removal:', spots);
    setSpots(prev => prev.filter(spot => spot.id !== id));
    console.log('🗑️ deleteSpot - Updated spots state after removal');
  };

  const updateSpotName = async (id: string, newName: string): Promise<void> => {
    console.log('✏️ updateSpotName - Starting to update spot name:', id, 'to:', newName, 'for user:', user?.id);
    if (!user) throw new Error('User must be authenticated');
    
    // Validate input
    if (!newName || typeof newName !== 'string') {
      throw new Error('Spot name is required');
    }
    
    const trimmedName = newName.trim();
    console.log('✏️ updateSpotName - Trimmed name:', trimmedName);
    if (trimmedName.length === 0) {
      throw new Error('Spot name cannot be empty');
    }
    
    if (trimmedName.length > 100) {
      throw new Error('Spot name cannot exceed 100 characters');
    }

    console.log('✏️ updateSpotName - Making Supabase update call...');
    const { error } = await supabase
      .from('poker_spots')
      .update({ name: trimmedName })
      .eq('id', id)
      .eq('user_id', user.id); // Ensure user can only update their own spots

    console.log('✏️ updateSpotName - Supabase update response error:', error);
    if (error) throw error;

    // Update local state
    console.log('✏️ updateSpotName - Current spots state before update:', spots);
    setSpots(prev => prev.map(spot => 
      spot.id === id ? { ...spot, name: trimmedName } : spot
    ));
    console.log('✏️ updateSpotName - Updated spots state after name change');
  };

  const getSpot = (id: string) => {
    console.log('🔍 getSpot - Looking for spot with id:', id);
    const foundSpot = spots.find(spot => spot.id === id);
    console.log('🔍 getSpot - Found spot:', foundSpot);
    return foundSpot;
  };

  const fetchFullSpot = async (id: string): Promise<PokerSpot> => {
    console.log('🔍 fetchFullSpot - Fetching full spot data for id:', id);
    if (!user) throw new Error('User must be authenticated');

    // Optimized query using the composite index
    const { data, error } = await supabase
      .from('poker_spots')
      .select('*, processing_status, error_message, processing_started_at, processing_completed_at, zip_storage_path, tree_storage_path')
      .eq('id', id)
      .eq('user_id', user.id) // This will use the poker_spots_user_status_idx composite index
      .single();

    console.log('🔍 fetchFullSpot - Supabase response data:', data);
    console.log('🔍 fetchFullSpot - Supabase response error:', error);

    if (error) throw error;
    if (!data) throw new Error('Spot not found');

    // Fetch optimized tree data if path exists
    let optimizedTreeData: OptimizedTree | undefined = undefined;
    if (data.tree_storage_path) {
      const tree = await fetchOptimizedTreeFromStorage(data.tree_storage_path);
      if (tree) {
        optimizedTreeData = tree;
      }
    }

    const fullSpot: PokerSpot = {
      id: data.id,
      name: data.name,
      description: data.description,
      settings: processSettingsData(data.settings),
      equity: data.equity,
      zipStoragePath: data.zip_storage_path,
      treeStoragePath: data.tree_storage_path,
      optimizedTreeData: optimizedTreeData,
      createdAt: new Date(data.created_at),
      status: data.processing_status as ProcessingStatus,
      error_message: data.error_message,
      processing_started_at: data.processing_started_at ? new Date(data.processing_started_at) : undefined,
      processing_completed_at: data.processing_completed_at ? new Date(data.processing_completed_at) : undefined,
    };

    console.log('🔍 fetchFullSpot - Formatted full spot:', fullSpot);
    return fullSpot;
  };

  const importSpot = async (zipFile: File, files: { settings: any; equity: any; nodes: { [key: string]: any } }): Promise<PokerSpot> => {
    console.log('📦 importSpot - Starting import with zipFile:', zipFile.name, 'and files:', files);
    const processedSettings = processSettingsData(files.settings);
    console.log('📦 importSpot - Processed settings:', processedSettings);
    
    // Generate a descriptive name based on the actual data
    const nodeCount = Object.keys(files.nodes).length;
    const playerCount = processedSettings.playerCount;
    const bbSize = processedSettings.blinds.bb;
    console.log('📦 importSpot - Extracted data - nodeCount:', nodeCount, 'playerCount:', playerCount, 'bbSize:', bbSize);
    
    // Try to extract a meaningful name from settings if available
    const spotName = files.settings?.name || 
                    files.settings?.handdata?.name || 
                    `${playerCount}P ${(bbSize/1000).toFixed(0)}k BB Spot`;
    
    const description = files.settings?.description || 
                       `Imported spot with ${nodeCount} nodes - ${(bbSize/1000).toFixed(0)}k/${(processedSettings.blinds.sb/1000).toFixed(0)}k blinds, ${playerCount} players`;
    
    console.log('📦 importSpot - Generated name:', spotName, 'description:', description);
    
    const spotData = {
      name: spotName,
      description: description,
      settings: files.settings,
      equity: files.equity,
      nodes: files.nodes,
      zipStoragePath: null,
      zipFile: zipFile
    };
    
    console.log('📦 importSpot - Final spotData before addSpot:', spotData);
    return await addSpot(spotData);
  };

  useEffect(() => {
    console.log('🔄 useEffect - User changed:', user);
    if (user) {
      console.log('🔄 useEffect - User exists, calling loadSpots');
      loadSpots();
      setupRealtimeSubscription();
    } else {
      console.log('🔄 useEffect - No user, clearing spots');
      setSpots([]);
      cleanupRealtimeSubscription();
    }
  }, [user, setupRealtimeSubscription, cleanupRealtimeSubscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRealtimeSubscription();
    };
  }, [cleanupRealtimeSubscription]);

  const fetchNodeDataFromZip = async (spotId: string, zipStoragePath: string, nodeId: string): Promise<NodeData | null> => {
    console.log('🔍 fetchNodeDataFromZip - Fetching node data for:', { spotId, zipStoragePath, nodeId });
    
    try {
      // Check if ZIP is already cached
      let zip = zipCache.get(zipStoragePath);
      
      if (!zip) {
        console.log('🔍 fetchNodeDataFromZip - ZIP not cached, downloading from storage...');
        
        // Download ZIP file from storage
        const { data: zipFile, error: downloadError } = await supabase.storage
          .from('poker-spots')
          .download(zipStoragePath);

        if (downloadError || !zipFile) {
          console.error('🔍 fetchNodeDataFromZip - Failed to download ZIP:', downloadError);
          return null;
        }

        // Load ZIP file with JSZip
        const arrayBuffer = await zipFile.arrayBuffer();
        zip = new JSZip();
        await zip.loadAsync(arrayBuffer);
        
        // Store ZIP in cache for future use
        zipCache.set(zipStoragePath, zip);
        console.log('🔍 fetchNodeDataFromZip - Cached ZIP data');
      }
      
      // Extract the specific node file from the ZIP
      const nodeFileName = `nodes/${nodeId}.json`;
      const nodeFile = zip.file(nodeFileName);
      
      if (nodeFile) {
        console.log('🔍 fetchNodeDataFromZip - Found node file:', nodeFileName);
        const nodeContent = await nodeFile.async('text');
        const nodeData = JSON.parse(nodeContent);
        return nodeData as NodeData;
      }
      
      console.warn('🔍 fetchNodeDataFromZip - Node file not found in ZIP for nodeId:', nodeId);
      return null;
    } catch (error) {
      console.error('🔍 fetchNodeDataFromZip - Error:', error);
      return null;
    }
  };

  const value = {
    spots,
    addSpot,
    deleteSpot,
    updateSpotName,
    getSpot,
    fetchFullSpot,
    importSpot,
    loadSpots,
    fetchNodeDataFromZip,
    isLoading
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};