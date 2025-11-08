import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Logger,
  Patch,
} from '@nestjs/common';
import { InterestDetectionService } from '../services/interest-detection.service';
import { SubscriptionsService } from '../services/subscriptions.service';
import { InterestRecommendationsService } from '../services/interest-recommendations.service';
import { InterestHierarchyService } from '../services/interest-hierarchy.service';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';

@Controller('interests')
export class InterestsController {
  private readonly logger = new Logger(InterestsController.name);

  constructor(
    private readonly interestDetectionService: InterestDetectionService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly recommendationsService: InterestRecommendationsService,
    private readonly hierarchyService: InterestHierarchyService,
  ) {}

  @Get()
  async getInterests(@Query('minConfidence') minConfidence?: string) {
    this.logger.log(
      `GET /api/interests - minConfidence: ${minConfidence || '0.6'}`,
    );

    const threshold = minConfidence ? parseFloat(minConfidence) : 0.6;

    return await this.interestDetectionService.getInterests(threshold);
  }

  @Post('detect')
  async detectInterests() {
    this.logger.log('POST /api/interests/detect - Starting interest detection');

    const interests = await this.interestDetectionService.detectInterests();

    return {
      message: 'Interest detection completed',
      count: interests.length,
      interests,
    };
  }

  @Delete(':id')
  async deleteInterest(@Param('id') id: string) {
    this.logger.log(`DELETE /api/interests/${id}`);

    await this.interestDetectionService.deleteInterest(id);

    return {
      message: 'Interest deleted successfully',
    };
  }

  @Post(':topic/boost')
  async boostInterest(
    @Param('topic') topic: string,
    @Body('amount') amount: number,
  ) {
    this.logger.log(`POST /api/interests/${topic}/boost - amount: ${amount}`);

    if (!amount || amount <= 0) {
      return {
        error: 'Amount must be a positive number',
      };
    }

    await this.interestDetectionService.boostConfidence(topic, amount);

    return {
      message: 'Confidence boosted successfully',
      topic,
      amount,
    };
  }

  @Post(':topic/reduce')
  async reduceInterest(
    @Param('topic') topic: string,
    @Body('amount') amount: number,
  ) {
    this.logger.log(`POST /api/interests/${topic}/reduce - amount: ${amount}`);

    if (!amount || amount <= 0) {
      return {
        error: 'Amount must be a positive number',
      };
    }

    await this.interestDetectionService.reduceConfidence(topic, amount);

    return {
      message: 'Confidence reduced successfully',
      topic,
      amount,
    };
  }

  // Subscription endpoints
  @Get('subscriptions')
  async getSubscriptions() {
    this.logger.log('GET /api/interests/subscriptions');
    return await this.subscriptionsService.findAll();
  }

  @Get('subscriptions/active')
  async getActiveSubscriptions() {
    this.logger.log('GET /api/interests/subscriptions/active');
    return await this.subscriptionsService.findActive();
  }

  @Post('subscriptions')
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    this.logger.log(
      `POST /api/interests/subscriptions - topic: ${dto.topic}`,
    );
    return await this.subscriptionsService.create(dto);
  }

  @Post(':id/confirm')
  async confirmInterest(@Param('id') id: string, @Body('topic') topic: string) {
    this.logger.log(
      `POST /api/interests/${id}/confirm - topic: ${topic}`,
    );
    return await this.subscriptionsService.confirmInterest(id, topic);
  }

  @Patch('subscriptions/:id')
  async updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    this.logger.log(`PATCH /api/interests/subscriptions/${id}`);
    return await this.subscriptionsService.update(id, dto);
  }

  @Delete('subscriptions/:id')
  async deleteSubscription(@Param('id') id: string) {
    this.logger.log(`DELETE /api/interests/subscriptions/${id}`);
    await this.subscriptionsService.delete(id);
    return { message: 'Subscription deleted successfully' };
  }

  // Recommendation endpoints
  @Get(':id/recommendations')
  async getRecommendations(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('minScore') minScore?: string,
  ) {
    this.logger.log(
      `GET /api/interests/${id}/recommendations - limit: ${limit || 10}, minScore: ${minScore || 0.3}`,
    );

    const limitNum = limit ? parseInt(limit, 10) : 10;
    const minScoreNum = minScore ? parseFloat(minScore) : 0.3;

    return await this.recommendationsService.generateRecommendations(
      id,
      limitNum,
      minScoreNum,
    );
  }

  @Post(':id/recommendations/invalidate-cache')
  async invalidateRecommendationsCache(@Param('id') id: string) {
    this.logger.log(`POST /api/interests/${id}/recommendations/invalidate-cache`);

    await this.recommendationsService.invalidateCache(id);

    return {
      message: 'Recommendations cache invalidated successfully',
    };
  }

  // Hierarchy endpoints
  @Get('hierarchy')
  async getHierarchy() {
    this.logger.log('GET /api/interests/hierarchy');
    return await this.hierarchyService.getHierarchyTreeDto();
  }

  @Get(':id/descendants')
  async getDescendants(
    @Param('id') id: string,
    @Query('maxDepth') maxDepth?: string,
  ) {
    this.logger.log(
      `GET /api/interests/${id}/descendants - maxDepth: ${maxDepth || 'unlimited'}`,
    );

    const maxDepthNum = maxDepth ? parseInt(maxDepth, 10) : undefined;

    return await this.hierarchyService.getDescendantsWithDepth(id, maxDepthNum);
  }

  @Get(':id/ancestors')
  async getAncestors(
    @Param('id') id: string,
    @Query('maxDepth') maxDepth?: string,
  ) {
    this.logger.log(
      `GET /api/interests/${id}/ancestors - maxDepth: ${maxDepth || 'unlimited'}`,
    );

    const maxDepthNum = maxDepth ? parseInt(maxDepth, 10) : undefined;

    return await this.hierarchyService.getAncestorsWithDepth(id, maxDepthNum);
  }
}
