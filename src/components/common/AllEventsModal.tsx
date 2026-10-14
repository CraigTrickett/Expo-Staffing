import React, { useEffect, useState, useMemo } from 'react';
import {
  Clock,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Plus,
  Search,
  Shield,
  Trash2,
  Users,
  X,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { fetchAllEvents, deleteEventRemote } from '@/lib/firebase';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/common/Toast';
import { useModalA11y } from '@/lib/hooks';
import type { EventConfig } from '@/types';

interface AllEventsModalProps {
  onClose: () => void;
  onCreateNew: () => void;
  onSelectAdmin: (event: EventConfig) => void;
  onSelectStaff: (event: EventConfig) => void;
}

export const AllEventsModal: React.FC<AllEventsModalProps> = ({
  onClose,
  onCreateNew,
  onSelectAdmin,
  onSelectStaff,
}) => {
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const modalRef = useModalA11y(true, onClose);

  useEffect(() => {
    let cancelled = false;

    // Load from local storage immediately so events appear without any remote latency
    const localEventsMap = storage.getAll();
    const localList = Object.values(localEventsMap).map((item) => item.config);

    fetchAllEvents()
      .then((remoteAll) => {
        if (cancelled) return;
        // Merge remote and local without duplicate IDs
        const combinedMap = new Map<string, EventConfig>();
        remoteAll.forEach((e) => combinedMap.set(e.id, e));
        localList.forEach((e) => {
          if (!combinedMap.has(e.id)) {
            combinedMap.set(e.id, e);
          }
        });

        const list = Array.from(combinedMap.values()).sort((a, b) =>
          (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
        );

        setEvents(list);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('[AllEventsModal] Failed to load remote events, using local cache:', err);
        if (cancelled) return;
        if (localList.length > 0) {
          setEvents(
            localList.sort((a, b) =>
              (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
            )
          );
        } else {
          setLoadError(true);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.location && e.location.toLowerCase().includes(q))
    );
  }, [events, searchQuery]);

  const handleDelete = async (evt: EventConfig) => {
    if (
      !window.confirm(
        `Permanently delete "${evt.title}"? This removes it for everyone and cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(evt.id);
    const ok = await deleteEventRemote(evt.id);
    setDeletingId(null);

    // Also remove from local storage regardless
    storage.deleteEvent(evt.id);
    setEvents((prev) => prev.filter((e) => e.id !== evt.id));

    if (ok) {
      toast.success(`"${evt.title}" was deleted.`, 'Event Deleted');
    } else {
      toast.info(`"${evt.title}" was removed locally.`, 'Event Removed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="all-events-modal-title"
        className="bg-white border border-[#d8dce0] rounded max-w-2xl w-full max-h-[85vh] flex flex-col shadow-modus-3 focus:outline-hidden overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#d8dce0] bg-[#f8f9fa]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0] shrink-0 mt-0.5">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 id="all-events-modal-title" className="text-base font-bold text-[#252a2e]">
                  Events
                </h2>
                <p className="text-xs text-[#46535e] mt-0.5 max-w-sm">
                  Select an event to open its workspace, or create a brand new expo schedule.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={onCreateNew}
                className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="focus-ring p-1.5 text-[#7c878e] hover:text-[#252a2e] rounded hover:bg-[#f1f3f6] transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="w-3.5 h-3.5 text-[#7c878e] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter events by name or location..."
              className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded pl-8 pr-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25"
            />
          </div>
        </div>

        {/* Modal List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center text-xs text-[#7c878e] space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#0063a3]" />
              <span className="font-medium">Loading events from database...</span>
            </div>
          ) : loadError && events.length === 0 ? (
            <div className="py-12 text-center text-xs space-y-3">
              <p className="text-[#da3832] font-semibold">
                Could not connect to the database.
              </p>
              <button
                type="button"
                onClick={onCreateNew}
                className="focus-ring px-3.5 py-1.5 rounded text-xs font-semibold bg-[#0063a3] text-white hover:bg-[#005084] transition-colors"
              >
                Create Event Locally
              </button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#7c878e] space-y-3">
              <p>{searchQuery ? 'No events matched your search filter.' : 'No events found.'}</p>
              <button
                type="button"
                onClick={onCreateNew}
                className="focus-ring inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold bg-[#0063a3] text-white hover:bg-[#005084] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Your First Event</span>
              </button>
            </div>
          ) : (
            filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3.5 bg-[#f8f9fa] hover:bg-white border border-[#d8dce0] hover:border-[#b9dcf0] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-2xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#252a2e] truncate">{evt.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#e5f2f8] text-[#0063a3] shrink-0">
                      {evt.staffCapacityPerSlot} staff/shift
                    </span>
                  </div>
                  <div className="text-[11px] text-[#7c878e] flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#0063a3]" />
                      <span>
                        {formatDate(evt.startDate)} &ndash; {formatDate(evt.endDate)}
                      </span>
                    </span>
                    {evt.location && (
                      <span className="flex items-center gap-1 truncate max-w-xs">
                        <MapPin className="w-3 h-3 text-[#7c878e]" />
                        <span className="truncate">{evt.location}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => onSelectAdmin(evt)}
                    className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Open admin area selection hub"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectStaff(evt)}
                    className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-white hover:bg-[#f1f3f6] text-[#0063a3] border border-[#0063a3] flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Open public staff shift sign-up"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Staff</span>
                  </button>

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

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-[#d8dce0] bg-[#f8f9fa] text-[11px] text-[#7c878e] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3 shrink-0 text-[#0063a3]" />
            <span>Staff claim shifts via their public link without signing in.</span>
          </div>
          <button
            type="button"
            onClick={onCreateNew}
            className="focus-ring font-semibold text-[#0063a3] hover:underline cursor-pointer"
          >
            + Create New Event
          </button>
        </div>
      </div>
    </div>
  );
};
