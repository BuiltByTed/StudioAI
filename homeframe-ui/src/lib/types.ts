export type Dict = Record<string, unknown>;
export interface User extends Dict {
  id: string;
  name: string;
  email: string;
  role: string;
  token?: string;
  permissions?: Record<string, Record<string, boolean>>;
}
export interface ServerConfig extends Dict {
  name?: string;
  features?: Record<string, boolean>;
  default_models?: string;
  default_prompt_suggestions?: { title: string[]; content: string }[];
  oauth?: { providers?: Record<string, string> };
}
export interface Model extends Dict {
  id: string;
  name?: string;
  owned_by?: string;
  info?: {
    base_model_id?: string;
    meta?: {
      description?: string;
      capabilities?: Record<string, boolean>;
      suggestion_prompts?: { content: string }[];
      defaultFeatureIds?: string[];
    };
    params?: Dict;
  };
}
export interface Attachment extends Dict {
  id?: string;
  type: string;
  name?: string;
  url?: string;
  file?: Dict;
  status?: string;
}
export interface Message extends Dict {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parentId: string | null;
  childrenIds: string[];
  model?: string;
  timestamp?: number;
  done?: boolean;
  error?: unknown;
  files?: Attachment[];
  output?: Dict[];
  sources?: Dict[];
  statusHistory?: Dict[];
  followUps?: string[];
}
export interface History {
  messages: Record<string, Message>;
  currentId: string | null;
}
export interface ChatData extends Dict {
  title?: string;
  models?: string[];
  history: History;
  messages?: Message[];
  params?: Dict;
  files?: Attachment[];
}
export interface ChatSummary extends Dict {
  id: string;
  title: string;
  updated_at?: number;
  pinned?: boolean;
  archived?: boolean;
  active?: boolean;
  folder_id?: string;
  snippet?: string;
}
export interface Chat extends ChatSummary {
  chat: ChatData;
  share_id?: string;
}
export interface Folder extends Dict {
  id: string;
  name: string;
  parent_id?: string | null;
}
export interface Resource extends Dict {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  content?: string;
  data?: Dict;
  meta?: Dict;
  is_active?: boolean;
  access_grants?: Dict[];
}
export function object(value: unknown): Dict {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : {};
}
export function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
export function items<T>(value: unknown): T[] {
  return Array.isArray(value)
    ? (value as T[])
    : Array.isArray(object(value).items)
      ? (object(value).items as T[])
      : Array.isArray(object(value).data)
        ? (object(value).data as T[])
        : [];
}
