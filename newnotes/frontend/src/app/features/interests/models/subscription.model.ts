export interface Subscription {
  id: string;
  topic: string;
  isAutoDetected: boolean;
  confirmed: boolean;
  notificationFrequency: 'daily' | 'weekly' | 'real-time';
  lastFetch: Date | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
