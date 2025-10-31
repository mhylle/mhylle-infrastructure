import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskRepository } from '../llm-service/repositories/task.repository';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { Task } from '../../shared/entities/task.entity';

@Injectable()
export class TasksService {
  constructor(private readonly taskRepository: TaskRepository) {}

  /**
   * Find all tasks with optional filtering
   * Supports filtering by noteId, status, priority, date ranges, and sorting
   */
  async findAll(filters: TaskFilterDto): Promise<Task[]> {
    return await this.taskRepository.findAll(filters);
  }

  /**
   * Find a single task by ID
   * Throws NotFoundException if task not found
   */
  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne(id);

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Find all tasks for a specific note
   * Returns empty array if note has no tasks
   */
  async findByNoteId(noteId: string): Promise<Task[]> {
    return await this.taskRepository.findTasksByNoteId(noteId);
  }

  /**
   * Create a new task
   * Delegates to repository for creation
   */
  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    return await this.taskRepository.create(createTaskDto);
  }

  /**
   * Update task properties (excluding status)
   * Throws NotFoundException if task not found
   */
  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    try {
      return await this.taskRepository.update(id, updateTaskDto);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * Update task status
   * Automatically sets completed_at when status is 'completed'
   * Clears completed_at when status changes from 'completed' to another state
   * Throws NotFoundException if task not found
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateTaskStatusDto,
  ): Promise<Task> {
    try {
      return await this.taskRepository.updateTaskStatus(
        id,
        updateStatusDto.status,
      );
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * Delete a task
   * Throws NotFoundException if task not found
   */
  async remove(id: string): Promise<void> {
    try {
      await this.taskRepository.delete(id);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
