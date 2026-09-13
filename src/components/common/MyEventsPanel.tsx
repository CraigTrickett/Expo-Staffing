import React, { useEffect, useState } from 'react';
import { Clock, ExternalLink, History, Loader2, Shield, Trash2, Users, X } from 'lucide-react';
import { storage } from '@/lib/storage';
import { fetchAllEvents, deleteEventRemote } from '@/lib/firebase';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/common/Toast';
import { useModalA11y } from '@/lib/hooks';
import type { EventConfig } from '@/types';

interface MyEventsPanelProps {
  onClose: () => void;
}

export const MyEventsPanel: React.FC<MyEventsPanelProps> = ({ onClose }) => {
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const modalRef = useModalA11y(true, onClose);

  useEffect(() => {
    let cancelled = false;

    fetchAllEvents()
      .then((all) => {
        if (cancelled) return;
        setEvents(all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('[MyEventsPanel] Failed to load events:', err);
        if (cancelled) return;
        setLoadError(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (evt: EventConfig) => {
    if (!window.confirm(`Permanently delete "${evt.title}"? This removes it for everyone and cannot be undone.`)) {
      return;
    }

    setDeletingId(evt.id);
    const ok = await deleteEventRemote(evt.id);
    setDeletingId(null);

    if (ok) {
      storage.deleteEvent(evt.id);
      setEvents((prev) => prev.filter((e) => e.id !== evt.id));
      toast.success(`"${evt.title}" was deleted.`, 'Event Deleted');
    } else {
      toast.error('Could not delete this event. Check your connection and try again.', 'Delete Failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="bg-white border border-[#d8dce0] rounded max-w-lg w-full max-h-[80vh] flex flex-col shadow-modus-3 focus:outline-hidden"
      >
        <div className="flex items-start justify-between p-5 border-b border-[#d8dce0]">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#252a2e]">All Events</h3>
              <p className="text-xs text-[#46535e] mt-0.5 max-w-sm">
                Every event currently stored in the database.
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
          {isLoading ? (
            <div className="py-10 flex flex-col items-center justify-center text-xs text-[#7c878e] space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#0063a3]" />
              <span>Loading events...</span>
            </div>
          ) : loadError ? (
            <div className="py-10 text-center text-xs text-[#da3832]">
              Could not reach the database. Check your connection and try again.
            </div>
          ) : events.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#7c878e]">
              No events found.
            </div>
          ) : (
            events.map((evt) => (
              <div
                key={evt.id}
                className="p-3 bg-[#f8f9fa] border border-[#d8dce0] rounded flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#252a2e] truncate">{evt.title}</div>
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
          <span>Staff access this event via the individual link you share with them — they don't see this list.</span>
        </div>
      </div>
    </div>
  );
};
