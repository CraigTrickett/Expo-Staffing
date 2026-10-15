import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Copy, Download, Eye, EyeOff, FileText } from 'lucide-react';
import type { KeynoteSession, KeyStakeholder } from '@/types';
import type { KeynoteDocumentSettings } from '@/types/keynoteDocument';
import type { Task } from '@/types/tasks';
import {
  copyFormattedForGoogleDocs,
  downloadMarkdownFile,
  generateKeynoteHtml,
  generateKeynoteMarkdown,
} from '@/lib/keynote';
import type { RunOfShowContext } from '@/lib/keynote';
import type { SaveState } from '@/lib/useModuleData';
import { InlineText } from '@/components/common/InlineField';
import { SaveStatus } from '@/components/common/SaveStatus';
import { toast } from '@/components/common/Toast';

interface RunOfShowExportSectionProps {
  eventTitle: string;
  /** The session being edited. Its abstract and break line are edited here. */
  session: KeynoteSession;
  /** Every session in the event: the document covers all of them. */
  sessions: KeynoteSession[];
  stakeholders: KeyStakeholder[];
  settings: KeynoteDocumentSettings;
  onSettingsChange: (patch: Partial<KeynoteDocumentSettings>) => void;
  onUpdateSession: (patch: Partial<KeynoteSession>) => void;
  openItems: Task[];
  saveState: SaveState;
  className?: string;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'run-of-show';

const FIELD = 'border-[#d8dce0] bg-white';

export const RunOfShowExportSection: React.FC<RunOfShowExportSectionProps> = ({
  eventTitle,
  session,
  sessions,
  stakeholders,
  settings,
  onSettingsChange,
  onUpdateSession,
  openItems,
  saveState,
  className = '',
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'rendered' | 'markdown'>('rendered');
  const [includeCues, setIncludeCues] = useState(false);
  const [includeSlideLinks, setIncludeSlideLinks] = useState(false);
  const [copied, setCopied] = useState<'docs' | 'markdown' | null>(null);

  const ctx: RunOfShowContext = useMemo(
    () => ({ eventTitle, settings, openItems, options: { includeCues, includeSlideLinks } }),
    [eventTitle, settings, openItems, includeCues, includeSlideLinks]
  );

  // The preview is the same HTML that is copied, so what you see is what gets pasted.
  const html = useMemo(() => (showPreview ? generateKeynoteHtml(sessions, stakeholders, ctx) : ''), [showPreview, sessions, stakeholders, ctx]);
  const markdown = useMemo(
    () => (showPreview && previewMode === 'markdown' ? generateKeynoteMarkdown(sessions, stakeholders, ctx) : ''),
    [showPreview, previewMode, sessions, stakeholders, ctx]
  );

  const flash = (kind: 'docs' | 'markdown') => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2500);
  };

  const handleCopyDocs = async () => {
    const ok = await copyFormattedForGoogleDocs(sessions, stakeholders, ctx);
    if (ok) {
      flash('docs');
      toast.success('Copied. Paste it into a Google Doc.');
    } else {
      toast.error('Could not copy to the clipboard. Check the browser permissions.', 'Copy failed');
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(generateKeynoteMarkdown(sessions, stakeholders, ctx));
      flash('markdown');
      toast.success('Markdown copied.');
    } catch {
      toast.error('Could not copy to the clipboard. Check the browser permissions.', 'Copy failed');
    }
  };

  const handleDownload = () => {
    const filename = `${slug(settings.title || `${eventTitle} run of show`)}.md`;
    downloadMarkdownFile(filename, generateKeynoteMarkdown(sessions, stakeholders, ctx));
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <div className={`space-y-3 rounded border border-[#b9dcf0] bg-[#f0f7fb] p-4 shadow-2xs ${className}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#0063a3]" aria-hidden="true" />
          <div>
            <h3 className="text-xs font-bold text-[#252a2e]">Structured Run of Show Export &amp; Google Docs Document</h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyDocs}
            className="focus-ring flex cursor-pointer items-center gap-1.5 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#005084]"
          >
            {copied === 'docs' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied === 'docs' ? 'Copied' : 'Copy for Google Docs'}
          </button>
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="focus-ring flex cursor-pointer items-center gap-1.5 rounded border border-[#0063a3] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0063a3] transition-colors hover:bg-[#e5f2f8]"
          >
            {copied === 'markdown' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied === 'markdown' ? 'Copied' : 'Copy Markdown'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="focus-ring flex cursor-pointer items-center gap-1.5 rounded border border-[#d8dce0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#46535e] transition-colors hover:border-[#0063a3] hover:text-[#0063a3]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download .md
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            aria-pressed={showPreview}
            className="focus-ring flex cursor-pointer items-center gap-1.5 rounded border border-[#d8dce0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#46535e] transition-colors hover:border-[#0063a3] hover:text-[#0063a3]"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#46535e]">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={includeCues} onChange={(e) => setIncludeCues(e.target.checked)} className="accent-[#0063a3]" />
          Include stage cues
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={includeSlideLinks} onChange={(e) => setIncludeSlideLinks(e.target.checked)} className="accent-[#0063a3]" />
          Include slide links
        </label>
      </div>

      <details className="group rounded border border-[#d8dce0] bg-white">
        <summary className="focus-ring flex cursor-pointer list-none items-center gap-1.5 rounded px-3 py-2 text-xs font-bold text-[#252a2e]">
          <ChevronRight className="h-3.5 w-3.5 text-[#5b6770] transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
          Document details
        </summary>
        <div className="space-y-4 border-t border-[#e7eaef] p-3">
          <SaveStatus state={saveState} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Document title" hint={`Blank uses "${eventTitle} \u2014 Run of Show".`}>
              <InlineText value={settings.title} label="Document title" onCommit={(v) => onSettingsChange({ title: v })} className={FIELD} />
            </Field>
            <Field label="Headline">
              <InlineText value={settings.headline} label="Document headline" onCommit={(v) => onSettingsChange({ headline: v })} className={FIELD} />
            </Field>
            <Field label="Descriptor" wide>
              <InlineText value={settings.descriptor} label="Document descriptor" onCommit={(v) => onSettingsChange({ descriptor: v })} className={FIELD} />
            </Field>
            <Field label="Objective" hint="Blank uses the narrative theme from Stage 1." wide>
              <InlineText multiline value={settings.objective} label="Objective" onCommit={(v) => onSettingsChange({ objective: v })} className={FIELD} />
            </Field>
            <Field label="Message" hint="Blank uses the core message from Stage 1." wide>
              <InlineText multiline value={settings.message} label="Message" onCommit={(v) => onSettingsChange({ message: v })} className={FIELD} />
            </Field>
            <Field label="Structure" hint="Blank uses the section transitions from Stage 1." wide>
              <InlineText multiline value={settings.structure} label="Structure" onCommit={(v) => onSettingsChange({ structure: v })} className={FIELD} />
            </Field>
          </div>

          <div className="border-t border-[#e7eaef] pt-3">
            <p className="mb-2 text-[11px] font-bold text-[#252a2e]">This session: {session.title}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Abstract" hint="Leave a blank line between paragraphs." wide>
                <InlineText multiline value={session.abstract ?? ''} label={`Abstract for ${session.title}`} onCommit={(v) => onUpdateSession({ abstract: v || undefined })} className={FIELD} />
              </Field>
              <Field label="Break after this session" hint='Printed between this session and the next, e.g. "Lunch Break".'>
                <InlineText value={session.breakAfter ?? ''} label={`Break after ${session.title}`} onCommit={(v) => onUpdateSession({ breakAfter: v || undefined })} className={FIELD} />
              </Field>
            </div>
          </div>
        </div>
      </details>

      {showPreview && (
        <div className="space-y-2">
          <div role="group" aria-label="Preview format" className="flex gap-1.5">
            {(['rendered', 'markdown'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={previewMode === mode}
                onClick={() => setPreviewMode(mode)}
                className={`focus-ring cursor-pointer rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  previewMode === mode ? 'bg-[#0063a3] text-white' : 'border border-[#d8dce0] bg-white text-[#46535e] hover:border-[#0063a3]'
                }`}
              >
                {mode === 'rendered' ? 'Document' : 'Markdown'}
              </button>
            ))}
          </div>

          {previewMode === 'rendered' ? (
            <div
              role="region"
              aria-label="Document preview"
              tabIndex={0}
              className="focus-ring max-h-[560px] overflow-auto rounded border border-[#d8dce0] bg-white p-6 text-black shadow-inner"
              // The HTML comes from our own generator, which escapes every value typed into the app.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre
              role="region"
              aria-label="Markdown preview"
              tabIndex={0}
              className="focus-ring max-h-[560px] overflow-auto whitespace-pre-wrap rounded border border-[#d8dce0] bg-white p-4 font-mono text-[11px] leading-relaxed text-[#252a2e]"
            >
              {markdown}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; hint?: string; wide?: boolean; children: React.ReactNode }> = ({ label, hint, wide, children }) => (
  <div className={wide ? 'md:col-span-2' : undefined}>
    <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
      <span className="text-[11px] font-semibold text-[#252a2e]">{label}</span>
      {hint && <span className="text-[11px] text-[#5b6770]">{hint}</span>}
    </div>
    {children}
  </div>
);
