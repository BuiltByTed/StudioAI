import { lazy, Suspense, useEffect, useState } from 'react';
import {
  AppScrollView,
  AppShell,
  AppSidebarLabel,
  AppSidebarTrigger,
  AppViewport,
  HomeframeErrorBoundary,
  HomeframeProvider,
  HomeframeRecovery,
  HomeframeRouterProvider,
  HomeframeSelect,
  Link,
  NavLink,
  RouterOutlet,
  createHomeframeRouter,
  useRouteScrollRestoration,
  useRouterSnapshot,
  useHomeframeUpdate,
} from '@builtbyted/homeframe';
import {
  Archive,
  ArrowUpRight,
  Blocks,
  Code2,
  CalendarDays,
  FolderOpen,
  ChevronDown,
  FileText,
  Image,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
} from 'lucide-react';
import { SessionProvider, useSession } from './lib/session';
import { ChatProvider, useChat } from './lib/chat';
import { api, download, segment } from './lib/api';
import { WatchRedirect, UnavailableChannel } from './pages/Compatibility';
import { AuthPage } from './pages/Auth';
import { ChatPage } from './pages/Chat';
const PlaygroundPage = lazy(() =>
  import('./pages/Playground').then((module) => ({ default: module.PlaygroundPage })),
);
const ImagesPage = lazy(() =>
  import('./pages/Images').then((module) => ({ default: module.ImagesPage })),
);
const SearchPage = lazy(() =>
  import('./pages/Search').then((module) => ({ default: module.SearchPage })),
);
const NotesPage = lazy(() =>
  import('./pages/Notes').then((module) => ({ default: module.NotesPage })),
);
const WorkspacePage = lazy(() =>
  import('./pages/Workspace').then((module) => ({ default: module.WorkspacePage })),
);
const SettingsPage = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.SettingsPage })),
);
const AdminPage = lazy(() =>
  import('./pages/Admin').then((module) => ({ default: module.AdminPage })),
);
const FoldersPage = lazy(() =>
  import('./pages/Folders').then((module) => ({ default: module.FoldersPage })),
);
const CalendarPage = lazy(() =>
  import('./pages/Calendar').then((module) => ({ default: module.CalendarPage })),
);
const SharedPage = lazy(() =>
  import('./pages/Shared').then((module) => ({ default: module.SharedPage })),
);
const SecurityPage = lazy(() =>
  import('./pages/Security').then((module) => ({ default: module.SecurityPage })),
);
const MemoriesPage = lazy(() =>
  import('./pages/Memories').then((module) => ({ default: module.MemoriesPage })),
);
const PeoplePage = lazy(() =>
  import('./pages/People').then((module) => ({ default: module.PeoplePage })),
);
const ReportsPage = lazy(() =>
  import('./pages/Reports').then((module) => ({ default: module.ReportsPage })),
);
const AutomationsPage = lazy(() =>
  import('./pages/Automations').then((module) => ({ default: module.AutomationsPage })),
);
import { Composer } from './components/Composer';
import { InteractionPanel } from './components/InteractionPanel';
import { ConversationActions } from './components/ConversationActions';
import { ImageWorkspaceProvider } from './lib/imageWorkspace';
import { Action, Busy, Empty, ErrorNotice } from './components/ui';

const router = createHomeframeRouter([
  {
    id: 'recovery',
    path: '/__homeframe/recovery',
    element: (
      <div className="page">
        <HomeframeRecovery />
      </div>
    ),
  },
  { id: 'chat', path: '/', element: <ChatPage /> },
  { id: 'home', path: '/home', element: <ChatPage /> },
  { id: 'watch', path: '/watch', element: <WatchRedirect /> },
  { id: 'error', path: '/error', element: <HomeframeRecovery /> },
  { id: 'channel', path: '/channels/:id', element: <UnavailableChannel /> },
  { id: 'encrypted-channel', path: '/channels/:id/encrypted', element: <UnavailableChannel /> },
  { id: 'conversation', path: '/c/:id', element: <ChatPage /> },
  { id: 'auth', path: '/auth', element: <AuthPage /> },
  { id: 'search', path: '/search', element: <SearchPage /> },
  { id: 'archive', path: '/archive', element: <SearchPage archived /> },
  { id: 'playground', path: '/playground', element: <PlaygroundPage /> },
  { id: 'completions', path: '/playground/completions', element: <PlaygroundPage /> },
  { id: 'images', path: '/playground/images', element: <ImagesPage /> },
  { id: 'notes', path: '/notes', element: <NotesPage /> },
  { id: 'note', path: '/notes/:id', element: <NotesPage /> },
  { id: 'workspace', path: '/workspace', element: <WorkspacePage /> },
  ...['models', 'knowledge', 'prompts', 'tools', 'skills', 'functions'].flatMap((kind) => [
    { id: kind, path: `/workspace/${kind}`, element: <WorkspacePage /> },
    { id: `${kind}-edit`, path: `/workspace/${kind}/:id`, element: <WorkspacePage /> },
  ]),
  { id: 'folders', path: '/folders', element: <FoldersPage /> },
  { id: 'folder', path: '/folders/:id', element: <FoldersPage /> },
  { id: 'calendar', path: '/calendar', element: <CalendarPage /> },
  { id: 'automations', path: '/automations', element: <AutomationsPage /> },
  { id: 'automation', path: '/automations/:id', element: <AutomationsPage /> },
  { id: 'shared', path: '/s/:id', element: <SharedPage /> },
  { id: 'settings', path: '/settings', element: <SettingsPage /> },
  { id: 'security', path: '/settings/security', element: <SecurityPage /> },
  { id: 'memories', path: '/settings/memories', element: <MemoriesPage /> },
  { id: 'admin', path: '/admin', element: <AdminPage /> },
  { id: 'admin-users', path: '/admin/users', element: <PeoplePage /> },
  { id: 'admin-users-tab', path: '/admin/users/:tab', element: <PeoplePage /> },
  ...['analytics', 'evaluations', 'functions'].flatMap((kind) => [
    {
      id: `admin-${kind}`,
      path: `/admin/${kind}`,
      element: kind === 'functions' ? <WorkspacePage /> : <ReportsPage />,
    },
    {
      id: `admin-${kind}-tab`,
      path: `/admin/${kind}/:tab`,
      element: kind === 'functions' ? <WorkspacePage /> : <ReportsPage />,
    },
  ]),
  { id: 'admin-settings', path: '/admin/settings', element: <AdminPage /> },
  { id: 'admin-settings-tab', path: '/admin/settings/:tab', element: <AdminPage /> },
  {
    id: 'missing',
    path: '*',
    element: (
      <Empty title="That page isn't here." to="/" action="Start a conversation">
        Try returning to your workspace.
      </Empty>
    ),
  },
]);
export function App() {
  return (
    <HomeframeProvider>
      <HomeframeRouterProvider router={router}>
        <SessionProvider>
          <AccountApplication />
        </SessionProvider>
      </HomeframeRouterProvider>
    </HomeframeProvider>
  );
}
function AccountApplication() {
  const { user } = useSession();
  // Recreate all account-owned realtime state when the identity changes.
  return (
    <ChatProvider key={user?.id ?? 'anonymous'}>
      <ImageWorkspaceProvider key={user?.id ?? 'anonymous'} account={user?.id ?? 'anonymous'}>
        <ApplicationShell />
      </ImageWorkspaceProvider>
    </ChatProvider>
  );
}
function ApplicationShell() {
  const session = useSession();
  const route = useRouterSnapshot();
  const restoration = useRouteScrollRestoration();
  const isChat =
    route.url.pathname === '/' ||
    route.url.pathname === '/home' ||
    route.url.pathname.startsWith('/c/');
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      let choice = 'system';
      try {
        choice = localStorage.getItem('studio:theme') ?? 'system';
      } catch {}
      document.documentElement.dataset.theme =
        choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    };
    apply();
    media.addEventListener('change', apply);
    window.addEventListener('studio:theme', apply);
    return () => {
      media.removeEventListener('change', apply);
      window.removeEventListener('studio:theme', apply);
    };
  }, []);
  return (
    <AppViewport className="studio-viewport">
      <AppShell
        className="studio-shell"
        header={<Header />}
        headerAttachment={<UpdateNotice />}
        sidebar={session.user ? <Sidebar /> : undefined}
        sidebarFooter={session.user ? <Account /> : undefined}
        sidebarLabel="Workspace navigation"
        sidePanel={<InteractionPanel />}
        headerPlacement="content"
        mobileSidebarTrigger={false}
        mobileSidebarDismiss={false}
        bottom={session.user && isChat ? <Composer /> : undefined}
        bottomKeyboard="avoid"
      >
        <AppScrollView
          className="page-scroll"
          scrollKey={restoration.scrollKey}
          navigationType={restoration.direction}
          scrollBehavior={restoration.scrollBehavior}
          permalinkScroll={restoration.permalinkScroll}
        >
          <HomeframeErrorBoundary
            fallback={(error, retry) => (
              <div className="page">
                <ErrorNotice error={error.message} retry={retry} />
              </div>
            )}
          >
            {route.url.pathname === '/__homeframe/recovery' ? (
              <Suspense fallback={<Busy />}>
                <RouterOutlet />
              </Suspense>
            ) : session.loading ? (
              <Busy label="Opening your workspace…" />
            ) : session.error ? (
              <div className="page">
                <ErrorNotice error={session.error} retry={() => void session.refresh()} />
              </div>
            ) : session.user?.role === 'pending' ? (
              <Empty title="Your account is awaiting approval">
                An administrator needs to approve your account.
                <Action run={session.logout}>Sign out</Action>
              </Empty>
            ) : session.user || route.url.pathname.startsWith('/s/') ? (
              <Suspense fallback={<Busy />}>
                <RouterOutlet />
              </Suspense>
            ) : (
              <AuthPage />
            )}
          </HomeframeErrorBoundary>
        </AppScrollView>
      </AppShell>
    </AppViewport>
  );
}
function UpdateNotice() {
  const update = useHomeframeUpdate();
  if (!['ready', 'deferred'].includes(update.state)) return null;
  return (
    <div className="update-notice" role="status">
      <span>
        {update.state === 'deferred'
          ? 'The update will wait until your work is saved and running jobs finish.'
          : 'An update is ready.'}
      </span>
      <Action run={update.activate}>Update when ready</Action>
      <button onClick={update.defer}>Later</button>
    </div>
  );
}
function Sidebar() {
  const chat = useChat();
  const { config, user } = useSession();
  return (
    <>
      <Link className="brand" to="/">
        <span className="brand-symbol">
          <Sparkles size={22} />
        </span>
        <AppSidebarLabel>
          <strong>
            Studio AI<span className="brand-dot">.</span>
          </strong>
          <small>Built by Ted</small>
        </AppSidebarLabel>
      </Link>
      <nav className="primary-nav">
        <Link to="/" className="new-chat">
          <Plus size={18} />
          <AppSidebarLabel>New conversation</AppSidebarLabel>
          <AppSidebarLabel className="shortcut">↗</AppSidebarLabel>
        </Link>
        {(user?.role === 'admin' || user?.permissions?.chat?.temporary) && (
          <Link to="/?temporary-chat=true">
            <MessageSquare size={18} />
            <AppSidebarLabel>Temporary conversation</AppSidebarLabel>
          </Link>
        )}
        {[
          { to: '/search', icon: Search, label: 'Search chats' },
          { to: '/playground/images', icon: Image, label: 'Image studio' },
          { to: '/notes', icon: FileText, label: 'Notes' },
          ...(config.features?.enable_folders
            ? [{ to: '/folders', icon: FolderOpen, label: 'Folders' }]
            : []),
          ...(config.features?.enable_calendar
            ? [{ to: '/calendar', icon: CalendarDays, label: 'Calendar' }]
            : []),
          ...(config.features?.enable_automations
            ? [{ to: '/automations', icon: CalendarDays, label: 'Scheduled tasks' }]
            : []),
          { to: '/workspace/models', icon: Blocks, label: 'Workspace' },
          ...(user?.role === 'admin'
            ? [{ to: '/playground', icon: Code2, label: 'Playground' }]
            : []),
        ].map((item) => (
          <NavLink key={item.to} to={item.to}>
            <item.icon size={18} />
            <AppSidebarLabel>{item.label}</AppSidebarLabel>
          </NavLink>
        ))}
      </nav>
      <div className="history-heading">
        <AppSidebarLabel>RECENT CONVERSATIONS</AppSidebarLabel>
        <Link to="/archive" aria-label="Archived conversations">
          <Archive size={15} />
        </Link>
      </div>
      <nav className="history-nav" aria-label="Recent conversations">
        {chat.list.length ? (
          chat.list.map((item) => (
            <NavLink key={item.id} to={`/c/${segment(item.id)}`} title={item.title}>
              <MessageSquare size={15} />
              <AppSidebarLabel>{item.title}</AppSidebarLabel>
              {item.active && <span className="status-dot" />}
            </NavLink>
          ))
        ) : (
          <AppSidebarLabel className="history-empty">
            A good conversation starts here.
          </AppSidebarLabel>
        )}
      </nav>
    </>
  );
}
function Account() {
  const { user } = useSession();
  return (
    <div className="sidebar-account">
      <Link to="/settings" className="account-link">
        <span className="avatar">{user?.name.slice(0, 1).toUpperCase()}</span>
        <AppSidebarLabel>
          <strong>{user?.name}</strong>
          <small>Your workspace</small>
        </AppSidebarLabel>
        <Settings size={16} />
      </Link>
      {user?.role === 'admin' && (
        <Link className="admin-link" to="/admin/users">
          <Shield size={13} />
          <AppSidebarLabel>Administration</AppSidebarLabel>
        </Link>
      )}
    </div>
  );
}
function Header() {
  const { user, models } = useSession();
  const chat = useChat();
  const route = useRouterSnapshot();
  const isChat =
    route.url.pathname === '/' ||
    route.url.pathname === '/home' ||
    route.url.pathname.startsWith('/c/');
  return (
    <header className="top-bar">
      <div className="header-leading">
        {user && (
          <AppSidebarTrigger className="icon-button mobile-menu">
            <Menu size={21} />
          </AppSidebarTrigger>
        )}
        {user && isChat ? (
          <div className="model-picker">
            <HomeframeSelect
              aria-label="Chat model"
              value={chat.model}
              onChange={(event) => chat.setModel(event.target.value)}
            >
              {!models.length && <option value="">No models available</option>}
              {models.map((model) => (
                <option value={model.id} key={model.id}>
                  {model.name || model.id}
                </option>
              ))}
            </HomeframeSelect>
          </div>
        ) : (
          <Link className="header-title" to="/">
            Studio AI{' '}
            <span>
              /{' '}
              {route.url.pathname.startsWith('/workspace')
                ? 'Workspace'
                : route.url.pathname.startsWith('/admin')
                  ? 'Administration'
                  : route.url.pathname.includes('images')
                    ? 'Image studio'
                    : route.url.pathname.includes('notes')
                      ? 'Notes'
                      : route.url.pathname.includes('settings')
                        ? 'Settings'
                        : 'Workspace'}
            </span>
          </Link>
        )}
      </div>
      {user && (
        <div className="header-actions">
          {isChat && chat.chat?.id && !chat.temporary && <ConversationActions key={chat.chat.id} />}
          <Link to="/" className="icon-button" aria-label="New conversation">
            <Plus size={20} />
          </Link>
        </div>
      )}
    </header>
  );
}
