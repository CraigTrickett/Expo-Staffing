import React, { useId, useState } from 'react';
import { AlertTriangle, ExternalLink, Lock, Trash2 } from 'lucide-react';
import type { KeyStakeholder } from '@/types';
import type { ScheduleData, ScheduleSession } from '@/types/schedule';
import { allTags, blocksFor, dayLayoutId, isScheduled, layoutsFor, listSpaces, sessionEnd, sessionWarnings } from '@/lib/schedule';
import type { PlacementTarget, ScheduleContext } from '@/lib/schedule';
import { parseLink } from '@/lib/links';
import { formatDate } from '@/lib/utils';
import { InlineNumber, InlineText } from '@/components/common/InlineField';
import { formFieldClass } from '@/components/common/StakeholderSelect';
import { toast } from '@/components/common/Toast';
import { OriginPicker } from './OriginPicker';
import { SpeakerPicker } from './SpeakerPicker';
import { TagInput } from './TagInput';

interface SessionEditorProps {
  session: ScheduleSession;
  data: ScheduleData;
  ctx: ScheduleContext;
  stakeholders: KeyStakeholder[];
  /** The days of the event, YYYY-MM-DD. */
  days: string[];
  onPatch: (patch: Partial<ScheduleSession>) => void;
  onResize: (minutes: number) => void;
  onAssignSpace: (spaceId: string | undefined) => void;
  onPlace: (target: PlacementTarget) => boolean;
  onUnplace: () => void;
  onRemove: () => void;
  onManageStakeholders?: () => void;
}

const FIELD = 'border-[#d8dce0] bg-white';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; wide?: boolean }> = ({ label, hint, children, wide }) => (
  <div className={wide ? 'md:col-span-2' : undefined}>
    <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
      <span className="text-[11px] font-semibold text-[#252a2e]">{label}</span>
      {hint && <span className="text-[11px] text-[#5b6770]">{hint}</span>}
    </div>
    {children}
  </div>
);

export const SessionEditor: React.FC<SessionEditorProps> = ({
  session, data, ctx, stakeholders, days, onPatch, onResize, onAssignSpace, onPlace, onUnplace, onRemove, onManageStakeholders,
}) => {
  const uid = useId();
  const spaces = listSpaces(data);
  const layouts = layoutsFor(data, session.spaceId);
  const scheduled = isScheduled(session);
  const warnings = sessionWarnings(data, ctx, session.id);
  const [day, setDay] = useState(session.date ?? days[0] ?? '');
  const [start, setStart] = useState(session.startTime ?? '');
  const shownDay = scheduled ? (session.date as string) : day;
  const slots = blocksFor(data, shownDay).filter((b) => b.kind === 'slot');
  const dayLayout = data.layouts.find((l) => l.id === dayLayoutId(data, shownDay, session.spaceId));

  const step = data.settings.slotMinutes * 60;
  const timeFieldClass = `${formFieldClass} font-mono tabular-nums`;

  return (
    <div className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Session code">
          <InlineText value={session.code ?? ''} label={`Code of ${session.title}`} placeholder="Add a code" onCommit={(v) => onPatch({ code: v || undefined })} className={`${FIELD} font-mono`} />
        </Field>
        <Field label="Internal or external">
          <OriginPicker label={`Origin of ${session.title}`} value={session.origin} onChange={(origin) => onPatch({ origin })} />
        </Field>
        <Field label="Title" wide>
          <InlineText value={session.title} label={`Title of ${session.title}`} required requiredMessage="A session needs a title." semibold onCommit={(v) => onPatch({ title: v })} className={FIELD} />
        </Field>
        <Field label="Abstract" wide>
          <InlineText multiline value={session.abstract ?? ''} label={`Abstract of ${session.title}`} placeholder="Add an abstract" onCommit={(v) => onPatch({ abstract: v || undefined })} className={FIELD} />
        </Field>
        <Field label="Stakeholders">
          <SpeakerPicker label={`Stakeholders for ${session.title}`} speakers={session.speakers} stakeholders={stakeholders} onChange={(speakers) => onPatch({ speakers })} onManageStakeholders={onManageStakeholders} />
        </Field>
        <Field label="Other presenters" hint="Not a key stakeholder.">
          <InlineText value={session.guests ?? ''} label={`Other presenters of ${session.title}`} placeholder="e.g. Marcello Sgambelluri (AG&E)" onCommit={(v) => onPatch({ guests: v || undefined })} className={FIELD} />
        </Field>
        <Field label="Tags">
          <TagInput label={session.title} tags={session.tags} suggestions={allTags(data)} onChange={(tags) => onPatch({ tags })} />
        </Field>
        <Field label="Link to the presentation">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <InlineText
                value={session.presentationUrl ?? ''}
                label={`Presentation link of ${session.title}`}
                placeholder="https://docs.google.com/presentation/..."
                onCommit={(v) => {
                  if (!v) {
                    onPatch({ presentationUrl: undefined });
                    return true;
                  }
                  const parsed = parseLink(v);
                  if (parsed.ok === false) {
                    toast.error(parsed.error, 'Link not saved');
                    return false;
                  }
                  onPatch({ presentationUrl: parsed.url });
                  return true;
                }}
                className={FIELD}
              />
            </div>
            {session.presentationUrl && (
              <a href={session.presentationUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open the presentation for ${session.title} in a new tab`} className="focus-ring shrink-0 rounded p-1 text-[#0063a3] hover:bg-[#e5f2f8]">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </div>
        </Field>

        <Field label="Length (minutes)">
          <InlineNumber value={session.durationMinutes} min={5} max={480} label={`Length in minutes of ${session.title}`} onCommit={onResize} className={`w-24 ${FIELD}`} />
        </Field>
        <Field label="Expected attendance">
          <InlineNumber value={session.expectedAttendance ?? 0} min={0} max={100000} label={`Expected attendance of ${session.title}`} onCommit={(n) => onPatch({ expectedAttendance: n > 0 ? n : undefined })} className={`w-24 ${FIELD}`} />
        </Field>

        <Field label="Room">
          <select aria-label={`Room of ${session.title}`} value={session.spaceId ?? ''} onChange={(e) => onAssignSpace(e.target.value || undefined)} className={`${formFieldClass} cursor-pointer`}>
            <option value="">No room yet</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.kind === 'combination' ? ' (joined)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Layout" hint={session.spaceId && layouts.length === 0 ? 'This room has no layouts set up yet.' : undefined}>
          <select
            aria-label={`Layout of ${session.title}`}
            value={session.layoutId ?? ''}
            disabled={!session.spaceId || layouts.length === 0}
            onChange={(e) => onPatch({ layoutId: e.target.value || undefined })}
            className={`${formFieldClass} cursor-pointer disabled:bg-[#f1f3f6] disabled:text-[#5b6770]`}
          >
            <option value="">{dayLayout ? `Room setup that day (${dayLayout.name})` : 'Room setup that day'}</option>
            {layouts.map(({ layout, capacity }) => (
              <option key={layout.id} value={layout.id}>
                {layout.name} (seats {capacity})
              </option>
            ))}
          </select>
        </Field>

        <div className="md:col-span-2">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-[#252a2e]">
            <input type="checkbox" checked={!!session.fixed} onChange={(e) => onPatch({ fixed: e.target.checked || undefined })} className="mt-0.5 accent-[#0063a3]" />
            <span>
              <span className="flex items-center gap-1 font-semibold">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Fixed in place
              </span>
              <span className="block text-[11px] text-[#5b6770]">Cannot be moved. May run through breaks.</span>
            </span>
          </label>
        </div>
      </div>

      <fieldset className="rounded border border-[#e7eaef] bg-[#f8f9fa] p-3">
        <legend className="px-1 text-[11px] font-bold text-[#252a2e]">On the agenda</legend>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`${uid}-day`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Day</label>
            <select
              id={`${uid}-day`}
              value={shownDay}
              onChange={(e) => {
                setDay(e.target.value);
                if (scheduled) onPlace({ spaceId: session.spaceId as string, date: e.target.value, startTime: session.startTime as string });
              }}
              className={`${formFieldClass} w-48 cursor-pointer`}
            >
              {days.length === 0 && <option value="">No event dates</option>}
              {days.map((d) => (
                <option key={d} value={d}>{formatDate(d)}</option>
              ))}
            </select>
          </div>
          {slots.length > 0 && (
            <div>
              <label htmlFor={`${uid}-slot`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Slot</label>
              <select
                id={`${uid}-slot`}
                value={slots.some((b) => b.start === (scheduled ? session.startTime : start)) ? (scheduled ? session.startTime : start) : ''}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setStart(e.target.value);
                  if (scheduled) onPlace({ spaceId: session.spaceId as string, date: session.date as string, startTime: e.target.value });
                }}
                className={`${formFieldClass} w-40 cursor-pointer`}
              >
                <option value="">Choose a slot</option>
                {slots.map((b) => (
                  <option key={b.id} value={b.start}>{b.start}&ndash;{b.end}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor={`${uid}-start`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Starts</label>
            <input
              id={`${uid}-start`}
              type="time"
              step={step}
              value={scheduled ? (session.startTime as string) : start}
              onChange={(e) => {
                setStart(e.target.value);
                if (scheduled && e.target.value) onPlace({ spaceId: session.spaceId as string, date: session.date as string, startTime: e.target.value });
              }}
              className={`${timeFieldClass} w-32`}
            />
          </div>
          {scheduled ? (
            <>
              <p className="pb-1.5 text-xs text-[#46535e]">
                Ends <span className="font-mono font-semibold tabular-nums text-[#252a2e]">{sessionEnd(session)}</span>
              </p>
              <button type="button" onClick={onUnplace} className="focus-ring cursor-pointer rounded border border-[#d8dce0] bg-white px-3 py-1.5 text-xs font-semibold text-[#46535e] hover:border-[#0063a3] hover:text-[#0063a3]">
                Take off the agenda
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!session.spaceId || !day || !start}
              title={!session.spaceId ? 'Choose a room first' : undefined}
              onClick={() => onPlace({ spaceId: session.spaceId as string, date: day, startTime: start })}
              className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084] disabled:cursor-default disabled:opacity-50"
            >
              Place on agenda
            </button>
          )}
        </div>
      </fieldset>

      {warnings.length > 0 && (
        <ul className="space-y-1" aria-label={`Things to check for ${session.title}`}>
          {warnings.map((w) => (
            <li key={w.message} className="flex items-start gap-1.5 text-xs text-[#6e4600]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">Warning: </span>
                {w.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={onRemove} className="focus-ring flex cursor-pointer items-center gap-1 rounded border border-[#f2b8b5] px-2.5 py-1 text-xs font-semibold text-[#9e1b16] hover:bg-[#fdecec]" aria-label={`Remove session ${session.title}`}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Remove session
        </button>
      </div>
    </div>
  );
};
