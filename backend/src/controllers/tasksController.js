/**
 * Tasks Controller
 * Demonstrates: REST design, N+1 prevention, Redis caching,
 * pagination, optimistic updates, error handling
 */

const { Op } = require('sequelize');
const { Task, User, Comment } = require('../models');
const redisClient = require('../utils/redisClient');
const { AppError } = require('../middleware/errorHandler');

const CACHE_TTL = 60; // seconds

// ── GET /api/tasks ─────────────────────────────────────────────────────────
// Paginated task list with eager loading (fixes N+1 query)
exports.getTasks = async (req, res, next) => {
  try {
    const {
      status, priority, assigneeId, search,
      page = 1, limit = 20, sortBy = 'columnOrder', sortDir = 'ASC',
    } = req.query;

    const where = { createdBy: req.user.teamId }; // scoped to team
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;
    if (search) where.title = { [Op.iLike]: `%${search}%` };

    // Cache key derived from all query params
    const cacheKey = `tasks:${req.user.teamId}:${JSON.stringify({ where, page, limit, sortBy, sortDir })}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json({ ...JSON.parse(cached), cached: true });

    // Single query with JOINs — no N+1
    const { count, rows } = await Task.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'avatarInitials', 'avatarColor'] },
        { model: Comment, as: 'latestComment', limit: 1, order: [['createdAt', 'DESC']],
          include: [{ model: User, as: 'author', attributes: ['name'] }] },
      ],
      order: [[sortBy, sortDir]],
      limit: Math.min(Number(limit), 100),
      offset: (Number(page) - 1) * Number(limit),
      distinct: true,
    });

    const payload = {
      tasks: rows,
      meta: { total: count, page: Number(page), limit: Number(limit), pages: Math.ceil(count / limit) },
    };

    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(payload));
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/tasks ───────────────────────────────────────────────────────
exports.createTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, tag, dueDate, assigneeId, gitBranch } = req.body;

    const task = await Task.create({
      title, description, status, priority, tag, dueDate, assigneeId, gitBranch,
      createdBy: req.user.id,
    });

    // Invalidate all task-list caches for this team
    await invalidateTeamCache(req.user.teamId);

    const full = await Task.findByPk(task.id, {
      include: [{ model: User, as: 'assignee', attributes: ['id', 'name', 'avatarInitials'] }],
    });

    res.status(201).json(full);
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/tasks/:id ─────────────────────────────────────────────────
exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) throw new AppError('Task not found', 404);
    if (task.createdBy !== req.user.teamId) throw new AppError('Forbidden', 403);

    const allowed = ['title','description','status','priority','tag','dueDate',
                     'assigneeId','gitBranch','manualProgress','subtasks','columnOrder'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    await task.update(updates);
    await invalidateTeamCache(req.user.teamId);

    res.json(task);
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/tasks/:id ────────────────────────────────────────────────
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) throw new AppError('Task not found', 404);
    if (task.createdBy !== req.user.teamId) throw new AppError('Forbidden', 403);

    await task.destroy(); // soft delete via paranoid
    await invalidateTeamCache(req.user.teamId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/tasks/reorder ─────────────────────────────────────────────
// Bulk update column order for drag-and-drop
exports.reorderTasks = async (req, res, next) => {
  try {
    const { updates } = req.body; // [{ id, status, columnOrder }]
    if (!Array.isArray(updates)) throw new AppError('updates must be an array', 400);

    // Batch update in a single transaction
    const { sequelize } = require('../models');
    await sequelize.transaction(async (t) => {
      for (const { id, status, columnOrder } of updates) {
        await Task.update({ status, columnOrder }, { where: { id }, transaction: t });
      }
    });

    await invalidateTeamCache(req.user.teamId);
    res.json({ updated: updates.length });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/tasks/dashboard ─────────────────────────────────────────────
// Heavily cached aggregation endpoint
exports.getDashboard = async (req, res, next) => {
  try {
    const cacheKey = `dashboard:${req.user.teamId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json({ ...JSON.parse(cached), cached: true });

    const { sequelize } = require('../models');
    const [stats] = await sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'todo')        AS todo,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'done')        AS done,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done') AS overdue,
        COUNT(*) AS total
      FROM tasks
      WHERE created_by = :teamId AND deleted_at IS NULL
    `, { replacements: { teamId: req.user.teamId }, type: sequelize.QueryTypes.SELECT });

    const overdueTasks = await Task.findOverdue();
    const payload = { stats, overdueTasks };

    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(payload));
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────
async function invalidateTeamCache(teamId) {
  const keys = await redisClient.keys(`tasks:${teamId}:*`);
  if (keys.length) await redisClient.del(keys);
  await redisClient.del(`dashboard:${teamId}`);
}
