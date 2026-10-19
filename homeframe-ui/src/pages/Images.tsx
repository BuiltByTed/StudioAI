import { useEffect, useState, type FormEvent } from 'react';
import {
  HomeframeInput,
  HomeframeSelect,
  HomeframeTextarea,
  useHomeframeUpdate,
} from '@builtbyted/homeframe';
import { Download, ImagePlus, WandSparkles, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { items, type Dict } from '../lib/types';
import { Busy, Empty, ErrorNotice, Field, Page } from '../components/ui';

export function ImagesPage() {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<{ url: string; prompt: string }[]>([]);
  const update = useHomeframeUpdate();
  useEffect(
    () => update.registerGuard(() => !busy && !prompt),
    [busy, prompt, update.registerGuard],
  );
  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<unknown>(`/api/v1/images/${source ? 'edit' : 'generations'}`, {
        prompt,
        size,
        n: 1,
        ...(source ? { image: source } : {}),
      });
      const generated = items<{ url: string }>(result);
      if (!generated.length)
        throw new Error('The image service returned no images. Please try again.');
      setImages((previous) => [
        ...generated.map((image) => ({ url: image.url, prompt })),
        ...previous,
      ]);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      eyebrow="IMAGE STUDIO"
      title="From a thought to a picture."
      description="Generate something new, or give an existing image a new direction."
    >
      <div className="image-workspace">
        <form className="card stack" onSubmit={generate}>
          <Field label="Your prompt">
            <HomeframeTextarea
              rows={5}
              placeholder="A sunlit reading room, warm oak shelves, soft afternoon light…"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              required
            />
          </Field>
          <Field label="Canvas">
            <HomeframeSelect value={size} onChange={(event) => setSize(event.target.value)}>
              <option value="1024x1024">Square · 1024 × 1024</option>
              <option value="1536x1024">Landscape · 1536 × 1024</option>
              <option value="1024x1536">Portrait · 1024 × 1536</option>
              <option value="512x512">Small · 512 × 512</option>
            </HomeframeSelect>
          </Field>
          <Field label="Reference image (optional)">
            <HomeframeInput
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 25 * 1024 * 1024) {
                  setError('Choose an image smaller than 25 MB.');
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setSource(String(reader.result));
                reader.onerror = () => setError('The reference image could not be read.');
                reader.readAsDataURL(file);
              }}
            />
          </Field>
          {source && (
            <div className="reference-image">
              <img src={source} alt="Reference for image editing" />
              <button
                type="button"
                className="icon-button"
                aria-label="Remove reference image"
                onClick={() => setSource('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <button className="primary" disabled={busy || !prompt.trim()}>
            <WandSparkles size={18} />
            {busy ? 'Creating your image…' : source ? 'Edit image' : 'Generate image'}
          </button>
          <ErrorNotice error={error} />
        </form>
        <div>
          {busy && (
            <div className="image-loading">
              <Busy label="Bringing your idea to life…" />
              <p className="muted">You can leave this open while the image model works.</p>
            </div>
          )}
          {!images.length && !busy ? (
            <div className="image-empty">
              <ImagePlus size={42} strokeWidth={1} />
              <Empty title="Make room for imagination">Your images will appear here.</Empty>
            </div>
          ) : (
            <div className="image-gallery">
              {images.map((image, index) => (
                <figure key={`${image.url}-${index}`}>
                  <a href={image.url} target="_blank" rel="noreferrer">
                    <img src={image.url} alt={image.prompt} />
                  </a>
                  <figcaption>
                    <span>{image.prompt}</span>
                    <a
                      className="icon-button"
                      href={image.url}
                      download
                      aria-label="Download image"
                    >
                      <Download size={18} />
                    </a>
                  </figcaption>
                  <button onClick={() => setSource(image.url)}>Use as reference</button>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
