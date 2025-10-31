import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../../shared/entities/task.entity';
import { ExtractedTask } from '../services/task-agent.interface';
import { TaskFilterDto } from '../../tasks/dto/task-filter.dto';
import { CreateTaskDto } from '../../tasks/dto/create-task.dto';
import { UpdateTaskDto } from '../../tasks/dto/update-task.dto';

@Injectable()
export class TaskRepository {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async createTasksForNote(
    noteId: string,
    tasks: ExtractedTask[],
  ): Promise<Task[]> {
    const taskEntities = tasks.map((task) =>
      this.taskRepository.create({
        note_id: noteId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        due_date: task.dueDate,
        llm_confidence: task.confidence,
        status: 'pending',
      }),
    );

    return await this.taskRepository.save(taskEntities);
  }

  async findTasksByNoteId(noteId: string): Promise<Task[]> {
    return await this.taskRepository.find({
      where: { note_id: noteId },
      order: { created_at: 'DESC' },
    });
  }

  async updateTaskStatus(taskId: string, status: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    task.status = status;

    if (status === 'completed') {
      task.completed_at = new Date();
    } else if (task.completed_at) {
      task.completed_at = null;
    }

    return await this.taskRepository.save(task);
  }

  async findAll(filters: TaskFilterDto): Promise<Task[]> {
    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    if (filters.noteId) {
      queryBuilder.andWhere('task.note_id = :noteId', {
        noteId: filters.noteId,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('task.status = :status', {
        status: filters.status,
      });
    }

    if (filters.priority) {
      queryBuilder.andWhere('task.priority = :priority', {
        priority: filters.priority,
      });
    }

    if (filters.dueDateFrom) {
      queryBuilder.andWhere('task.due_date >= :from', {
        from: filters.dueDateFrom,
      });
    }

    if (filters.dueDateTo) {
      queryBuilder.andWhere('task.due_date <= :to', { to: filters.dueDateTo });
    }

    queryBuilder.orderBy(
      `task.${filters.sortBy || 'created_at'}`,
      (filters.sortOrder || 'DESC') as 'ASC' | 'DESC',
    );

    return await queryBuilder.getMany();
  }

  async findOne(id: string): Promise<Task | null> {
    return await this.taskRepository.findOne({ where: { id } });
  }

  async create(taskData: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create(taskData);
    return await this.taskRepository.save(task);
  }

  async update(id: string, taskData: UpdateTaskDto): Promise<Task> {
    await this.taskRepository.update(id, taskData);
    const updated = await this.findOne(id);
    if (!updated) {
      throw new Error(`Task with ID ${id} not found`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const result = await this.taskRepository.delete(id);
    if (result.affected === 0) {
      throw new Error(`Task with ID ${id} not found`);
    }
  }
}
