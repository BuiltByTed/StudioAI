import { useEffect, useState } from 'react';
import {
  AppScrollView,
  AppShell,
  AppSidebarLabel,
  AppSidebarTrigger,
  AppViewport,
  HomeframeErrorBoundary,
  HomeframeProvider,
  HomeframeRouterProvider,
  HomeframeSelect,
  Link,
  NavLink,
  RouterOutlet,
  createHomeframeRouter,
  useRouteScrollRestoration,
  useRouterSnapshot,
} from '@builtbyted/homeframe';
import {
  Archive,
  ArrowUpRight,
  Blocks,
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
import { AuthPage } from './pages/Auth';
import { ChatPage } from './pages/Chat';
import { ImagesPage } from './pages/Images';
import { SearchPage } from './pages/Search';
import { NotesPage } from './pages/Notes';
import { WorkspacePage } from './pages/Workspace';
import { SettingsPage } from './pages/Settings';
import { AdminPage } from './pages/Admin';
import { FoldersPage } from './pages/Folders';
import { CalendarPage } from './pages/Calendar';
import { SharedPage } from './pages/Shared';
import { Composer } from './components/Composer';
import { Action, Busy, Empty, ErrorNotice } from './components/ui';

const router = createHomeframeRouter([
  { id: 'chat', path: '/', element: <ChatPage /> },
  { id: 'home', path: '/home', element: <ChatPage /> },
  { id: 'conversation', path: '/c/:id', element: <ChatPage /> },
  { id: 'auth', path: '/auth', element: <AuthPage /> },
  { id: 'search', path: '/search', element: <SearchPage /> },
  { id: 'archive', path: '/archive', element: <SearchPage archived /> },
  { id: 'images', path: '/playground/images', element: <ImagesPage /> },
  { id: 'notes', path: '/notes', element: <NotesPage /> },
  { id: 'note', path: '/notes/:id', element: <NotesPage /> },
  { id: 'workspace', path: '/workspace', element: <WorkspacePage /> },
  ...['models', 'knowledge', 'prompts', 'tools', 'skills'].flatMap((kind) => [
    { id: kind, path: `/workspace/${kind}`, element: <WorkspacePage /> },
    { id: `${kind}-edit`, path: `/workspace/${kind}/:id`, element: <WorkspacePage /> },
  ]),
  { id: 'folders', path: '/folders', element: <FoldersPage /> },
  { id: 'folder', path: '/folders/:id', element: <FoldersPage /> },
  { id: 'calendar', path: '/calendar', element: <CalendarPage /> },
  { id: 'shared', path: '/s/:id', element: <SharedPage /> },
  { id: 'settings', path: '/settings', element: <SettingsPage /> },
  { id: 'admin', path: '/admin', element: <AdminPage /> },
  { id: 'admin-users', path: '/admin/users', element: <AdminPage /> },
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
          <ChatProvider>
            <ApplicationShell />
          </ChatProvider>
        </SessionProvider>
      </HomeframeRouterProvider>
    </HomeframeProvider>
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
    document.documentElement.dataset.theme = localStorage.getItem('studio:theme') ?? 'system';
  }, []);
  return (
    <AppViewport className="studio-viewport">
      <AppShell
        className="studio-shell"
        header={<Header />}
        sidebar={session.user ? <Sidebar /> : undefined}
        sidebarFooter={session.user ? <Account /> : undefined}
        sidebarLabel="Workspace navigation"
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
            {session.loading ? (
              <Busy label="Opening your workspace…" />
            ) : session.error ? (
              <div className="page">
                <ErrorNotice error={session.error} retry={() => void session.refresh()} />
              </div>
            ) : session.user || route.url.pathname.startsWith('/s/') ? (
              <RouterOutlet />
            ) : (
              <AuthPage />
            )}
          </HomeframeErrorBoundary>
        </AppScrollView>
      </AppShell>
    </AppViewport>
  );
}
function Sidebar() {
  const chat = useChat();
  const { config } = useSession();
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
          <small>Open WebUI</small>
        </AppSidebarLabel>
      </Link>
      <nav className="primary-nav">
        <Link to="/" className="new-chat">
          <Plus size={18} />
          <AppSidebarLabel>New conversation</AppSidebarLabel>
          <AppSidebarLabel className="shortcut">↗</AppSidebarLabel>
        </Link>
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
          { to: '/workspace/models', icon: Blocks, label: 'Workspace' },
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
                        : 'Open WebUI'}
            </span>
          </Link>
        )}
      </div>
      {user && (
        <div className="header-actions">
          {isChat && chat.chat?.id && (
            <details className="chat-menu">
              <summary aria-label="Conversation actions">
                <MoreHorizontal size={21} />
              </summary>
              <div>
                <Action run={async () => download(`${chat.chat!.title}.json`, chat.chat)}>
                  Export
                </Action>
                <Action
                  run={async () => {
                    await api(`/api/v1/chats/${segment(chat.chat!.id)}/pin`, {});
                    await chat.refreshList();
                  }}
                >
                  Pin / unpin
                </Action>
                <Action
                  run={async () => {
                    await api(`/api/v1/chats/${segment(chat.chat!.id)}/archive`, {});
                    await chat.refreshList();
                  }}
                >
                  Archive / restore
                </Action>
              </div>
            </details>
          )}
          <Link to="/" className="icon-button" aria-label="New conversation">
            <Plus size={20} />
          </Link>
        </div>
      )}
    </header>
  );
}
