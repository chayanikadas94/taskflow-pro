/**
 * BinarySearchTree — Jest test suite
 * Target: ≥90% coverage on insert, delete, search, traversal, balancing
 * Run: npx jest bst.test.js --coverage
 */

const { BinarySearchTree, TreeNode } = require('../src/utils/BinarySearchTree');

describe('BinarySearchTree', () => {

  // ── Instantiation ───────────────────────────────────────────────────────
  describe('constructor', () => {
    test('creates an empty tree', () => {
      const bst = new BinarySearchTree();
      expect(bst.root).toBeNull();
      expect(bst.size).toBe(0);
      expect(bst.isEmpty).toBe(true);
    });
  });

  // ── Insert ──────────────────────────────────────────────────────────────
  describe('insert()', () => {
    test('inserts a single node correctly', () => {
      const bst = new BinarySearchTree();
      bst.insert(50, 'task-a');
      expect(bst.root).not.toBeNull();
      expect(bst.root.score).toBe(50);
      expect(bst.root.taskId).toBe('task-a');
      expect(bst.size).toBe(1);
    });

    test('increments size on each insert', () => {
      const bst = new BinarySearchTree();
      bst.insert(10, 'a').insert(20, 'b').insert(5, 'c');
      expect(bst.size).toBe(3);
    });

    test('supports chaining', () => {
      const bst = new BinarySearchTree();
      const result = bst.insert(10, 'a');
      expect(result).toBe(bst);
    });

    test('handles duplicate scores without throwing', () => {
      const bst = new BinarySearchTree();
      expect(() => bst.insert(50, 'a').insert(50, 'b')).not.toThrow();
    });
  });

  // ── In-order traversal ──────────────────────────────────────────────────
  describe('toSortedArray()', () => {
    test('returns empty array for empty tree', () => {
      expect(new BinarySearchTree().toSortedArray()).toEqual([]);
    });

    test('returns elements in ascending score order', () => {
      const bst = new BinarySearchTree();
      [30, 10, 50, 20, 40, 60, 5].forEach((s, i) => bst.insert(s, `t${i}`));
      const scores = bst.toSortedArray().map(n => n.score);
      expect(scores).toEqual([5, 10, 20, 30, 40, 50, 60]);
    });

    test('single-node tree returns one element', () => {
      const bst = new BinarySearchTree();
      bst.insert(42, 'only');
      expect(bst.toSortedArray()).toEqual([{ score: 42, taskId: 'only' }]);
    });
  });

  // ── Search ──────────────────────────────────────────────────────────────
  describe('search()', () => {
    let bst;
    beforeEach(() => {
      bst = new BinarySearchTree();
      [10, 30, 20, 50, 40].forEach((s, i) => bst.insert(s, `t${i}`));
    });

    test('finds existing node', () => {
      const node = bst.search(30);
      expect(node).not.toBeNull();
      expect(node.score).toBe(30);
    });

    test('returns null for missing score', () => {
      expect(bst.search(99)).toBeNull();
    });

    test('finds root node', () => {
      expect(bst.search(10)).not.toBeNull();
    });
  });

  // ── Delete ──────────────────────────────────────────────────────────────
  describe('delete()', () => {
    let bst;
    beforeEach(() => {
      bst = new BinarySearchTree();
      [50, 30, 70, 20, 40, 60, 80].forEach((s, i) => bst.insert(s, `t${i}`));
    });

    test('deletes a leaf node', () => {
      bst.delete(20);
      expect(bst.search(20)).toBeNull();
      const scores = bst.toSortedArray().map(n => n.score);
      expect(scores).not.toContain(20);
    });

    test('deletes a node with one child', () => {
      bst.delete(30); // has left child 20
      expect(bst.search(30)).toBeNull();
      expect(bst.search(20)).not.toBeNull(); // child preserved
    });

    test('deletes a node with two children', () => {
      bst.delete(70); // has children 60 and 80
      expect(bst.search(70)).toBeNull();
      expect(bst.search(60)).not.toBeNull();
      expect(bst.search(80)).not.toBeNull();
    });

    test('maintains sorted order after deletion', () => {
      bst.delete(50); // root
      const scores = bst.toSortedArray().map(n => n.score);
      expect(scores).toEqual([20, 30, 40, 60, 70, 80]);
    });

    test('deleting non-existent score does not throw', () => {
      expect(() => bst.delete(999)).not.toThrow();
    });

    test('returns empty array after deleting all nodes', () => {
      [50, 30, 70, 20, 40, 60, 80].forEach(s => bst.delete(s));
      expect(bst.toSortedArray()).toEqual([]);
    });
  });

  // ── AVL balancing ────────────────────────────────────────────────────────
  describe('AVL self-balancing', () => {
    test('tree remains balanced after sequential inserts (right-heavy)', () => {
      const bst = new BinarySearchTree();
      [1, 2, 3, 4, 5, 6, 7].forEach((s, i) => bst.insert(s, `t${i}`));
      // Height should be O(log n) = ~3, not 7 (unbalanced)
      expect(bst.root.height).toBeLessThanOrEqual(4);
    });

    test('tree remains balanced after sequential inserts (left-heavy)', () => {
      const bst = new BinarySearchTree();
      [7, 6, 5, 4, 3, 2, 1].forEach((s, i) => bst.insert(s, `t${i}`));
      expect(bst.root.height).toBeLessThanOrEqual(4);
    });
  });

  // ── topN() ───────────────────────────────────────────────────────────────
  describe('topN()', () => {
    test('returns top N highest-score tasks', () => {
      const bst = new BinarySearchTree();
      [10, 40, 20, 80, 60].forEach((s, i) => bst.insert(s, `t${i}`));
      const top3 = bst.topN(3);
      const scores = top3.map(n => n.score);
      expect(scores).toEqual([80, 60, 40]);
    });

    test('returns all when N >= tree size', () => {
      const bst = new BinarySearchTree();
      [10, 20].forEach((s, i) => bst.insert(s, `t${i}`));
      expect(bst.topN(10)).toHaveLength(2);
    });

    test('returns empty array from empty tree', () => {
      expect(new BinarySearchTree().topN(5)).toEqual([]);
    });
  });

  // ── Static score calculator ──────────────────────────────────────────────
  describe('BinarySearchTree.scoreTask()', () => {
    test('high priority scores higher than medium', () => {
      const high = BinarySearchTree.scoreTask({ priority: 'high', dueDate: null });
      const med  = BinarySearchTree.scoreTask({ priority: 'medium', dueDate: null });
      expect(high).toBeGreaterThan(med);
    });

    test('imminent due date increases score', () => {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const urgent = BinarySearchTree.scoreTask({ priority: 'medium', dueDate: tomorrow });
      const relaxed = BinarySearchTree.scoreTask({ priority: 'medium', dueDate: nextMonth });
      expect(urgent).toBeGreaterThan(relaxed);
    });

    test('handles missing dueDate gracefully', () => {
      expect(() => BinarySearchTree.scoreTask({ priority: 'low', dueDate: null })).not.toThrow();
    });
  });

});
