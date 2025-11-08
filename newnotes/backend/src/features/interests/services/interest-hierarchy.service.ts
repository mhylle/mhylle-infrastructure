import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserInterest } from '../entities/user-interest.entity';
import { InterestHierarchy } from '../entities/interest-hierarchy.entity';
import { InterestHierarchyRepository } from '../repositories/interest-hierarchy.repository';
import { LocalModelService } from '@features/llm-service/services/local-model.service';
import {
  InterestHierarchyNodeDto,
  InterestPathNodeDto,
  InterestHierarchyResponseDto,
  InterestDescendantsResponseDto,
  InterestAncestorsResponseDto,
} from '../dto/interest-hierarchy.dto';

export interface HierarchyNode {
  interest: UserInterest;
  children: HierarchyNode[];
  parent?: HierarchyNode;
  depth: number;
}

export interface HierarchyRelationship {
  parent: UserInterest;
  child: UserInterest;
  confidence: number;
  reason: string;
}

export interface PathNode {
  interest: UserInterest;
  depth: number;
}

@Injectable()
export class InterestHierarchyService {
  private readonly logger = new Logger(InterestHierarchyService.name);

  constructor(
    @InjectRepository(UserInterest)
    private readonly interestRepository: Repository<UserInterest>,
    private readonly hierarchyRepository: InterestHierarchyRepository,
    private readonly llmService: LocalModelService,
  ) {}

  /**
   * Detect hierarchical relationships between all active interests
   */
  async detectHierarchies(): Promise<HierarchyRelationship[]> {
    this.logger.log('Starting hierarchy detection...');

    const activeInterests = await this.interestRepository.find({
      where: { isActive: true },
    });

    if (activeInterests.length < 2) {
      this.logger.log('Not enough interests to detect hierarchies');
      return [];
    }

    // Use LLM to detect parent-child relationships
    const relationships = await this.detectRelationshipsWithLLM(activeInterests);

    // Store detected relationships
    for (const rel of relationships) {
      // Check for cycles before creating
      const wouldCycle = await this.wouldCreateCycle(rel.parent.id, rel.child.id);
      if (wouldCycle) {
        this.logger.warn(
          `Skipping relationship ${rel.parent.topic} → ${rel.child.topic} (would create cycle)`,
        );
        continue;
      }

      await this.hierarchyRepository.saveHierarchy(
        rel.parent.id,
        rel.child.id,
        'parent-child',
        rel.confidence,
      );
    }

    this.logger.log(`Detected ${relationships.length} hierarchical relationships`);
    return relationships;
  }

  /**
   * Use LLM to detect parent-child relationships between interests
   */
  private async detectRelationshipsWithLLM(
    interests: UserInterest[],
  ): Promise<HierarchyRelationship[]> {
    const topicList = interests.map((i) => i.topic).join(', ');

    const prompt = `Analyze these interests and identify parent-child hierarchical relationships:

Interests: ${topicList}

For each pair where one topic is a broader category/parent of another more specific topic/child, output a JSON array of relationships.

Example format:
[
  {
    "parent": "Technology",
    "child": "Artificial Intelligence",
    "confidence": 0.95,
    "reason": "AI is a subfield of Technology"
  },
  {
    "parent": "Artificial Intelligence",
    "child": "Machine Learning",
    "confidence": 0.98,
    "reason": "Machine Learning is a core subfield of AI"
  }
]

Rules:
- Only include clear parent-child relationships (broader → specific)
- Confidence should be 0.7-1.0 for clear relationships
- Do not create circular relationships (A→B, B→A)
- Do not suggest relationships where topics are just related/similar

Output ONLY the JSON array, no other text.`;

    try {
      const response = await this.llmService.generateCompletion({
        prompt,
        systemPrompt:
          'You are a helpful assistant that identifies hierarchical relationships between topics. Return only valid JSON arrays.',
        config: {
          model: 'llama3.1:8b',
          temperature: 0.3, // Lower temperature for more consistent output
          maxTokens: 2000,
        },
      });

      // Parse JSON response
      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('LLM did not return valid JSON array');
        return [];
      }

      const relationships = JSON.parse(jsonMatch[0]);

      // Map to interest entities
      const result: HierarchyRelationship[] = [];
      for (const rel of relationships) {
        const parent = interests.find(
          (i) => i.topic.toLowerCase() === rel.parent.toLowerCase(),
        );
        const child = interests.find(
          (i) => i.topic.toLowerCase() === rel.child.toLowerCase(),
        );

        if (parent && child && parent.id !== child.id) {
          result.push({
            parent,
            child,
            confidence: rel.confidence,
            reason: rel.reason,
          });
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to detect hierarchies with LLM:', error);
      return [];
    }
  }

  /**
   * Build hierarchy tree from stored relationships
   */
  async buildHierarchyTree(): Promise<HierarchyNode[]> {
    const hierarchies = await this.hierarchyRepository.findAll();
    const interests = await this.interestRepository.find({
      where: { isActive: true },
    });

    // Create node map
    const nodeMap = new Map<string, HierarchyNode>();
    for (const interest of interests) {
      nodeMap.set(interest.id, {
        interest,
        children: [],
        depth: 0,
      });
    }

    // Build parent-child relationships
    for (const hierarchy of hierarchies) {
      const parentNode = nodeMap.get(hierarchy.parentId);
      const childNode = nodeMap.get(hierarchy.childId);

      if (parentNode && childNode) {
        parentNode.children.push(childNode);
        childNode.parent = parentNode;
      }
    }

    // Find root nodes (no parent)
    const rootNodes = Array.from(nodeMap.values()).filter(
      (node) => !node.parent,
    );

    // Calculate depths
    this.calculateDepths(rootNodes, 0);

    return rootNodes;
  }

  /**
   * Calculate depth for each node in tree
   */
  private calculateDepths(nodes: HierarchyNode[], depth: number): void {
    for (const node of nodes) {
      node.depth = depth;
      this.calculateDepths(node.children, depth + 1);
    }
  }

  /**
   * Get all descendants of an interest
   */
  async getDescendants(interestId: string): Promise<UserInterest[]> {
    const descendants: UserInterest[] = [];
    const visited = new Set<string>();

    await this.collectDescendants(interestId, descendants, visited);

    return descendants;
  }

  /**
   * Recursively collect descendants
   */
  private async collectDescendants(
    interestId: string,
    descendants: UserInterest[],
    visited: Set<string>,
  ): Promise<void> {
    if (visited.has(interestId)) {
      return; // Prevent cycles
    }
    visited.add(interestId);

    const children = await this.hierarchyRepository.findChildren(interestId);

    for (const hierarchy of children) {
      const child = await this.interestRepository.findOne({
        where: { id: hierarchy.childId },
      });

      if (child) {
        descendants.push(child);
        await this.collectDescendants(child.id, descendants, visited);
      }
    }
  }

  /**
   * Get all ancestors of an interest
   */
  async getAncestors(interestId: string): Promise<UserInterest[]> {
    const ancestors: UserInterest[] = [];
    const visited = new Set<string>();

    await this.collectAncestors(interestId, ancestors, visited);

    return ancestors;
  }

  /**
   * Recursively collect ancestors
   */
  private async collectAncestors(
    interestId: string,
    ancestors: UserInterest[],
    visited: Set<string>,
  ): Promise<void> {
    if (visited.has(interestId)) {
      return; // Prevent cycles
    }
    visited.add(interestId);

    const parents = await this.hierarchyRepository.findParents(interestId);

    for (const hierarchy of parents) {
      const parent = await this.interestRepository.findOne({
        where: { id: hierarchy.parentId },
      });

      if (parent) {
        ancestors.push(parent);
        await this.collectAncestors(parent.id, ancestors, visited);
      }
    }
  }

  /**
   * Check if a relationship would create a cycle
   */
  async wouldCreateCycle(parentId: string, childId: string): Promise<boolean> {
    // Check if child is an ancestor of parent
    const ancestors = await this.getAncestors(parentId);
    return ancestors.some((a) => a.id === childId);
  }

  /**
   * Get complete hierarchy tree with proper DTO structure
   */
  async getHierarchyTreeDto(): Promise<InterestHierarchyResponseDto> {
    const tree = await this.buildHierarchyTree();

    // Convert to DTO structure
    const roots = tree.map((node) => this.convertNodeToDto(node));

    // Calculate statistics
    const allInterests = await this.interestRepository.find({
      where: { isActive: true },
    });
    const maxDepth = this.findMaxDepth(tree);

    return {
      roots,
      totalInterests: allInterests.length,
      totalLevels: maxDepth + 1,
    };
  }

  /**
   * Convert HierarchyNode to DTO
   */
  private convertNodeToDto(node: HierarchyNode): InterestHierarchyNodeDto {
    return {
      id: node.interest.id,
      topic: node.interest.topic,
      confidence: Number(node.interest.confidence),
      evidenceCount: node.interest.evidenceCount,
      depth: node.depth,
      children: node.children.map((child) => this.convertNodeToDto(child)),
    };
  }

  /**
   * Find maximum depth in tree
   */
  private findMaxDepth(nodes: HierarchyNode[]): number {
    if (nodes.length === 0) return 0;

    let maxDepth = 0;
    for (const node of nodes) {
      maxDepth = Math.max(maxDepth, node.depth);
      if (node.children.length > 0) {
        maxDepth = Math.max(maxDepth, this.findMaxDepth(node.children));
      }
    }

    return maxDepth;
  }

  /**
   * Get descendants with depth tracking
   */
  async getDescendantsWithDepth(
    interestId: string,
    maxDepth?: number,
  ): Promise<InterestDescendantsResponseDto> {
    // Verify interest exists
    const interest = await this.interestRepository.findOne({
      where: { id: interestId },
    });

    if (!interest) {
      throw new NotFoundException(`Interest with ID ${interestId} not found`);
    }

    const descendants: PathNode[] = [];
    const visited = new Set<string>();

    await this.collectDescendantsWithDepth(
      interestId,
      descendants,
      visited,
      1,
      maxDepth,
    );

    // Convert to DTOs
    const descendantDtos: InterestPathNodeDto[] = descendants.map((node) => ({
      id: node.interest.id,
      topic: node.interest.topic,
      confidence: Number(node.interest.confidence),
      evidenceCount: node.interest.evidenceCount,
      depth: node.depth,
    }));

    const calculatedMaxDepth =
      descendants.length > 0
        ? Math.max(...descendants.map((d) => d.depth))
        : 0;

    return {
      interestId: interest.id,
      topic: interest.topic,
      descendants: descendantDtos,
      totalCount: descendants.length,
      maxDepth: calculatedMaxDepth,
    };
  }

  /**
   * Recursively collect descendants with depth
   */
  private async collectDescendantsWithDepth(
    interestId: string,
    descendants: PathNode[],
    visited: Set<string>,
    currentDepth: number,
    maxDepth?: number,
  ): Promise<void> {
    if (visited.has(interestId)) {
      return; // Prevent cycles
    }

    if (maxDepth && currentDepth > maxDepth) {
      return; // Stop if max depth reached
    }

    visited.add(interestId);

    const children = await this.hierarchyRepository.findChildren(interestId);

    for (const hierarchy of children) {
      const child = await this.interestRepository.findOne({
        where: { id: hierarchy.childId },
      });

      if (child) {
        descendants.push({
          interest: child,
          depth: currentDepth,
        });
        await this.collectDescendantsWithDepth(
          child.id,
          descendants,
          visited,
          currentDepth + 1,
          maxDepth,
        );
      }
    }
  }

  /**
   * Get ancestors with depth tracking
   */
  async getAncestorsWithDepth(
    interestId: string,
    maxDepth?: number,
  ): Promise<InterestAncestorsResponseDto> {
    // Verify interest exists
    const interest = await this.interestRepository.findOne({
      where: { id: interestId },
    });

    if (!interest) {
      throw new NotFoundException(`Interest with ID ${interestId} not found`);
    }

    const ancestors: PathNode[] = [];
    const visited = new Set<string>();

    await this.collectAncestorsWithDepth(
      interestId,
      ancestors,
      visited,
      1,
      maxDepth,
    );

    // Convert to DTOs
    const ancestorDtos: InterestPathNodeDto[] = ancestors.map((node) => ({
      id: node.interest.id,
      topic: node.interest.topic,
      confidence: Number(node.interest.confidence),
      evidenceCount: node.interest.evidenceCount,
      depth: node.depth,
    }));

    const calculatedMaxDepth =
      ancestors.length > 0 ? Math.max(...ancestors.map((a) => a.depth)) : 0;

    return {
      interestId: interest.id,
      topic: interest.topic,
      ancestors: ancestorDtos,
      totalCount: ancestors.length,
      maxDepth: calculatedMaxDepth,
    };
  }

  /**
   * Recursively collect ancestors with depth
   */
  private async collectAncestorsWithDepth(
    interestId: string,
    ancestors: PathNode[],
    visited: Set<string>,
    currentDepth: number,
    maxDepth?: number,
  ): Promise<void> {
    if (visited.has(interestId)) {
      return; // Prevent cycles
    }

    if (maxDepth && currentDepth > maxDepth) {
      return; // Stop if max depth reached
    }

    visited.add(interestId);

    const parents = await this.hierarchyRepository.findParents(interestId);

    for (const hierarchy of parents) {
      const parent = await this.interestRepository.findOne({
        where: { id: hierarchy.parentId },
      });

      if (parent) {
        ancestors.push({
          interest: parent,
          depth: currentDepth,
        });
        await this.collectAncestorsWithDepth(
          parent.id,
          ancestors,
          visited,
          currentDepth + 1,
          maxDepth,
        );
      }
    }
  }
}
