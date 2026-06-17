/**
 * Task Model — Sequelize ORM
 * Demonstrates: data modelling, relationships, validation, lifecycle hooks
 */

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('./index');

class Task extends Model {
  // Instance method: compute completion percentage from subtasks
  get completionPercent() {
    if (!this.subtasks || this.subtasks.length === 0) return this.manualProgress ?? 0;
    const done = this.subtasks.filter(s => s.done).length;
    return Math.round((done / this.subtasks.length) * 100);
  }

  // Static method: find overdue tasks efficiently
  static async findOverdue() {
    const { Op } = require('sequelize');
    return this.findAll({
      where: {
        dueDate: { [Op.lt]: new Date() },
        status: { [Op.not]: 'done' },
      },
      include: [{ model: sequelize.models.User, as: 'assignee', attributes: ['id', 'name', 'email'] }],
      order: [['dueDate', 'ASC']],
    });
  }
}

Task.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { len: { args: [1, 200], msg: 'Title must be 1–200 characters' } },
    },
    description: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM('todo', 'in_progress', 'done'),
      defaultValue: 'todo',
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
    },
    tag: {
      type: DataTypes.ENUM('feature', 'bug', 'performance', 'database', 'devops', 'refactor'),
      defaultValue: 'feature',
    },
    dueDate: { type: DataTypes.DATEONLY },
    manualProgress: { type: DataTypes.INTEGER, defaultValue: 0, validate: { min: 0, max: 100 } },
    gitBranch: { type: DataTypes.STRING(100) },
    subtasks: { type: DataTypes.JSONB, defaultValue: [] }, // [{ title, done }]
    columnOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    sprintId: { type: DataTypes.UUID },
    createdBy: { type: DataTypes.UUID, allowNull: false },
    assigneeId: { type: DataTypes.UUID },
  },
  {
    sequelize,
    modelName: 'Task',
    tableName: 'tasks',
    timestamps: true,
    paranoid: true, // soft deletes via deletedAt
    indexes: [
      { fields: ['status'] },
      { fields: ['assigneeId'] },
      // Composite index — critical for dashboard feed query (see migrations)
      { fields: ['createdBy', 'createdAt'] },
      { fields: ['sprintId', 'columnOrder'] },
    ],
    hooks: {
      // Sanitize description to prevent XSS before saving
      beforeSave: async (task) => {
        if (task.changed('description') && task.description) {
          const DOMPurify = require('isomorphic-dompurify');
          task.description = DOMPurify.sanitize(task.description);
        }
      },
    },
  }
);

module.exports = Task;
