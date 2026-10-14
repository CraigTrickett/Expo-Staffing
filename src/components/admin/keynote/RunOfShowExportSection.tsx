import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Download,
  Eye,
  EyeOff,
  Check,
  ExternalLink,
  Presentation,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import type { KeynoteSession, KeyStakeholder } from '@/types';
import {
  generateKeynoteMarkdown,
  downloadMarkdownFile,
  copyFormattedForGoogleDocs,
} from '@/lib/keynote';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/common/Toast';

interface RunOfShowExportSectionProps {
  session: KeynoteSession;
  stakeholders: KeyStakeholder[];
  className?: string;
}

export const RunOfShowExportSection: React.FC<RunOfShowExportSectionProps> = ({
  session,
  stakeholders,
  className = '',
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'rendered' | 'raw'>('rendered');
  const [copiedType, setCopiedType] = useState<'docs' | 'markdown' | null>(null);

  const speakerNameMap = new Map<string, string>();
  stakeholders.forEach((s) => {
    speakerNameMap.set(s.id, `${s.firstName} ${s.lastName}`.trim());
  });

  const handleCopyGoogleDocs = async () => {
    const success = await copyFormattedForGoogleDocs(session, stakeholders);
    if (success) {
      setCopiedType('docs');
      setTimeout(() => setCopiedType(null), 2500);
      toast.success(
        'Formatted run of show copied! Paste directly into Google Docs (Ctrl+V / Cmd+V) to preserve tables and styling.',
        'Ready for Google Docs'
      );
    } else {
      toast.error('Could not copy to clipboard. Please check browser permissions.', 'Copy Failed');
    }
  };

  const handleCopyMarkdown = () => {
    const md = generateKeynoteMarkdown(session, stakeholders);
    navigator.clipboard.writeText(md);
    setCopiedType('markdown');
    setTimeout(() => setCopiedType(null), 2500);
    toast.success('Markdown table copied to clipboard!', 'Markdown Copied');
  };

  const handleDownload = () => {
    const md = generateKeynoteMarkdown(session, stakeholders);
    const filename = `${session.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-run-of-show.md`;
    downloadMarkdownFile(filename, md);
    toast.success(`Downloaded ${filename}`, 'Download Complete');
  };

  return (
    <div className={`p-4 bg-[#f0f7fb] border border-[#b9dcf0] rounded shadow-2xs space-y-3 ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0063a3] shrink-0" />
          <div>
            <span className="text-xs font-bold text-[#0063a3] block">
              Structured Run of Show Export & Google Docs Document
            </span>
            <span className="text-[11px] text-[#46535e]">
              Presentable document preview formatted for Google Docs, meetings, or Markdown export.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="focus-ring px-2.5 py-1.5 rounded text-xs font-semibold text-[#0063a3] hover:text-[#005084] hover:bg-[#e5f2f8] transition-colors cursor-pointer flex items-center gap-1.5 border border-[#b9dcf0] bg-white"
            title={showPreview ? 'Hide document preview' : 'View formatted document preview'}
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyGoogleDocs}
            className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-[#0063a3] text-white hover:bg-[#005084] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Copy as formatted rich text for Google Docs"
          >
            {copiedType === 'docs' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedType === 'docs' ? 'Copied for Docs!' : 'Copy for Google Docs'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="focus-ring px-2.5 py-1.5 rounded text-xs font-semibold bg-white text-[#46535e] hover:text-[#252a2e] border border-[#d8dce0] hover:border-[#0063a3] transition-colors cursor-pointer flex items-center gap-1.5"
            title="Copy raw Markdown syntax"
          >
            {copiedType === 'markdown' ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{copiedType === 'markdown' ? 'Copied MD!' : 'Copy Markdown'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="focus-ring px-2.5 py-1.5 rounded text-xs font-semibold bg-white text-[#46535e] hover:text-[#252a2e] border border-[#d8dce0] hover:border-[#0063a3] transition-colors cursor-pointer flex items-center gap-1.5"
            title="Download .md file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Download .md</span>
          </button>
        </div>
      </div>

      {/* Rendered Human-Friendly Preview */}
      {showPreview && (
        <div className="mt-3 pt-3 border-t border-[#b9dcf0] space-y-3 animate-in fade-in duration-200">
          {/* View mode toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#5b6770] uppercase tracking-wider">
              {previewMode === 'rendered' ? 'Formatted Document Sheet Preview' : 'Raw Markdown Code'}
            </span>

            <div className="flex items-center p-0.5 bg-white border border-[#d8dce0] rounded text-[11px]">
              <button
                type="button"
                onClick={() => setPreviewMode('rendered')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  previewMode === 'rendered'
                    ? 'bg-[#0063a3] text-white shadow-2xs'
                    : 'text-[#5b6770] hover:text-[#252a2e]'
                }`}
              >
                Presentable Sheet
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('raw')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  previewMode === 'raw'
                    ? 'bg-[#0063a3] text-white shadow-2xs'
                    : 'text-[#5b6770] hover:text-[#252a2e]'
                }`}
              >
                Raw Markdown
              </button>
            </div>
          </div>

          {previewMode === 'rendered' ? (
            /* Human-Friendly Presentable Document Sheet */
            <div className="bg-white border border-[#d8dce0] rounded-md p-6 sm:p-8 shadow-xs max-h-[500px] overflow-y-auto space-y-5 text-[#252a2e]">
              {/* Document Header */}
              <div className="border-b-2 border-[#004f83] pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#0063a3] block mb-1">
                      Run of Show &amp; Session Production Brief
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#004f83] tracking-tight">
                      {session.title}
                    </h3>
                  </div>
                  <span className="inline-flex items-center self-start px-2.5 py-1 rounded text-xs font-semibold bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0]">
                    {session.currentStage === 'signed_off'
                      ? 'Stage 3: Signed Off & Locked'
                      : session.currentStage === 'slide_deck_prep'
                        ? 'Stage 2: Slide Deck Prep'
                        : 'Stage 1: Run of Show'}
                  </span>
                </div>

                {/* Metadata Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
                  <div className="flex items-center gap-2 text-[#46535e]">
                    <Calendar className="w-3.5 h-3.5 text-[#0063a3] shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#7c878e] block uppercase font-medium">Date</span>
                      <span className="font-semibold text-[#252a2e]">{formatDate(session.date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[#46535e]">
                    <Clock className="w-3.5 h-3.5 text-[#0063a3] shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#7c878e] block uppercase font-medium">Time Window</span>
                      <span className="font-semibold text-[#252a2e] font-mono">{session.startTime} &ndash; {session.endTime}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[#46535e]">
                    <Layers className="w-3.5 h-3.5 text-[#0063a3] shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#7c878e] block uppercase font-medium">Location</span>
                      <span className="font-semibold text-[#252a2e]">{session.stageOrRoom || 'Mainstage'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[#46535e]">
                    <Presentation className="w-3.5 h-3.5 text-[#0063a3] shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#7c878e] block uppercase font-medium">Master Slide Deck</span>
                      {session.slideDeckUrl ? (
                        <a
                          href={session.slideDeckUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#0063a3] hover:underline flex items-center gap-1 truncate max-w-[150px]"
                        >
                          <span className="truncate">Open Presentation</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-[#7c878e] italic">Pending Stage 2</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Narrative Context (if present) */}
              {(session.stage1Narrative.themeStatement ||
                session.stage1Narrative.flowHandoverNotes ||
                session.stage1Narrative.customerInvolvementNotes) && (
                <div className="bg-[#f8f9fa] border border-[#d8dce0] rounded p-3.5 space-y-2 text-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#004f83] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#fbad26]" />
                    <span>Narrative &amp; Flow Briefing</span>
                  </span>
                  {session.stage1Narrative.themeStatement && (
                    <div>
                      <strong className="text-[#252a2e]">Theme Statement: </strong>
                      <span className="text-[#46535e]">{session.stage1Narrative.themeStatement}</span>
                    </div>
                  )}
                  {session.stage1Narrative.coreMessage && (
                    <div>
                      <strong className="text-[#252a2e]">Core Message: </strong>
                      <span className="text-[#46535e]">{session.stage1Narrative.coreMessage}</span>
                    </div>
                  )}
                  {session.stage1Narrative.flowHandoverNotes && (
                    <div>
                      <strong className="text-[#252a2e]">Connecting Transitions: </strong>
                      <span className="text-[#46535e]">{session.stage1Narrative.flowHandoverNotes}</span>
                    </div>
                  )}
                  {session.stage1Narrative.customerInvolvementNotes && (
                    <div>
                      <strong className="text-[#252a2e]">Customer Involvement: </strong>
                      <span className="text-[#46535e]">{session.stage1Narrative.customerInvolvementNotes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Run of Show Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#252a2e] mb-2.5">
                  Chronological Run of Show
                </h4>
                <div className="border border-[#d8dce0] rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#004f83] text-white">
                        <th className="py-2 px-3 text-center w-12 font-semibold">#</th>
                        <th className="py-2 px-3 w-28 font-semibold">Time</th>
                        <th className="py-2 px-3 w-20 font-semibold">Duration</th>
                        <th className="py-2 px-3 font-semibold">Speaker(s)</th>
                        <th className="py-2 px-3 font-semibold">Topic / Segment</th>
                        <th className="py-2 px-3 font-semibold w-24">Slide Link</th>
                        <th className="py-2 px-3 font-semibold">Handover / Transition</th>
                        <th className="py-2 px-3 font-semibold">Stage Cues &amp; AV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e9ec]">
                      {session.segments.map((seg, idx) => {
                        const resolvedSpeakers =
                          seg.speakerIds && seg.speakerIds.length > 0
                            ? seg.speakerIds.map((id) => speakerNameMap.get(id) || id).join(', ')
                            : seg.speakerNames || 'TBD';

                        return (
                          <tr
                            key={seg.id}
                            className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f8f9fa]'}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-center text-[#7c878e]">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-[#252a2e]">
                              {seg.time}
                            </td>
                            <td className="py-2.5 px-3 text-[#5b6770] font-mono text-[11px]">
                              {seg.durationMinutes} min
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#252a2e]">
                              {resolvedSpeakers}
                            </td>
                            <td className="py-2.5 px-3 text-[#252a2e]">
                              {seg.topic}
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              {seg.slideDeckLink ? (
                                <a
                                  href={seg.slideDeckLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#0063a3] hover:underline font-semibold flex items-center gap-0.5"
                                >
                                  <span>Slides</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : session.slideDeckUrl ? (
                                <a
                                  href={session.slideDeckUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#0063a3] hover:underline flex items-center gap-0.5"
                                >
                                  <span>Deck</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span className="text-[#7c878e]">&mdash;</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[#46535e] text-[11px]">
                              {seg.handoverNotes || <span className="text-[#7c878e]">&mdash;</span>}
                            </td>
                            <td className="py-2.5 px-3 text-[#46535e] text-[11px]">
                              {seg.cueNotes || <span className="text-[#7c878e]">&mdash;</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sign off notice if present */}
              {session.signedOffBy && (
                <div className="p-3 bg-[#ecfdf5] border border-[#a7f3d0] rounded text-xs flex items-center gap-2 text-[#059669]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Production Signed Off:</strong> Approved by {session.signedOffBy} on {session.signedOffAt}
                  </span>
                </div>
              )}

              <div className="text-[10px] text-[#7c878e] border-t border-[#e5e9ec] pt-3 flex items-center justify-between">
                <span>Expo Staffing Production Hub &bull; Trimble Modus</span>
                <span>Ready to paste directly into Google Docs</span>
              </div>
            </div>
          ) : (
            /* Raw Markdown Syntax View */
            <div className="relative">
              <pre className="p-4 bg-white border border-[#b9dcf0] rounded text-[11px] font-mono text-[#252a2e] overflow-x-auto max-h-[400px] leading-relaxed">
                {generateKeynoteMarkdown(session, stakeholders)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
