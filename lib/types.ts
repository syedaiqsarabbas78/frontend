export interface PublicUser {
  id: string;
  email: string;
}

export interface ModelOption {
  id: string;
  providerModelId: string;
  displayName: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "pending" | "completed" | "failed";
  sequence: number;
  modelId: string | null;
  errorCode: string | null;
  createdAt: string;
}
