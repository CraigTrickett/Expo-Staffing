import React, { useEffect, useState } from 'react';
import { Clock, ExternalLink, History, Shield, Users, X } from 'lucide-react';
import { storage } from '@/lib/storage';
import { formatDate } from '@/lib/utils';
import type { EventConfig } from '@/types';

interface MyEventsPanelProps {
  onClose: () => void;
}

export const MyEventsPanel: React.FC<MyEventsPanelProps> = ({ onClose }) => {
  const [events, setEvents] = useState<EventConfig[]>([]);

  useEffect(() => {
    setEvents(storage.listLocalEvents());
  }, []);

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
                Lost your admin link? Any event you created or opened in this browser is listed here.
                This does not include events from other devices or browsers.
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
          {events.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#7c878e]">
              No events found in this browser yet.
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
