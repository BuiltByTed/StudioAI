import { object, text, type Attachment, type Dict } from './types';

// The backend's retrieval pipeline consumes web/video content as text, not as
// a "web" or "youtube" file. Keep the full-page behavior of the upstream UI.
export function linkAttachment(result: Dict, url: string): Attachment {
  const file = object(result.file),
    id = text(file.id);
  if ((result.type === 'image' || result.type === 'file') && id) {
    return {
      ...result,
      id,
      type: result.type,
      file,
      context: 'full',
      url: `/api/v1/files/${encodeURIComponent(id)}/content`,
      status: 'uploaded',
    };
  }
  const content = text(result.content);
  if (!content.trim()) throw new Error('This page did not provide readable content.');
  const name = text(result.name) || url;
  return {
    id: crypto.randomUUID(),
    type: 'text',
    name,
    url,
    context: 'full',
    status: 'uploaded',
    file: { data: { content }, meta: { name, source: url } },
  };
}
