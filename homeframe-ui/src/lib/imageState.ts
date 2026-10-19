import { object, text } from './types';
const sizes = new Set(['1024x1024', '1536x1024', '1024x1536', '512x512']);
const imageUrl = (value: unknown) => {
  const url = text(value);
  return /^(https?:\/\/|data:image\/|\/(?!\/))/.test(url) ? url : '';
};
export function normalizeImageWorkspace(value: unknown) {
  const state = object(value);
  return {
    prompt: text(state.prompt),
    size: sizes.has(text(state.size)) ? text(state.size) : '1024x1024',
    source: imageUrl(state.source),
    images: (Array.isArray(state.images) ? state.images : [])
      .map((raw: unknown) => {
        const image = object(raw);
        return { url: imageUrl(image.url), prompt: text(image.prompt) };
      })
      .filter((image) => image.url)
      .slice(0, 100),
  };
}
