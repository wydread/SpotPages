// Optimized Tree Schema - Significantly Reduced Size

export interface CompactTreeNode {
  /** Unique identifier for the node */
  id: string
  
  /** Parent node ID, null for root */
  p: string | null
  
  /** Active player at this node (0-based index) */
  pl: number
  
  /** Betting street (0=preflop, 1=flop, 2=turn, 3=river) */
  s: number
  
  /** Available actions from this node - compact format */
  a: CompactAction[]
  
  /** Depth in the tree (0 for root) */
  d: number
  
  /** Flags: bit 0=isTerminal, bit 1=hasHandData */
  f: number
}

export interface CompactAction {
  /** Action type (F=fold, C=call, R=raise, X=check) */
  t: string
  
  /** Bet/raise amount (0 for fold/check) */
  amt?: number
  
  /** Target node ID (if action leads to another node) */
  n?: string
}

export interface OptimizedTree {
  /** All nodes indexed by ID - using compact format */
  nodes: Record<string, CompactTreeNode>
  
  /** Root node ID */
  root: string
  
  /** Metadata separated from core structure */
  meta: TreeMetadata
}

export interface TreeMetadata {
  /** Total number of nodes */
  totalNodes: number
  
  /** Number of terminal nodes */
  terminalNodes: number
  
  /** Maximum depth of the tree */
  maxDepth: number
  
  /** Number of players in the game */
  playerCount: number
  
  /** Opening actions - maps player index to their first action node ID */
  openingActions: { [playerIndex: number]: string }
  
  /** Generation timestamp */
  generatedAt: string
  
  /** Tree format version */
  version: string
}

// Navigation utilities adapted for compact format
export interface CompactNavigationPath {
  /** Current node ID */
  current: string
  
  /** Breadcrumb trail - computed on demand */
  breadcrumbs?: BreadcrumbItem[]
  
  /** Available next actions - computed on demand */
  actions?: NavigationAction[]
}

export interface BreadcrumbItem {
  /** Node ID */
  nodeId: string
  
  /** Display label */
  label: string
  
  /** Player who acted */
  player: number
  
  /** Action taken */
  action: string
}

export interface NavigationAction {
  /** Action label for UI */
  label: string
  
  /** Target node ID */
  targetNode: string
  
  /** Action type */
  type: string
  
  /** Action amount */
  amount: number
}

// Utility functions for working with compact format
export class CompactTreeUtils {
  /**
   * Check if node is terminal using bit flags
   */
  static isTerminal(node: CompactTreeNode): boolean {
    return (node.f & 1) === 1
  }

  /**
   * Check if node has hand data using bit flags
   */
  static hasHandData(node: CompactTreeNode): boolean {
    return (node.f & 2) === 2
  }

  /**
   * Set terminal flag
   */
  static setTerminal(node: CompactTreeNode, isTerminal: boolean): void {
    if (isTerminal) {
      node.f |= 1
    } else {
      node.f &= ~1
    }
  }

  /**
   * Set hand data flag
   */
  static setHandData(node: CompactTreeNode, hasHandData: boolean): void {
    if (hasHandData) {
      node.f |= 2
    } else {
      node.f &= ~2
    }
  }

  /**
   * Convert compact node to full format for display
   */
  static expandNode(compact: CompactTreeNode): TreeNode {
    return {
      id: compact.id,
      parentId: compact.p,
      player: compact.pl,
      street: compact.s,
      sequence: [], // Computed on demand from parent chain
      actions: compact.a.map(a => ({
        type: a.t,
        amount: a.amt || 0,
        ...(a.n && { node: a.n })
      })),
      children: compact.a.filter(a => a.n).map(a => a.n!),
      depth: compact.d,
      path: '', // Computed on demand
      isTerminal: this.isTerminal(compact),
      hasHandData: this.hasHandData(compact)
    }
  }

  /**
   * Convert full node to compact format
   */
  static compactNode(full: TreeNode): CompactTreeNode {
    const compact: CompactTreeNode = {
      id: full.id,
      p: full.parentId,
      pl: full.player,
      s: full.street,
      a: full.actions.map(action => {
        const compactAction: CompactAction = { t: action.type }
        if (action.amount > 0) compactAction.amt = action.amount
        if (action.node) compactAction.n = action.node
        return compactAction
      }),
      d: full.depth,
      f: 0
    }

    this.setTerminal(compact, full.isTerminal)
    this.setHandData(compact, full.hasHandData)

    return compact
  }
}

// Legacy TreeNode interface for backward compatibility
export interface TreeNode {
  id: string
  parentId: string | null
  player: number
  street: number
  sequence: ActionSequence[]
  actions: NodeAction[]
  children: string[]
  depth: number
  path: string
  isTerminal: boolean
  hasHandData: boolean
}

export interface ActionSequence {
  player: number
  type: string
  amount: number
  street: number
}

export interface NodeAction {
  type: string
  amount: number
  node?: string
}