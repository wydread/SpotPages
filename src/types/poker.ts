interface NodeAction {
  type: string;
  amount: number;
  node?: number;
  isAllIn?: boolean;
}

interface HandData {
  weight: number;
  played: number[];
  evs: number[];
}

interface ExtendedHandData extends HandData {
  // Additional fields that might be present in HRC output
  regrets?: number[];
  strategies?: number[];
  cfValues?: number[];
}
export interface NodeData {
  player: number;
  street: number;
  children: number;
  sequence: Array<{
    player: number;
    type: string;
    amount: number;
    street: number;
  }>;
  actions: NodeAction[];
  hands: { [hand: string]: HandData | ExtendedHandData };
  // Additional node-level data that might be useful for training
  nodeEquity?: number;
  exploitability?: number;
  gameValue?: number;
}

export interface ProcessedNode extends NodeData {
  id: string;
  parentId?: string;
  childrenIds: string[];
  depth: number;
  actionTitle: string;
  playerPosition: string;
}

// Lightweight version for processed_nodes_data storage
export interface LightweightProcessedNode {
  id: string;
  parentId?: string;
  childrenIds: string[];
  depth: number;
  actionTitle: string;
  playerPosition: string;
  actions: NodeAction[];
}

export interface LightweightNodeHierarchy {
  rootNodes: LightweightProcessedNode[];
  allNodes: { [id: string]: LightweightProcessedNode };
  nodesByParent: { [parentId: string]: LightweightProcessedNode[] };
  openingActions: { [playerIndex: number]: string };
}

// Processing status types
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProcessingInfo {
  status: ProcessingStatus;
  error_message?: string;
  processing_started_at?: string;
  processing_completed_at?: string;
}

export interface NodeHierarchy {
  rootNodes: ProcessedNode[];
  allNodes: { [id: string]: ProcessedNode };
  nodesByParent: { [parentId: string]: ProcessedNode[] };
  openingActions: { [playerIndex: number]: string };
}