import React, { useState } from 'react';
import { Calendar, Check, Loader2 } from 'lucide-react';
import type { EventConfig } from '@/types';
import { connectGoogleCalendar, disconnectGoogleCalendar } from '@/lib/firebase';
import { toast } from '@/components/common/Toast';

interface GoogleCodeClientConfig {
  client_id: string;
  scope: string;
  ux_mode?: 'popup' | 'redirect';
  access_type?: 'offline' | 'online';
  prompt?: string;
  callback: (response: { code?: string; error?: string }) => void;
}

interface GoogleCodeClient {
  requestCode: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (config: GoogleCodeClientConfig) => GoogleCodeClient;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = (
  (import.meta as unknown as { env?: Record<string, string> }).env || {}
).VITE_GOOGLE_OAUTH_CLIENT_ID;

interface GoogleCalendarConnectProps {
  config: EventConfig;
}

export const GoogleCalendarConnect: React.FC<GoogleCalendarConnectProps> = ({ config }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // This feature is opt-in per deployment — if whoever built/hosts this
  // instance hasn't set up a Google OAuth client, don't show a button
  // that can't work.
  if (!GOOGLE_CLIENT_ID) return null;

  const handleConnect = () => {
    if (!window.google?.accounts?.oauth2) {
      toast.error('Google Sign-In has not finished loading yet — please try again in a moment.', 'Not Ready');
      return;
    }

    setIsConnecting(true);
    const codeClient = window.google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      ux_mode: 'popup',
      access_type: 'offline',
      prompt: 'consent',
      callback: async (response) => {
        if (!response.code) {
          setIsConnecting(false);
          if (response.error) {
            toast.error('Google Calendar connection was cancelled or failed.', 'Not Connected');
          }
          return;
        }
        const ok = await connectGoogleCalendar(config.id, config.adminKey, response.code);
        setIsConnecting(false);
        if (ok) {
          toast.success(
            'New shift claims will now automatically invite staff to their shift.',
            'Google Calendar Connected'
          );
        } else {
          toast.error('Could not connect Google Calendar. Please try again.', 'Connection Failed');
        }
      },
    });
    codeClient.requestCode();
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    const ok = await disconnectGoogleCalendar(config.id, config.adminKey);
    setIsDisconnecting(false);
    if (ok) {
      toast.info('Google Calendar disconnected. New claims will no longer send invites.');
    } else {
      toast.error('Could not disconnect Google Calendar. Please try again.', 'Failed');
    }
  };

  return (
    <div className="bg-white border border-[#d8dce0] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center space-x-3 min-w-0">
        <div
          className={`p-2 rounded border shrink-0 ${
            config.googleCalendarConnected
              ? 'bg-[#e6f5ec] border-[#a3e0be] text-[#00823b]'
              : 'bg-[#e5f2f8] border-[#b9dcf0] text-[#0063a3]'
          }`}
        >
          <Calendar className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-[#252a2e]">Google Calendar Invites</div>
          <p className="text-[11px] text-[#7c878e]">
            {config.googleCalendarConnected
              ? 'Connected — staff are automatically invited when they claim a shift.'
              : 'Connect your Google Calendar to automatically invite staff when they claim a shift.'}
          </p>
        </div>
      </div>

      {config.googleCalendarConnected ? (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="focus-ring shrink-0 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#e6f5ec] hover:bg-[#d9efe2] text-[#00823b] border border-[#a3e0be] transition-colors cursor-pointer disabled:opacity-50"
        >
          {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          <span>{isDisconnecting ? 'Disconnecting...' : 'Connected'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={isConnecting}
          className="focus-ring shrink-0 px-3.5 py-2 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
        >
          {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
          <span>{isConnecting ? 'Connecting...' : 'Connect Google Calendar'}</span>
        </button>
      )}
    </div>
  );
};
