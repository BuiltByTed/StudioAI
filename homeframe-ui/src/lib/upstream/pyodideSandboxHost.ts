type MessageListener = (event: MessageEvent) => void;
type ErrorListener = (event: Event) => void;
type QueuedMessage = { message: unknown; transfer: Transferable[] };

// A separate opaque-origin document keeps Python's evaluator out of the app's
// restrictive script policy. Never add allow-same-origin to this frame.
export class PyodideSandboxHost {
  onmessage: MessageListener | null = null;
  onerror: ErrorListener | null = null;

  private iframe: HTMLIFrameElement;
  private ready = false;
  private queue: QueuedMessage[] = [];
  private messageListeners = new Set<MessageListener>();
  private errorListeners = new Set<ErrorListener>();
  private onWindowMessage: (event: MessageEvent) => void;
  private onIframeLoad: () => void;
  private onIframeError: (event: Event) => void;

  constructor() {
    this.iframe = document.createElement('iframe');
    this.iframe.setAttribute('sandbox', 'allow-scripts');
    this.iframe.setAttribute('aria-hidden', 'true');
    this.iframe.setAttribute('title', 'pyodide-sandbox');
    this.iframe.style.display = 'none';
    this.iframe.src = '/python-sandbox.html';

    this.onWindowMessage = (event: MessageEvent) => {
      if (event.source !== this.iframe.contentWindow) {
        return;
      }

      const messageEvent = { data: event.data } as MessageEvent;
      this.onmessage?.(messageEvent);
      for (const listener of this.messageListeners) {
        listener(messageEvent);
      }
    };

    this.onIframeLoad = () => {
      this.ready = true;
      for (const item of this.queue) {
        this.post(item.message, item.transfer);
      }
      this.queue = [];
    };

    this.onIframeError = (event: Event) => {
      this.onerror?.(event);
      for (const listener of this.errorListeners) {
        listener(event);
      }
    };

    window.addEventListener('message', this.onWindowMessage);
    this.iframe.addEventListener('load', this.onIframeLoad, { once: true });
    this.iframe.addEventListener('error', this.onIframeError);
    document.body.appendChild(this.iframe);
  }

  postMessage(message: unknown, transfer: Transferable[] = []) {
    if (this.ready) {
      this.post(message, transfer);
    } else {
      this.queue.push({ message, transfer });
    }
  }

  addEventListener(type: 'message' | 'error', listener: MessageListener | ErrorListener) {
    if (type === 'message') {
      this.messageListeners.add(listener as MessageListener);
    } else if (type === 'error') {
      this.errorListeners.add(listener as ErrorListener);
    }
  }

  removeEventListener(type: 'message' | 'error', listener: MessageListener | ErrorListener) {
    if (type === 'message') {
      this.messageListeners.delete(listener as MessageListener);
    } else if (type === 'error') {
      this.errorListeners.delete(listener as ErrorListener);
    }
  }

  terminate() {
    window.removeEventListener('message', this.onWindowMessage);
    this.iframe.removeEventListener('load', this.onIframeLoad);
    this.iframe.removeEventListener('error', this.onIframeError);
    this.messageListeners.clear();
    this.errorListeners.clear();
    this.onmessage = null;
    this.onerror = null;
    this.iframe.remove();
  }

  private post(message: unknown, transfer: Transferable[]) {
    this.iframe.contentWindow?.postMessage(message, '*', transfer);
  }
}
