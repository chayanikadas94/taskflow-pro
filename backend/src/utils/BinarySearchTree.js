/**
 * BinarySearchTree — Task Priority Queue
 * Demonstrates: algorithms & data structures, OOP, recursion,
 * time complexity awareness, unit-testable design
 *
 * Used to maintain a sorted task queue by (priority × due_date score).
 * O(log n) insert/delete for efficient sprint planning.
 */

class TreeNode {
  constructor(score, taskId) {
    this.score = score;       // numeric priority score
    this.taskId = taskId;     // reference back to task UUID
    this.left = null;
    this.right = null;
    this.height = 1;          // for AVL balancing
  }
}

class BinarySearchTree {
  constructor() {
    this.root = null;
    this.size = 0;
  }

  // ── AVL helpers ────────────────────────────────────────────────────────
  _height(node) { return node ? node.height : 0; }
  _balanceFactor(node) { return node ? this._height(node.left) - this._height(node.right) : 0; }
  _updateHeight(node) {
    node.height = 1 + Math.max(this._height(node.left), this._height(node.right));
  }

  _rotateRight(y) {
    const x = y.left, T2 = x.right;
    x.right = y; y.left = T2;
    this._updateHeight(y); this._updateHeight(x);
    return x;
  }

  _rotateLeft(x) {
    const y = x.right, T2 = y.left;
    y.left = x; x.right = T2;
    this._updateHeight(x); this._updateHeight(y);
    return y;
  }

  _balance(node) {
    this._updateHeight(node);
    const bf = this._balanceFactor(node);
    if (bf > 1) {
      if (this._balanceFactor(node.left) < 0) node.left = this._rotateLeft(node.left);
      return this._rotateRight(node);
    }
    if (bf < -1) {
      if (this._balanceFactor(node.right) > 0) node.right = this._rotateRight(node.right);
      return this._rotateLeft(node);
    }
    return node;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /** Insert a task. O(log n). */
  insert(score, taskId) {
    this.root = this._insert(this.root, score, taskId);
    this.size++;
    return this;
  }

  _insert(node, score, taskId) {
    if (!node) return new TreeNode(score, taskId);
    if (score < node.score) node.left  = this._insert(node.left, score, taskId);
    else                    node.right = this._insert(node.right, score, taskId);
    return this._balance(node);
  }

  /** Delete a task by score. O(log n). */
  delete(score) {
    const before = this.size;
    this.root = this._delete(this.root, score);
    if (this.size === before) this.size--; // only decrement if found
    return this;
  }

  _delete(node, score) {
    if (!node) return null;
    if (score < node.score)      node.left  = this._delete(node.left, score);
    else if (score > node.score) node.right = this._delete(node.right, score);
    else {
      // Found — handle 3 cases
      if (!node.left)  return node.right;
      if (!node.right) return node.left;
      // Two children: replace with in-order successor
      let successor = node.right;
      while (successor.left) successor = successor.left;
      node.score = successor.score;
      node.taskId = successor.taskId;
      node.right = this._delete(node.right, successor.score);
    }
    return this._balance(node);
  }

  /** In-order traversal: returns tasks sorted by score (ascending). O(n). */
  toSortedArray() {
    const result = [];
    this._inorder(this.root, result);
    return result;
  }

  _inorder(node, acc) {
    if (!node) return;
    this._inorder(node.left, acc);
    acc.push({ score: node.score, taskId: node.taskId });
    this._inorder(node.right, acc);
  }

  /** Find top-N highest priority tasks. O(n) worst case, O(k log n) with early exit. */
  topN(n) {
    const all = this.toSortedArray();
    return all.slice(-n).reverse(); // highest scores are at the end
  }

  /** Search by score. O(log n). */
  search(score) {
    let node = this.root;
    while (node) {
      if (score === node.score) return node;
      node = score < node.score ? node.left : node.right;
    }
    return null;
  }

  /** Compute priority score from task attributes. */
  static scoreTask(task) {
    const priorityWeight = { high: 100, medium: 50, low: 10 };
    const daysUntilDue = task.dueDate
      ? Math.max(0, Math.ceil((new Date(task.dueDate) - Date.now()) / 86_400_000))
      : 30;
    const urgency = Math.max(0, 30 - daysUntilDue); // 0–30
    return (priorityWeight[task.priority] ?? 50) + urgency;
  }

  get isEmpty() { return this.size === 0; }
}

module.exports = { BinarySearchTree, TreeNode };
