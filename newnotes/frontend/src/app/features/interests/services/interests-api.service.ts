import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Interest } from '../models/interest.model';
import { Subscription } from '../models/subscription.model';
import { RecommendationsResponse } from '../models/recommendation.model';
import { HierarchyResponse } from '../models/hierarchy.model';
import { DescendantsResponse, AncestorsResponse } from '../models/path.model';

@Injectable({
  providedIn: 'root'
})
export class InterestsApiService {
  private baseUrl = 'http://localhost:3000/api/notes/interests';

  constructor(private http: HttpClient) {}

  getInterests(minConfidence: number = 0.7): Observable<Interest[]> {
    return this.http.get<Interest[]>(`${this.baseUrl}?minConfidence=${minConfidence}`);
  }

  /**
   * Retrieves personalized interest recommendations based on multi-signal analysis
   *
   * @param interestId - Unique identifier of the source interest
   * @param limit - Maximum number of recommendations to return (default: 10)
   * @param minScore - Minimum recommendation score threshold 0-1 (default: 0.3)
   * @returns Observable of recommendations response with scoring details
   */
  getRecommendations(interestId: string, limit: number = 10, minScore: number = 0.3): Observable<RecommendationsResponse> {
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('minScore', minScore.toString());

    return this.http.get<RecommendationsResponse>(`${this.baseUrl}/${interestId}/recommendations`, { params });
  }

  /**
   * Retrieves the complete interest hierarchy tree
   *
   * @returns Observable of hierarchy response with root-level interests and their descendants
   */
  getHierarchy(): Observable<HierarchyResponse> {
    return this.http.get<HierarchyResponse>(`${this.baseUrl}/hierarchy`);
  }

  /**
   * Retrieves all descendant interests (more specific/child interests) of a source interest
   *
   * @param interestId - Unique identifier of the source interest
   * @param maxDepth - Optional maximum depth to traverse in the hierarchy tree
   * @returns Observable of descendants response with child interests
   */
  getDescendants(interestId: string, maxDepth?: number): Observable<DescendantsResponse> {
    let params = new HttpParams();
    if (maxDepth !== undefined) {
      params = params.set('maxDepth', maxDepth.toString());
    }

    return this.http.get<DescendantsResponse>(`${this.baseUrl}/${interestId}/descendants`, { params });
  }

  /**
   * Retrieves all ancestor interests (more general/parent interests) of a source interest
   *
   * @param interestId - Unique identifier of the source interest
   * @param maxDepth - Optional maximum depth to traverse in the hierarchy tree
   * @returns Observable of ancestors response with parent interests
   */
  getAncestors(interestId: string, maxDepth?: number): Observable<AncestorsResponse> {
    let params = new HttpParams();
    if (maxDepth !== undefined) {
      params = params.set('maxDepth', maxDepth.toString());
    }

    return this.http.get<AncestorsResponse>(`${this.baseUrl}/${interestId}/ancestors`, { params });
  }

  getSubscriptions(): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${this.baseUrl}/subscriptions`);
  }

  confirmInterest(interestId: string, topic: string): Observable<Subscription> {
    return this.http.post<Subscription>(`${this.baseUrl}/${interestId}/confirm`, { topic });
  }

  createSubscription(topic: string, frequency: string = 'daily'): Observable<Subscription> {
    return this.http.post<Subscription>(`${this.baseUrl}/subscriptions`, {
      topic,
      notificationFrequency: frequency
    });
  }

  updateSubscription(id: string, data: Partial<Subscription>): Observable<Subscription> {
    return this.http.patch<Subscription>(`${this.baseUrl}/subscriptions/${id}`, data);
  }

  deleteInterest(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  deleteSubscription(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/subscriptions/${id}`);
  }
}
