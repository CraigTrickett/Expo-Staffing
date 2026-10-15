import React, { useId, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { EventConfig, KeynoteSession } from '@/types';
import { addSampleKeynoteSessions, createKeynoteSession } from '@/lib/keynote';
import { usePageFocus } from '@/lib/hooks';
import { formFieldClass } from '@/components/common/StakeholderSelect';
import { toast } from '@/components/common/Toast';
import { RoomField } from './RoomField';

interface KeynoteEmptyStateProps {
  event: EventConfig;
  onBack: () => void;
  /** Called with every session the event now has, so the screen can carry on as normal. */
  onSessions: (sessions: KeynoteSession[], activeId: string) => void;
}

/** What the Keynote screen shows for an event with no sessions yet. */
export const KeynoteEmptyState: React.FC<KeynoteEmptyStateProps> = ({ event, onBack, onSessions }) => {
  const uid = useId();
  const modalRef = usePageFocus();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(event.startDate || '');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [room, setRoom] = useState('');
  const [spaceId, setSpaceId] = useState<string | undefined>(undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Give the session a title.', 'Missing field');
      return;
    }
    const created = createKeynoteSession(event.id, { title, date, startTime, endTime, stageOrRoom: room, spaceId });
    onSessions([created], created.id);
  };

  const sample = () => {
    const sessions = addSampleKeynoteSessions(event.id);
    if (sessions.length > 0) onSessions(sessions, sessions[0].id);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <section ref={modalRef} tabIndex={-1} aria-labelledby={`${uid}-title`} className="flex flex-col rounded border border-[#d8dce0] bg-white shadow-xs focus:outline-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[#d8dce0] bg-[#f8f9fa] p-4 sm:p-5">
          <div className="flex items-start space-x-3.5">
            <button type="button" onClick={onBack} className="focus-ring p-2 rounded text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#b9dcf0] bg-white transition-colors cursor-pointer" title="Back to menu" aria-label="Back to menu">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-xs text-[#46535e]">{event.title}</p>
              <h1 id={`${uid}-title`} className="text-lg font-bold text-[#252a2e] mt-0.5">Keynote / General Session</h1>
            </div>
          </div>
        </div>

        <form onSubmit={submit} aria-label="Add the first session" className="space-y-4 overflow-y-auto bg-[#f8f9fa] p-4 sm:p-5">
          <p className="text-sm font-semibold text-[#252a2e]">No sessions yet</p>
          <div>
            <label htmlFor={`${uid}-t`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Title *</label>
            <input id={`${uid}-t`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Opening keynote" className={formFieldClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor={`${uid}-d`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Date</label>
              <input id={`${uid}-d`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={formFieldClass} />
            </div>
            <div>
              <label htmlFor={`${uid}-s`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Starts</label>
              <input id={`${uid}-s`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${formFieldClass} font-mono`} />
            </div>
            <div>
              <label htmlFor={`${uid}-e`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Ends</label>
              <input id={`${uid}-e`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${formFieldClass} font-mono`} />
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Room</span>
            <RoomField eventId={event.id} label="Room" name={room} spaceId={spaceId} onChange={({ name, spaceId: id }) => { setRoom(name); setSpaceId(id); }} placeholder="Mainstage Hall A" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={sample} className="focus-ring cursor-pointer rounded px-2 py-1 text-xs font-semibold text-[#46535e] underline hover:text-[#0063a3]">
              Add sample data
            </button>
            <button type="submit" className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
              Add session
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
