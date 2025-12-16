export interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface StreamEvent {
  type: 'thinking' | 'domain' | 'done' | 'error';
  content?: string;
  name?: string;
  error?: string;
}

export interface GenerateStreamRequest {
  prompt: string;
  count: number;
  feedback?: string;
  likedDomains?: string[];
  conversationHistory?: ConversationMessage[];
}

export interface SavedDomain {
  domain: string;
  savedAt: number;
}
