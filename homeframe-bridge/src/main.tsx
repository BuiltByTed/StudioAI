import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type HTMLAttributes } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell, AppViewport, AppScrollView, useHomeframeReadiness, useHomeframeUpdate, HomeframeProvider, HomeframePortal } from '@builtbyted/homeframe';
import '@builtbyted/homeframe/styles.css';
import './shell.css';

type Region = 'content' | 'header' | 'sidebar' | 'bottom' | 'scroll' | 'portal';
interface State { sidebar: boolean; sidebarOpen: boolean; mobile: boolean; ready: boolean; busy: boolean; route: string }
interface Entry { id: number; node: HTMLElement; region: Region }
interface Snapshot { state: State; entries: readonly Entry[] }
let snapshot: Snapshot = { state: { sidebar: false, sidebarOpen: false, mobile: false, ready: false, busy: false, route: '/' }, entries: [] };
let nextId = 0;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

const api = {
  state(patch: Partial<State>) { snapshot = { ...snapshot, state: { ...snapshot.state, ...patch } }; publish(); },
  region(node: HTMLElement, region: Region) {
    const id = ++nextId;
    snapshot = { ...snapshot, entries: [...snapshot.entries, { id, node, region }] }; publish();
    return () => { snapshot = { ...snapshot, entries: snapshot.entries.filter(entry => entry.id !== id) }; publish(); };
  },
};
declare global { interface Window { studioHomeframe?: typeof api } }
window.studioHomeframe = api;

// Svelte remains the owner of these nodes, their controls and their state. Only
// their placement is delegated to the persistent Homeframe shell.
function RegionSlot({ entries, region }: { entries: readonly Entry[]; region: Region }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = ref.current;
    if (!target) return;
    for (const entry of entries.filter(item => item.region === region)) {
      if (entry.node.parentNode !== target) target.append(entry.node);
    }
  }, [entries, region]);
  return <div ref={ref} className={`studio-frame-slot studio-frame-${region}`} />;
}

function PrimaryScroll({ node, route }: { node: HTMLElement; route: string }) {
  // AppScrollView's supported polymorphic element hook attaches its behavior to
  // the existing Svelte scroller. It does not create a second scroll container.
  const Element = useMemo(() => forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function ExistingScroll(props, ref) {
    useLayoutEffect(() => {
      node.setAttribute('data-hf-scroll-view', '');
      if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
      const scroll = (event: Event) => props.onScroll?.(event as unknown as React.UIEvent<HTMLElement>);
      node.addEventListener('scroll', scroll);
      return () => {
        node.removeAttribute('data-hf-scroll-view');
        node.removeEventListener('scroll', scroll);
        if (typeof ref === 'function') ref(null); else if (ref) ref.current = null;
      };
    }, [ref, props.onScroll]);
    return null;
  }), [node]);
  return <AppScrollView as={Element} scrollKey={route} scrollBehavior="preserve" />;
}

function Shell() {
  const { state, entries } = useSyncExternalStore(subscribe, () => snapshot);
  const readiness = useHomeframeReadiness();
  const update = useHomeframeUpdate();
  useLayoutEffect(() => state.ready ? undefined : readiness.hold('Existing application startup'), [state.ready, readiness.hold]);
  useEffect(() => update.registerGuard(() => !snapshot.state.busy && !document.querySelector('[data-studio-unsaved="true"], #note-editor')), [update.registerGuard]);
  useEffect(() => {
    if (['ready', 'deferred'].includes(update.state)) {
      window.dispatchEvent(new CustomEvent('studio-frame-update', { detail: {
        deferred: update.state === 'deferred', activate: update.activate, defer: update.defer,
      } }));
    }
  }, [update.state, update.activate, update.defer]);
  const scroller = entries.filter(entry => entry.region === 'scroll').at(-1)?.node;
  const bottom = entries.some(entry => entry.region === 'bottom');
  const sidebar = (open: boolean) => window.dispatchEvent(new CustomEvent('studio-frame-sidebar', { detail: open }));
  return <AppViewport>
    <AppShell
      header={<RegionSlot entries={entries} region="header" />}
      headerPlacement="content"
      sidebar={state.sidebar ? <RegionSlot entries={entries} region="sidebar" /> : undefined}
      sidebarMode={state.sidebarOpen ? 'expanded' : 'rail'}
      onSidebarModeChange={mode => sidebar(mode === 'expanded')}
      mobileSidebarOpen={state.mobile && state.sidebarOpen}
      onMobileSidebarOpenChange={sidebar}
      mobileSidebarTrigger={false} mobileSidebarDismiss={false} sidebarReveal={false}
      bottom={bottom ? <RegionSlot entries={entries} region="bottom" /> : undefined}
    >
      <RegionSlot entries={entries} region="content" />
      {scroller && <PrimaryScroll node={scroller} route={state.route} />}
    </AppShell>
    <HomeframePortal><RegionSlot entries={entries} region="portal" /></HomeframePortal>
  </AppViewport>;
}

const root = document.getElementById('homeframe-root');
if (!root) throw new Error('Missing Homeframe mount.');
createRoot(root).render(<HomeframeProvider><Shell /></HomeframeProvider>);
window.dispatchEvent(new Event('studio-frame-ready'));

if (import.meta.env.VITE_STUDIO_QA_TRACE === 'true') void import('../tests/viewport-trace');
