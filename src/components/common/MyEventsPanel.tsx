import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ExternalLink, History, Loader2, Shield, Trash2, Users, X } from 'lucide-react';
import { storage } from '@/lib/storage';
import { fetchEventByKey, deleteEventRemote } from '@/lib/firebase';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/common/Toast';
import type { EventConfig } from '@/types';

interface MyEventsPanelProps {
  onClose: () => void;
}

interface VerifiedEntry {
  config: EventConfig;
  // false when the database couldn't be reached to confirm this entry —
  // it's shown from local cache only, and might be stale or already gone.
  confirmed: boolean;
}

export const MyEventsPanel: React.FC<MyEventsPanelProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<VerifiedEntry[]>([]);
  const [isVerifying, setIsVerifying] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const candidates = storage.listLocalEvents();
      const results = await Promise.all(
        candidates.map(async (evt): Promise<VerifiedEntry | null> => {
          try {
            const result = await fetchEventByKey(evt.adminKey);
            if (!result) {
              // Confirmed gone from the database — stop showing it, and
              // stop caching it locally too.
              storage.deleteEvent(evt.id);
              return null;
            }
            return { config: result.data.config, confirmed: true };
          } catch {
            // Couldn't reach the database to confirm this one right now —
            // show it from local cache, but flagged as unverified rather
            // than presented as current, confirmed data.
            return { config: evt, confirmed: false };
          }
        })
      );

      if (!cancelled) {
        setEntries(
          results
            .filter((r): r is VerifiedEntry => r !== null)
            .sort((a, b) => (b.config.updatedAt || '').localeCompare(a.config.updatedAt || ''))
        );
        setIsVerifying(false);
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (evt: EventConfig) => {
    if (!window.confirm(`Permanently delete "${evt.title}"? This removes it for everyone and cannot be undone.`)) {
      return;
    }

    setDeletingId(evt.id);
    const ok = await deleteEventRemote(evt.id, evt.adminKey);
    setDeletingId(null);

    if (ok) {
      storage.deleteEvent(evt.id);
      setEntries((prev) => prev.filter((e) => e.config.id !== evt.id));
      toast.success(`"${evt.title}" was deleted.`, 'Event Deleted');
    } else {
      toast.error('Could not delete this event. Check your connection and try again.', 'Delete Failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-[#d8dce0] rounded max-w-lg w-full max-h-[80vh] flex flex-col shadow-modus-3">
        <div className="flex items-start justify-between p-5 border-b border-[#d8dce0]">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#252a2e]">Events on This Device</h3>
              <p className="text-xs text-[#46535e] mt-0.5 max-w-sm">
                Events you've created or opened in this browser, confirmed live against the database
                just now — not a cached list. This does not include events from other devices or
                browsers you haven't used.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring p-1.5 text-[#7c878e] hover:text-[#252a2e] rounded hover:bg-[#f1f3f6] transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isVerifying ? (
            <div className="py-10 flex flex-col items-center justify-center text-xs text-[#7c878e] space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#0063a3]" />
              <span>Confirming against the database...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#7c878e]">
              No events found in this browser yet.
            </div>
          ) : (
            entries.map(({ config: evt, confirmed }) => (
              <div
                key={evt.id}
                className="p-3 bg-[#f8f9fa] border border-[#d8dce0] rounded flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#252a2e] truncate flex items-center gap-1.5">
                    <span className="truncate">{evt.title}</span>
                    {!confirmed && (
                      <span
                        className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#fef8e8] text-[#8a5800] border border-[#f7c970]"
                        title="Couldn't reach the database to confirm this is still current"
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>Unverified</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#7c878e] flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatDate(evt.startDate)} &ndash; {formatDate(evt.endDate)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`#/admin/${evt.adminKey}`}
                    onClick={onClose}
                    className="focus-ring px-2.5 py-1.5 rounded text-[11px] font-semibold bg-[#0063a3] hover:bg-[#005084] text-white flex items-center gap-1 transition-colors"
                    title="Open as admin"
                  >
                    <Shield className="w-3 h-3" />
                    <span>Admin</span>
                  </a>
                  <a
                    href={`#/event/${evt.publicKey}`}
                    onClick={onClose}
                    className="focus-ring px-2.5 py-1.5 rounded text-[11px] font-semibold bg-white hover:bg-[#f1f3f6] text-[#0063a3] border border-[#0063a3] flex items-center gap-1 transition-colors"
                    title="Open staff view"
                  >
                    <Users className="w-3 h-3" />
                    <span>Staff</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(evt)}
                    disabled={deletingId === evt.id}
                    className="focus-ring p-1.5 rounded text-[#da3832] hover:bg-[#fdf2f2] border border-transparent hover:border-[#f5b5b3] transition-colors disabled:opacity-50 cursor-pointer"
                    title="Permanently delete this event"
                  >
                    {deletingId === evt.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-[#d8dce0] bg-[#f8f9fa] text-[11px] text-[#7c878e] flex items-center gap-1.5">
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span>For access from a different device, ask whoever shared the link with you to resend it.</span>
        </div>
      </div>
    </div>
  );
};
