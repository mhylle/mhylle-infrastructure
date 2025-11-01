import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export enum SearchMode {
  SEMANTIC = 'semantic',
  KEYWORD = 'keyword',
  HYBRID = 'hybrid',
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  snippet: string;
  score: number;
  searchType: 'semantic' | 'keyword' | 'hybrid';
  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  mode: SearchMode;
  totalResults: number;
  processingTimeMs: number;
}

export interface SearchParams {
  query: string;
  mode?: SearchMode;
  limit?: number;
  minScore?: number;
}

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/search`;

  search(params: SearchParams): Observable<SearchResponse> {
    let httpParams = new HttpParams().set('query', params.query);

    if (params.mode) {
      httpParams = httpParams.set('mode', params.mode);
    }
    if (params.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params.minScore !== undefined) {
      httpParams = httpParams.set('minScore', params.minScore.toString());
    }

    return this.http.get<SearchResponse>(this.apiUrl, { params: httpParams });
  }

  semanticSearch(
    query: string,
    limit = 10,
    minScore = 0.0,
  ): Observable<SearchResponse> {
    return this.search({ query, mode: SearchMode.SEMANTIC, limit, minScore });
  }

  keywordSearch(
    query: string,
    limit = 10,
    minScore = 0.0,
  ): Observable<SearchResponse> {
    return this.search({ query, mode: SearchMode.KEYWORD, limit, minScore });
  }

  hybridSearch(
    query: string,
    limit = 10,
    minScore = 0.0,
  ): Observable<SearchResponse> {
    return this.search({ query, mode: SearchMode.HYBRID, limit, minScore });
  }
}
