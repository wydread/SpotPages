import type { 
  OptimizedTree, 
  CompactTreeNode, 
  CompactNavigationPath, 
  BreadcrumbItem, 
  NavigationAction,
} from '../types/optimized-tree'

export class CompactTreeNavigator {
  private tree: OptimizedTree
  private nodeCache: Map<string, CompactTreeNode> = new Map()
  private pathCache: Map<string, string> = new Map()
  private breadcrumbCache: Map<string, BreadcrumbItem[]> = new Map()

  constructor(tree: OptimizedTree) {
    this.tree = tree
    this.buildCache()
  }

  private buildCache(): void {
    Object.entries(this.tree.nodes).forEach(([id, node]) => {
      this.nodeCache.set(id, node)
    })
  }

  /**
   * Get navigation data for a specific node - lazy loading approach
   */
  getNavigationPath(nodeId: string, includeBreadcrumbs = false, includeActions = false): CompactNavigationPath | null {
    const node = this.nodeCache.get(nodeId)
    if (!node) return null

    const path: CompactNavigationPath = {
      current: nodeId
    }

    if (includeBreadcrumbs) {
      path.breadcrumbs = this.getBreadcrumbs(nodeId)
    }

    if (includeActions) {
      path.actions = this.getAvailableActions(nodeId)
    }

    return path
  }

  /**
   * Build breadcrumb trail - cached for performance
   */
  getBreadcrumbs(nodeId: string): BreadcrumbItem[] {
    if (this.breadcrumbCache.has(nodeId)) {
      return this.breadcrumbCache.get(nodeId)!
    }

    const breadcrumbs: BreadcrumbItem[] = []
    let currentNode = this.nodeCache.get(nodeId)

    while (currentNode && currentNode.p) {
      const parentNode = this.nodeCache.get(currentNode.p)
      if (!parentNode) break

      // Find the action that led to current node
      const actionToChild = parentNode.a.find(action => action.n === currentNode!.id)
      
      if (actionToChild) {
        breadcrumbs.unshift({
          nodeId: currentNode.p,
          label: this.formatActionLabel(actionToChild.t, actionToChild.amt || 0),
          player: parentNode.pl,
          action: actionToChild.t
        })
      }

      currentNode = parentNode
    }

    // Add root
    if (currentNode && !currentNode.p) {
      breadcrumbs.unshift({
        nodeId: currentNode.id,
        label: 'Start',
        player: currentNode.pl,
        action: 'ROOT'
      })
    }

    this.breadcrumbCache.set(nodeId, breadcrumbs)
    return breadcrumbs
  }

  /**
   * Get available actions from current node
   */
  private getAvailableActions(nodeId: string): NavigationAction[] {
    const node = this.nodeCache.get(nodeId)
    if (!node) return []

    return node.a
      .filter(action => action.n) // Only actions that lead to other nodes
      .map(action => ({
        label: this.formatActionLabel(action.t, action.amt || 0),
        targetNode: action.n!,
        type: action.t,
        amount: action.amt || 0
      }))
  }

  /**
   * Navigate to a specific node by following a path of actions
   */
  navigateByPath(startNodeId: string, actionTypes: string[]): string | null {
    let currentNodeId = startNodeId

    for (const actionType of actionTypes) {
      const node = this.nodeCache.get(currentNodeId)
      if (!node) return null

      const action = node.a.find(a => a.t === actionType && a.n)
      if (!action || !action.n) return null

      currentNodeId = action.n
    }

    return currentNodeId
  }

  /**
   * Get all terminal nodes reachable from a given node
   */
  getTerminalNodes(startNodeId: string): string[] {
    const terminals: string[] = []
    const visited = new Set<string>()

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      const node = this.nodeCache.get(nodeId)
      if (!node) return

      if (CompactTreeUtils.isTerminal(node)) {
        terminals.push(nodeId)
        return
      }

      // Get children from actions
      node.a.forEach(action => {
        if (action.n) traverse(action.n)
      })
    }

    traverse(startNodeId)
    return terminals
  }

  /**
   * Get node path - cached for performance
   */
  getNodePath(nodeId: string): string {
    if (this.pathCache.has(nodeId)) {
      return this.pathCache.get(nodeId)!
    }

    const breadcrumbs = this.getBreadcrumbs(nodeId)
    const path = breadcrumbs.length > 1 
      ? breadcrumbs.slice(1).map(b => b.label).join(' → ')
      : 'Root'

    this.pathCache.set(nodeId, path)
    return path
  }

  /**
   * Get tree statistics for performance monitoring
   */
  getTreeStats() {
    const nodes = Array.from(this.nodeCache.values())
    const terminalCount = nodes.filter(n => CompactTreeUtils.isTerminal(n)).length
    const branchingFactors = nodes
      .filter(n => !CompactTreeUtils.isTerminal(n))
      .map(n => n.a.filter(a => a.n).length)

    return {
      totalNodes: nodes.length,
      terminalNodes: terminalCount,
      maxDepth: this.tree.meta.maxDepth,
      avgBranchingFactor: branchingFactors.length > 0 
        ? branchingFactors.reduce((a, b) => a + b, 0) / branchingFactors.length 
        : 0,
      maxBranchingFactor: branchingFactors.length > 0 ? Math.max(...branchingFactors) : 0,
      nodesWithHandData: nodes.filter(n => CompactTreeUtils.hasHandData(n)).length,
      cacheStats: {
        pathCache: this.pathCache.size,
        breadcrumbCache: this.breadcrumbCache.size
      }
    }
  }

  /**
   * Clear caches to free memory
   */
  clearCaches(): void {
    this.pathCache.clear()
    this.breadcrumbCache.clear()
  }

  private formatActionLabel(type: string, amount: number): string {
    switch (type) {
      case 'F': return 'Fold'
      case 'C': return 'Call'
      case 'X': return 'Check'
      case 'R': return amount > 0 ? `Raise ${this.formatAmount(amount)}` : 'Raise'
      default: return type
    }
  }

  private formatAmount(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`
    }
    return amount.toString()
  }
}

/**
 * Utility functions for compact tree operations
 */
export const CompactTreeUtils = {
  /**
   * Convert legacy tree to compact format
   */
  convertToCompact(legacyTree: any): OptimizedTree {
    const compactNodes: Record<string, CompactTreeNode> = {}
    let terminalCount = 0

    Object.entries(legacyTree.nodes).forEach(([nodeId, node]: [string, any]) => {
      const compact: CompactTreeNode = {
        id: node.id,
        p: node.parentId,
        pl: node.player,
        s: node.street,
        a: node.actions.map((action: any) => {
          const compactAction: any = { t: action.type }
          if (action.amount > 0) compactAction.amt = action.amount
          if (action.node) compactAction.n = action.node
          return compactAction
        }),
        d: node.depth,
        f: 0
      }

      // Set flags
      if (node.isTerminal) {
        compact.f |= 1
        terminalCount++
      }
      if (node.hasHandData) {
        compact.f |= 2
      }

      compactNodes[nodeId] = compact
    })

    return {
      nodes: compactNodes,
      root: legacyTree.root,
      meta: {
        totalNodes: Object.keys(compactNodes).length,
        terminalNodes: terminalCount,
        maxDepth: legacyTree.maxDepth,
        playerCount: legacyTree.playerCount,
        generatedAt: legacyTree.metadata?.generatedAt || new Date().toISOString(),
        version: '2.0.0-compact'
      }
    }
  },

  /**
   * Calculate size reduction percentage
   */
  calculateSizeReduction(originalTree: any, compactTree: OptimizedTree): number {
    const originalSize = JSON.stringify(originalTree).length
    const compactSize = JSON.stringify(compactTree).length
    return Math.round((1 - compactSize / originalSize) * 100)
  },

  /**
   * Validate compact tree integrity
   */
  validateCompactTree(tree: OptimizedTree): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    const nodeIds = new Set(Object.keys(tree.nodes))

    // Check root exists
    if (!nodeIds.has(tree.root)) {
      errors.push(`Root node ${tree.root} not found`)
    }

    Object.entries(tree.nodes).forEach(([nodeId, node]) => {
      // Check parent references
      if (node.p && !nodeIds.has(node.p)) {
        errors.push(`Node ${nodeId} references non-existent parent ${node.p}`)
      }

      // Check action node references
      node.a.forEach((action, index) => {
        if (action.n && !nodeIds.has(action.n)) {
          errors.push(`Node ${nodeId} action ${index} references non-existent node ${action.n}`)
        }
      })
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}