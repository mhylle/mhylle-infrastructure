import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InterestHierarchy } from '../entities/interest-hierarchy.entity';

@Injectable()
export class InterestHierarchyRepository extends Repository<InterestHierarchy> {
  constructor(private dataSource: DataSource) {
    super(InterestHierarchy, dataSource.createEntityManager());
  }

  async findByParentId(parentId: string): Promise<InterestHierarchy[]> {
    return this.find({
      where: { parentId },
      relations: ['child'],
    });
  }

  async findByChildId(childId: string): Promise<InterestHierarchy[]> {
    return this.find({
      where: { childId },
      relations: ['parent'],
    });
  }

  async findHierarchy(
    parentId: string,
    childId: string,
  ): Promise<InterestHierarchy | null> {
    return this.findOne({
      where: { parentId, childId },
    });
  }

  async createHierarchy(
    parentId: string,
    childId: string,
    hierarchyType: string = 'parent-child',
    confidence: number,
  ): Promise<InterestHierarchy> {
    const existing = await this.findHierarchy(parentId, childId);

    if (existing) {
      existing.confidence = confidence;
      existing.hierarchyType = hierarchyType;
      return this.save(existing);
    }

    const hierarchy = this.create({
      parentId,
      childId,
      hierarchyType,
      confidence,
    });

    return this.save(hierarchy);
  }

  async findChildren(parentId: string): Promise<InterestHierarchy[]> {
    return this.find({ where: { parentId } });
  }

  async findParents(childId: string): Promise<InterestHierarchy[]> {
    return this.find({ where: { childId } });
  }

  async findAll(): Promise<InterestHierarchy[]> {
    return this.find({ relations: ['parent', 'child'] });
  }

  async saveHierarchy(
    parentId: string,
    childId: string,
    hierarchyType: string,
    confidence: number,
  ): Promise<InterestHierarchy> {
    // Check if already exists
    const existing = await this.findOne({
      where: { parentId, childId },
    });

    if (existing) {
      // Update confidence if higher
      if (confidence > existing.confidence) {
        existing.confidence = confidence;
        return this.save(existing);
      }
      return existing;
    }

    // Create new
    const hierarchy = this.create({
      parentId,
      childId,
      hierarchyType,
      confidence,
    });

    return this.save(hierarchy);
  }
}
