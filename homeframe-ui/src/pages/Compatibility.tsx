import { useEffect } from 'react';
import { useNavigate, useRouterSnapshot } from '@builtbyted/homeframe';
import { Busy, Empty } from '../components/ui';
import { useSession } from '../lib/session';
export function WatchRedirect() {
  const navigate = useNavigate(),
    route = useRouterSnapshot(),
    video = route.url.searchParams.get('v');
  useEffect(() => {
    void navigate(video ? `/?youtube=${encodeURIComponent(video)}` : '/', { replace: true });
  }, [video, navigate]);
  return <Busy label="Opening video context…" />;
}
export function UnavailableChannel() {
  const { config } = useSession();
  return (
    <Empty
      title={
        config.features?.enable_channels
          ? 'Channel support is not available in this interface yet'
          : 'Channels are not enabled in this workspace'
      }
      to="/"
      action="Open conversations"
    >
      Your saved conversations and workspace remain available. Channel data has not been changed.
    </Empty>
  );
}
