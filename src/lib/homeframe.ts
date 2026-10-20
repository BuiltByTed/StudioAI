import { browser } from '$app/environment';

type Region = 'content' | 'header' | 'sidebar' | 'bottom' | 'scroll' | 'portal';
type FrameState = {
	sidebar: boolean;
	sidebarOpen: boolean;
	mobile: boolean;
	ready: boolean;
	busy: boolean;
	route: string;
};
interface Bridge {
	state(patch: Partial<FrameState>): void;
	region(node: HTMLElement, region: Region): () => void;
}
declare global {
	interface Window {
		studioHomeframe?: Bridge;
	}
}

export function frameState(state: Partial<FrameState>) {
	if (!browser) return;
	if (window.studioHomeframe) window.studioHomeframe.state(state);
	else
		window.addEventListener('studio-frame-ready', () => window.studioHomeframe?.state(state), {
			once: true
		});
}

export function frameRegion(node: HTMLElement, region: Region | false) {
	let cleanup: (() => void) | undefined;
	const attach = () => {
		if (region) cleanup = window.studioHomeframe?.region(node, region);
	};
	if (window.studioHomeframe) attach();
	else window.addEventListener('studio-frame-ready', attach, { once: true });
	return {
		update(next: Region | false) {
			cleanup?.();
			region = next;
			attach();
		},
		destroy() {
			cleanup?.();
			window.removeEventListener('studio-frame-ready', attach);
			node.remove();
		}
	};
}
