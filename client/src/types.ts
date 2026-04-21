export interface ChatMessage {
  speaker: string;
  text: string;
}

export interface ProcessResponse {
  videoId?: string;
  messageCount: number;
  messages: ChatMessage[];
}

export interface ErrorBody {
  error: string;
  detail?: string;
  messages?: ChatMessage[];
}
