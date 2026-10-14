import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Mic,
  Calendar,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Trash2,
  Edit2,
  FileText,
  Users,
  Presentation,
  Check,
  ChevronRight,
  Sparkles,
  Layers,
  Video,
} from 'lucide-react';
import type {
  EventConfig,
  KeynoteSession,
  KeynoteStage,
  RunOfShowSegment,
  KeyStakeholder,
  RehearsalItem,
} from '@/types';
import {
  getKeynoteSessions,
  saveKeynoteSessions,
  createKeynoteSession,
  updateKeynoteSession,
  deleteKeynoteSession,
  reorderKeynoteSegments,
  generateKeynoteMarkdown,
  downloadMarkdownFile,
} from '@/lib/keynote';
import { getStakeholders } from '@/lib/stakeholders';
import { useModalA11y } from '@/lib/hooks';
import { toast } from '@/components/common/Toast';
import { formatDate } from '@/lib/utils';

interface KeynoteSessionModalProps {
  event: EventConfig;
  onBack: () => void;
  onClose: () => void;
  onManageStakeholders?: () => void;
}

export const KeynoteSessionModal: React.FC<KeynoteSessionModalProps> = ({
  event,
  onBack,
  onClose,
  onManageStakeholders,
}) => {
  const modalRef = useModalA11y(true, onClose);
  const [sessions, setSessions] = useState<KeynoteSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [stakeholders, setStakeholders] = useState<KeyStakeholder[]>([]);

  // Segment form state
  const [isAddingSegment, setIsAddingSegment] = useState(false);
  const [segmentTopic, setSegmentTopic] = useState('');
  const [segmentDuration, setSegmentDuration] = useState(15);
  const [segmentSpeakerName, setSegmentSpeakerName] = useState('');
  const [segmentSpeakerId, setSegmentSpeakerId] = useState('');
  const [segmentHandover, setSegmentHandover] = useState('');
  const [segmentCue, setSegmentCue] = useState('');
  const [segmentSlideLink, setSegmentSlideLink] = useState('');

  // Rehearsal form state
  const [isAddingRehearsal, setIsAddingRehearsal] = useState(false);
  const [rehTitle, setRehTitle] = useState('');
  const [rehDate, setRehDate] = useState('');
  const [rehTime, setRehTime] = useState('14:00');
  const [rehLocation, setRehLocation] = useState('Virtual / Google Meet');
  const [rehNotes, setRehNotes] = useState('');

  // New session modal
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionDate, setNewSessionDate] = useState(event.startDate || '');
  const [newSessionStartTime, setNewSessionStartTime] = useState('09:00');
  const [newSessionEndTime, setNewSessionEndTime] = useState('10:30');
  const [newSessionRoom, setNewSessionRoom] = useState('Mainstage Hall A');

  // Sign off state
  const [approverName, setApproverName] = useState('');
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  useEffect(() => {
    const loadedSessions = getKeynoteSessions(event.id);
    setSessions(loadedSessions);
    if (loadedSessions.length > 0) {
      setActiveSessionId((prev) => (prev && loadedSessions.some((s) => s.id === prev) ? prev : loadedSessions[0].id));
    }
    const loadedStakeholders = getStakeholders(event.id);
    setStakeholders(loadedStakeholders);
  }, [event.id]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  const handleUpdateActiveSession = (updates: Partial<KeynoteSession>) => {
    if (!activeSession) return;
    const updated = updateKeynoteSession(event.id, activeSession.id, updates);
    if (updated) {
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    }
  };

  const handleCreateNewSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) {
      toast.error('Session title is required.', 'Missing Field');
      return;
    }
    const created = createKeynoteSession(event.id, {
      title: newSessionTitle,
      date: newSessionDate,
      startTime: newSessionStartTime,
      endTime: newSessionEndTime,
      stageOrRoom: newSessionRoom,
    });
    setSessions((prev) => [...prev, created]);
    setActiveSessionId(created.id);
    setIsCreatingSession(false);
    setNewSessionTitle('');
    toast.success(`Created session "${created.title}".`, 'Session Created');
  };

  const handleDeleteSession = (sessionId: string, title: string) => {
    if (sessions.length <= 1) {
      toast.error('At least one session must remain in the schedule.', 'Cannot Delete');
      return;
    }
    if (!window.confirm(`Delete "${title}"?`)) return;
    deleteKeynoteSession(event.id, sessionId);
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      setActiveSessionId(filtered[0]?.id || '');
      return filtered;
    });
    toast.info(`Deleted "${title}".`, 'Session Removed');
  };

  const handleAddSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !segmentTopic.trim()) {
      toast.error('Topic is required.', 'Missing Field');
      return;
    }

    const speakerName = segmentSpeakerId
      ? stakeholders.find((s) => s.id === segmentSpeakerId)
        ? `${stakeholders.find((s) => s.id === segmentSpeakerId)?.firstName} ${stakeholders.find((s) => s.id === segmentSpeakerId)?.lastName}`
        : segmentSpeakerName
      : segmentSpeakerName || 'TBD';

    const newSegment: RunOfShowSegment = {
      id: `seg_${Date.now()}`,
      order: activeSession.segments.length + 1,
      time: '',
      durationMinutes: Number(segmentDuration) || 10,
      topic: segmentTopic.trim(),
      speakerIds: segmentSpeakerId ? [segmentSpeakerId] : [],
      speakerNames: speakerName,
      handoverNotes: segmentHandover.trim(),
      cueNotes: segmentCue.trim(),
      slideDeckLink: segmentSlideLink.trim(),
    };

    handleUpdateActiveSession({
      segments: [...activeSession.segments, newSegment],
    });

    setIsAddingSegment(false);
    setSegmentTopic('');
    setSegmentDuration(15);
    setSegmentSpeakerName('');
    setSegmentSpeakerId('');
    setSegmentHandover('');
    setSegmentCue('');
    setSegmentSlideLink('');
    toast.success('Added segment to run of show.', 'Segment Added');
  };

  const handleReorder = (segmentId: string, direction: 'up' | 'down') => {
    if (!activeSession) return;
    const reordered = reorderKeynoteSegments(activeSession, segmentId, direction);
    updateKeynoteSession(event.id, activeSession.id, { segments: reordered.segments });
    setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? reordered : s)));
  };

  const handleDeleteSegment = (segmentId: string) => {
    if (!activeSession) return;
    const filtered = activeSession.segments.filter((s) => s.id !== segmentId);
    handleUpdateActiveSession({ segments: filtered });
    toast.info('Segment removed.', 'Segment Deleted');
  };

  const handleAddRehearsal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !rehTitle.trim()) return;

    const newRehearsal: RehearsalItem = {
      id: `reh_${Date.now()}`,
      title: rehTitle.trim(),
      targetDate: rehDate || activeSession.date,
      time: rehTime,
      locationOrUrl: rehLocation,
      isCompleted: false,
      notes: rehNotes.trim(),
    };

    handleUpdateActiveSession({
      rehearsals: [...activeSession.rehearsals, newRehearsal],
    });

    setIsAddingRehearsal(false);
    setRehTitle('');
    setRehNotes('');
    toast.success('Rehearsal scheduled.', 'Rehearsal Added');
  };

  const handleToggleRehearsal = (rehearsalId: string) => {
    if (!activeSession) return;
    const updated = activeSession.rehearsals.map((r) =>
      r.id === rehearsalId ? { ...r, isCompleted: !r.isCompleted } : r
    );
    handleUpdateActiveSession({ rehearsals: updated });
  };

  const handleSetStage = (stage: KeynoteStage) => {
    if (!activeSession) return;
    if (stage === 'signed_off' && !activeSession.slideDeckUrl) {
      toast.error('Stage 2 slide deck URL must be provided before final sign-off.', 'Slide Deck Required');
      return;
    }
    handleUpdateActiveSession({ currentStage: stage });
    toast.info(`Advanced to ${stage === 'signed_off' ? 'Stage 3: Sign Off' : stage === 'slide_deck_prep' ? 'Stage 2: Slide Deck Preparation' : 'Stage 1: Develop Run of Show'}.`, 'Stage Updated');
  };

  const handleSignOff = () => {
    if (!activeSession) return;
    const name = approverName.trim() || 'Stage Manager & Executive Lead';
    handleUpdateActiveSession({
      currentStage: 'signed_off',
      signedOffBy: name,
      signedOffAt: new Date().toLocaleString(),
    });
    toast.success(`Session signed off and locked by ${name}!`, 'Production Signed Off');
  };

  const handleCopyMarkdown = () => {
    if (!activeSession) return;
    const md = generateKeynoteMarkdown(activeSession, stakeholders);
    navigator.clipboard.writeText(md);
    toast.success('Run of show copied to clipboard in Markdown table format!', 'Markdown Copied');
  };

  const handleDownloadMarkdown = () => {
    if (!activeSession) return;
    const md = generateKeynoteMarkdown(activeSession, stakeholders);
    const filename = `${activeSession.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-run-of-show.md`;
    downloadMarkdownFile(filename, md);
    toast.success(`Downloaded ${filename}`, 'Export Complete');
  };

  if (!activeSession) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keynote-modal-title"
        className="bg-white border border-[#d8dce0] rounded max-w-6xl w-full max-h-[94vh] flex flex-col shadow-modus-3 focus:outline-hidden overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#d8dce0] bg-[#f8f9fa]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <button
                type="button"
                onClick={onBack}
                className="focus-ring p-2 rounded text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#b9dcf0] bg-white transition-colors cursor-pointer shrink-0 mt-0.5"
                title="Back to Admin Hub"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0063a3]">
                    Event Administration Hub
                  </span>
                  <span className="text-[#7c878e]">&bull;</span>
                  <span className="text-xs text-[#46535e]">{event.title}</span>
                </div>
                <h2 id="keynote-modal-title" className="text-lg font-bold text-[#252a2e] mt-0.5 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-[#0063a3]" />
                  <span>Keynote / General Session Production Hub</span>
                </h2>
                <p className="text-xs text-[#46535e] mt-0.5">
                  Plan the run-of-show order, narrative flow, slide deck links, weekly syncs, rehearsals, and export structured Markdown.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-white hover:bg-[#f1f3f6] text-[#0063a3] border border-[#0063a3] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy structured Markdown table"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy Markdown</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Download .md file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export .md</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="focus-ring p-1.5 text-[#7c878e] hover:text-[#252a2e] hover:bg-[#e5e9ec] rounded transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Session Switcher Tabs */}
          <div className="mt-4 pt-3 border-t border-[#e5e9ec] flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSessionId(s.id)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                    activeSession.id === s.id
                      ? 'bg-[#0063a3] text-white border-[#0063a3] shadow-xs'
                      : 'bg-white text-[#46535e] border-[#d8dce0] hover:border-[#0063a3] hover:text-[#0063a3]'
                  }`}
                >
                  <span>{s.title}</span>
                  {s.currentStage === 'signed_off' && (
                    <CheckCircle2 className="w-3 h-3 text-[#4ade80]" />
                  )}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCreatingSession(true)}
                className="px-2.5 py-1.5 rounded text-xs font-semibold text-[#0063a3] hover:bg-[#e5f2f8] border border-dashed border-[#b9dcf0] transition-colors cursor-pointer flex items-center gap-1"
                title="Add another keynote or general session"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Session</span>
              </button>
            </div>

            {/* Stage Indicator / Stepper */}
            <div className="flex items-center gap-1 bg-[#f1f3f6] p-1 rounded border border-[#d8dce0] text-xs shrink-0">
              <button
                type="button"
                onClick={() => handleSetStage('develop_run_of_show')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeSession.currentStage === 'develop_run_of_show'
                    ? 'bg-white text-[#0063a3] shadow-2xs'
                    : 'text-[#7c878e] hover:text-[#252a2e]'
                }`}
              >
                <span>1. Run of Show</span>
              </button>
              <ChevronRight className="w-3 h-3 text-[#7c878e]" />
              <button
                type="button"
                onClick={() => handleSetStage('slide_deck_prep')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeSession.currentStage === 'slide_deck_prep'
                    ? 'bg-white text-[#0063a3] shadow-2xs'
                    : 'text-[#7c878e] hover:text-[#252a2e]'
                }`}
              >
                <span>2. Slide Deck & Sync</span>
              </button>
              <ChevronRight className="w-3 h-3 text-[#7c878e]" />
              <button
                type="button"
                onClick={() => handleSetStage('signed_off')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeSession.currentStage === 'signed_off'
                    ? 'bg-white text-[#059669] shadow-2xs'
                    : 'text-[#7c878e] hover:text-[#252a2e]'
                }`}
              >
                <span>3. Sign Off</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* New Session Creator Modal Dialog */}
          {isCreatingSession && (
            <form
              onSubmit={handleCreateNewSession}
              className="bg-[#f0f7fb] border border-[#b9dcf0] rounded p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#0063a3] uppercase tracking-wider">
                  Create Additional Keynote / General Session
                </h4>
                <button
                  type="button"
                  onClick={() => setIsCreatingSession(false)}
                  className="text-xs text-[#7c878e]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Session Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    placeholder="e.g. Day 2 General Session: Product Roadmap"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Stage / Room
                  </label>
                  <input
                    type="text"
                    value={newSessionRoom}
                    onChange={(e) => setNewSessionRoom(e.target.value)}
                    placeholder="Mainstage Hall A"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingSession(false)}
                  className="px-3 py-1 text-xs text-[#46535e] bg-white border border-[#d8dce0] rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 text-xs font-semibold text-white bg-[#0063a3] rounded shadow-xs"
                >
                  Create Session
                </button>
              </div>
            </form>
          )}

          {/* Session Overview Bar */}
          <div className="p-4 bg-white border border-[#d8dce0] rounded flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#252a2e]">{activeSession.title}</h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    activeSession.currentStage === 'signed_off'
                      ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                      : activeSession.currentStage === 'slide_deck_prep'
                        ? 'bg-[#e5f2f8] text-[#0063a3] border-[#b9dcf0]'
                        : 'bg-[#fef3eb] text-[#d97316] border-[#fbd38d]'
                  }`}
                >
                  {activeSession.currentStage === 'signed_off'
                    ? 'Stage 3: Signed Off'
                    : activeSession.currentStage === 'slide_deck_prep'
                      ? 'Stage 2: Deck Prep'
                      : 'Stage 1: Run of Show'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#7c878e] mt-1 flex-wrap">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-[#0063a3]" />
                  <span>
                    {activeSession.startTime} &ndash; {activeSession.endTime}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#7c878e]" />
                  <span>{formatDate(activeSession.date)}</span>
                </span>
                <span>{activeSession.stageOrRoom}</span>
                {activeSession.slideDeckUrl && (
                  <a
                    href={activeSession.slideDeckUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[#0063a3] hover:underline font-semibold"
                  >
                    <Presentation className="w-3.5 h-3.5" />
                    <span>Open Master Deck</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteSession(activeSession.id, activeSession.title)}
                  className="p-1.5 text-[#da3832] hover:bg-[#fdf2f2] rounded border border-transparent hover:border-[#f5b5b3] transition-colors"
                  title="Delete this session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* STAGE 1: DEVELOP RUN OF SHOW & NARRATIVE ALIGNMENT       */}
          {/* ======================================================== */}
          <div className="space-y-4">
            <div className="border border-[#b9dcf0] bg-[#f0f7fb] rounded p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0063a3] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#fbad26]" />
                  <span>Stage 1 Tasks: Narrative & Flow Continuity Check</span>
                </h4>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-[#0063a3]">
                  <input
                    type="checkbox"
                    checked={activeSession.stage1Narrative.confirmedNarrative}
                    onChange={(e) =>
                      handleUpdateActiveSession({
                        stage1Narrative: {
                          ...activeSession.stage1Narrative,
                          confirmedNarrative: e.target.checked,
                        },
                      })
                    }
                    className="rounded text-[#0063a3]"
                  />
                  <span>Narrative Confirmed & Locked</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Confirm narrative */}
                <div className="bg-white p-3 rounded border border-[#d8dce0] space-y-1.5">
                  <label className="block text-[11px] font-bold text-[#252a2e]">
                    1. Overarching Keynote Narrative & Theme:
                  </label>
                  <textarea
                    rows={2}
                    value={activeSession.stage1Narrative.themeStatement}
                    onChange={(e) =>
                      handleUpdateActiveSession({
                        stage1Narrative: {
                          ...activeSession.stage1Narrative,
                          themeStatement: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. From Disruption to Practical Spatial Intelligence on the Jobsite and Cloud"
                    className="w-full text-xs text-[#252a2e] border border-[#d8dce0] rounded p-1.5 focus:outline-hidden focus:border-[#0063a3]"
                  />
                </div>

                {/* 2. Section Flow & Handover */}
                <div className="bg-white p-3 rounded border border-[#d8dce0] space-y-1.5">
                  <label className="block text-[11px] font-bold text-[#252a2e]">
                    2. Section Flow & Handover Connections:
                  </label>
                  <textarea
                    rows={2}
                    value={activeSession.stage1Narrative.flowHandoverNotes}
                    onChange={(e) =>
                      handleUpdateActiveSession({
                        stage1Narrative: {
                          ...activeSession.stage1Narrative,
                          flowHandoverNotes: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Connecting 3D motion graphic stinger transitions between executive address and live demo."
                    className="w-full text-xs text-[#252a2e] border border-[#d8dce0] rounded p-1.5 focus:outline-hidden focus:border-[#0063a3]"
                  />
                </div>

                {/* 3. Customer / Client Involvement */}
                <div className="bg-white p-3 rounded border border-[#d8dce0] space-y-1.5">
                  <label className="block text-[11px] font-bold text-[#252a2e]">
                    3. Customer & Client Involvement:
                  </label>
                  <textarea
                    rows={2}
                    value={activeSession.stage1Narrative.customerInvolvementNotes}
                    onChange={(e) =>
                      handleUpdateActiveSession({
                        stage1Narrative: {
                          ...activeSession.stage1Narrative,
                          customerInvolvementNotes: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Acme Corp VP of Infrastructure co-presenting 5-minute case study in segment 4."
                    className="w-full text-xs text-[#252a2e] border border-[#d8dce0] rounded p-1.5 focus:outline-hidden focus:border-[#0063a3]"
                  />
                </div>
              </div>
            </div>

            {/* Run of Show Table */}
            <div className="bg-white border border-[#d8dce0] rounded p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#252a2e]">
                    Run of Show Sequence & Timing Blocks
                  </h4>
                  <p className="text-[11px] text-[#7c878e]">
                    Order of events within this session. Use the Move Up / Down arrows to reorder.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingSegment(true)}
                  className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Segment</span>
                </button>
              </div>

              {/* Add Segment Form Drawer */}
              {isAddingSegment && (
                <form
                  onSubmit={handleAddSegment}
                  className="bg-[#f8f9fa] border border-[#d8dce0] rounded p-4 space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0063a3]">
                      Add New Run of Show Segment
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingSegment(false)}
                      className="text-xs text-[#7c878e] hover:text-[#252a2e]"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="lg:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                        Segment Topic / Action *
                      </label>
                      <input
                        type="text"
                        required
                        value={segmentTopic}
                        onChange={(e) => setSegmentTopic(e.target.value)}
                        placeholder="e.g. Live Architecture & Platform Demo"
                        className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                        Duration (Minutes) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        required
                        value={segmentDuration}
                        onChange={(e) => setSegmentDuration(parseInt(e.target.value, 10) || 5)}
                        className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                        Assign Speaker (Stakeholder)
                      </label>
                      <select
                        value={segmentSpeakerId}
                        onChange={(e) => {
                          setSegmentSpeakerId(e.target.value);
                          const matched = stakeholders.find((s) => s.id === e.target.value);
                          if (matched) {
                            setSegmentSpeakerName(`${matched.firstName} ${matched.lastName}`);
                          }
                        }}
                        className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-2.5 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                      >
                        <option value="">Select or Type Below</option>
                        {stakeholders.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.firstName} {s.lastName} ({s.team})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                        Speaker Name (if not in stakeholder list)
                      </label>
                      <input
                        type="text"
                        value={segmentSpeakerName}
                        onChange={(e) => setSegmentSpeakerName(e.target.value)}
                        placeholder="e.g. Guest Customer Speaker"
                        className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                        Handover & Transition Note
                      </label>
                      <input
                        type="text"
                        value={segmentHandover}
                        onChange={(e) => setSegmentHandover(e.target.value)}
                        placeholder="e.g. Connecting motion graphic to intro demo"
                        className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                        Stage Cues & AV Instructions
                      </label>
                      <input
                        type="text"
                        value={segmentCue}
                        onChange={(e) => setSegmentCue(e.target.value)}
                        placeholder="e.g. Lapel mic 1, spotlight center"
                        className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSegment(false)}
                      className="px-3 py-1 text-xs text-[#46535e] bg-white border border-[#d8dce0] rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 text-xs font-semibold text-white bg-[#0063a3] rounded shadow-xs"
                    >
                      Add Segment
                    </button>
                  </div>
                </form>
              )}

              {/* Segments List */}
              <div className="border border-[#d8dce0] rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-[#d8dce0] text-[#7c878e] font-semibold">
                      <th className="py-2.5 px-3 w-16 text-center">Order</th>
                      <th className="py-2.5 px-3 w-28">Time</th>
                      <th className="py-2.5 px-3">Topic / Segment</th>
                      <th className="py-2.5 px-3">Speaker(s)</th>
                      <th className="py-2.5 px-3">Handover / Transition</th>
                      <th className="py-2.5 px-3">Stage Cues</th>
                      <th className="py-2.5 px-3 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e9ec]">
                    {activeSession.segments.map((seg, idx) => (
                      <tr key={seg.id} className="hover:bg-[#f8f9fa] transition-colors">
                        {/* Order & Move Buttons */}
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-mono font-bold text-[#7c878e]">{idx + 1}</span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleReorder(seg.id, 'up')}
                                className="p-0.5 text-[#7c878e] hover:text-[#0063a3] disabled:opacity-20 cursor-pointer"
                                title="Move earlier"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === activeSession.segments.length - 1}
                                onClick={() => handleReorder(seg.id, 'down')}
                                className="p-0.5 text-[#7c878e] hover:text-[#0063a3] disabled:opacity-20 cursor-pointer"
                                title="Move later"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Calculated Time & Duration */}
                        <td className="py-2 px-3 font-mono font-semibold text-[#252a2e]">
                          <div>{seg.time}</div>
                          <div className="text-[10px] text-[#7c878e]">{seg.durationMinutes} min</div>
                        </td>

                        {/* Topic */}
                        <td className="py-2 px-3 font-semibold text-[#252a2e]">
                          {seg.topic}
                        </td>

                        {/* Speaker */}
                        <td className="py-2 px-3 text-[#46535e]">
                          <span className="font-medium text-[#252a2e]">
                            {seg.speakerNames || 'TBD'}
                          </span>
                        </td>

                        {/* Handover & Transition */}
                        <td className="py-2 px-3 text-[11px] text-[#46535e]">
                          {seg.handoverNotes || <span className="text-[#7c878e]">—</span>}
                        </td>

                        {/* Cues */}
                        <td className="py-2 px-3 text-[11px] text-[#46535e]">
                          {seg.cueNotes || <span className="text-[#7c878e]">—</span>}
                        </td>

                        {/* Delete */}
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteSegment(seg.id)}
                            className="p-1 text-[#da3832] hover:bg-[#fdf2f2] rounded transition-colors"
                            title="Remove segment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* STAGE 2: SLIDE DECK PREPARATION & PRODUCTION CADENCE    */}
          {/* ======================================================== */}
          <div className="border border-[#d8dce0] bg-[#f8f9fa] rounded p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0063a3] flex items-center gap-1.5">
                  <Presentation className="w-4 h-4 text-[#0063a3]" />
                  <span>Stage 2 Tasks: Slide Deck Preparation & Production Cadence</span>
                </h4>
                <p className="text-[11px] text-[#46535e]">
                  Attach presentation deck, establish weekly stakeholder sync, and schedule 2-3 rehearsals ~1 month before the event.
                </p>
              </div>

              {activeSession.currentStage === 'develop_run_of_show' && (
                <button
                  type="button"
                  onClick={() => handleSetStage('slide_deck_prep')}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-[#0063a3] text-white hover:bg-[#005084] transition-colors"
                >
                  Advance to Stage 2 &rarr;
                </button>
              )}
            </div>

            {/* Slide Deck URL */}
            <div className="bg-white p-4 rounded border border-[#d8dce0] space-y-2">
              <label className="block text-xs font-bold text-[#252a2e]">
                Master Presentation Slide Deck URL (Google Slides / PowerPoint Online)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={activeSession.slideDeckUrl || ''}
                  onChange={(e) => handleUpdateActiveSession({ slideDeckUrl: e.target.value })}
                  placeholder="https://docs.google.com/presentation/d/your-presentation-id"
                  className="flex-1 bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden font-mono"
                />
                {activeSession.slideDeckUrl && (
                  <a
                    href={activeSession.slideDeckUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded text-xs font-semibold bg-[#0063a3] text-white hover:bg-[#005084] flex items-center gap-1 shrink-0"
                  >
                    <span>Test Open Deck</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Weekly Stakeholder Meeting Setup */}
            <div className="bg-white p-4 rounded border border-[#d8dce0] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#0063a3]" />
                  <span className="text-xs font-bold text-[#252a2e]">
                    Weekly Stakeholder Progress Meeting
                  </span>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-[#46535e] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeSession.weeklyMeeting.enabled}
                    onChange={(e) =>
                      handleUpdateActiveSession({
                        weeklyMeeting: {
                          ...activeSession.weeklyMeeting,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="rounded text-[#0063a3]"
                  />
                  <span>Active Cadence</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#7c878e] mb-1">
                    Meeting Day
                  </label>
                  <select
                    value={activeSession.weeklyMeeting.dayOfWeek}
                    onChange={(e) =>
                      handleUpdateActiveSession({
                        weeklyMeeting: {
                          ...activeSession.weeklyMeeting,
                          dayOfWeek: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-white border border-[#d8dce0] rounded px-2.5 py-1.5 text-xs text-[#252a2e]"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => (
                      <option key={d} value={d}>
                        Every {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#7c878e] mb-1">
                    Meeting Time
                  </label>
                  <input
                    type="text"
                    value={activeSession.weeklyMeeting.time}
                    onChange={(e) =>
                      handleUpdateActiveSession({
                        weeklyMeeting: {
                          ...activeSession.weeklyMeeting,
                          time: e.target.value,
                        },
                      })
                    }
                    placeholder="10:00 AM PT"
                    className="w-full bg-white border border-[#d8dce0] rounded px-3 py-1.5 text-xs text-[#252a2e]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#7c878e] mb-1">
                    Video Meeting URL (Google Meet / Teams)
                  </label>
                  <input
                    type="text"
                    value={activeSession.weeklyMeeting.meetingUrl || ''}
                    onChange={(e) =>
                      handleUpdateActiveSession({
                        weeklyMeeting: {
                          ...activeSession.weeklyMeeting,
                          meetingUrl: e.target.value,
                        },
                      })
                    }
                    placeholder="https://meet.google.com/..."
                    className="w-full bg-white border border-[#d8dce0] rounded px-3 py-1.5 text-xs text-[#252a2e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#7c878e] mb-1">
                  Cadence Notes & Agenda
                </label>
                <input
                  type="text"
                  value={activeSession.weeklyMeeting.notes || ''}
                  onChange={(e) =>
                    handleUpdateActiveSession({
                      weeklyMeeting: {
                        ...activeSession.weeklyMeeting,
                        notes: e.target.value,
                      },
                    })
                  }
                  placeholder="Review slide progression, speaker transitions, and customer approvals."
                  className="w-full bg-white border border-[#d8dce0] rounded px-3 py-1.5 text-xs text-[#252a2e]"
                />
              </div>
            </div>

            {/* Rehearsals (~1 Month Prior) */}
            <div className="bg-white p-4 rounded border border-[#d8dce0] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#0063a3]" />
                    <span className="text-xs font-bold text-[#252a2e]">
                      Rehearsal Schedule (2–3 Rehearsals ~1 Month Before Event)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7c878e]">
                    Track dry runs, full deck walkthroughs, and technical on-site rehearsals.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingRehearsal(true)}
                  className="px-2.5 py-1 text-xs font-semibold text-[#0063a3] hover:bg-[#e5f2f8] border border-[#b9dcf0] rounded flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Rehearsal</span>
                </button>
              </div>

              {/* Add Rehearsal Form */}
              {isAddingRehearsal && (
                <form
                  onSubmit={handleAddRehearsal}
                  className="p-3 bg-[#f8f9fa] border border-[#d8dce0] rounded space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#252a2e] mb-1">
                        Rehearsal Title
                      </label>
                      <input
                        type="text"
                        required
                        value={rehTitle}
                        onChange={(e) => setRehTitle(e.target.value)}
                        placeholder="e.g. Rehearsal 4: Final Cue Check"
                        className="w-full bg-white border border-[#d8dce0] rounded px-2.5 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#252a2e] mb-1">
                        Target Date
                      </label>
                      <input
                        type="date"
                        value={rehDate}
                        onChange={(e) => setRehDate(e.target.value)}
                        className="w-full bg-white border border-[#d8dce0] rounded px-2.5 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#252a2e] mb-1">
                        Location / Link
                      </label>
                      <input
                        type="text"
                        value={rehLocation}
                        onChange={(e) => setRehLocation(e.target.value)}
                        placeholder="Studio A / Google Meet"
                        className="w-full bg-white border border-[#d8dce0] rounded px-2.5 py-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingRehearsal(false)}
                      className="px-2.5 py-1 text-xs text-[#46535e] bg-white border border-[#d8dce0] rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-semibold text-white bg-[#0063a3] rounded"
                    >
                      Save Rehearsal
                    </button>
                  </div>
                </form>
              )}

              {/* Rehearsals List */}
              <div className="space-y-2">
                {activeSession.rehearsals.map((r, i) => (
                  <div
                    key={r.id}
                    className={`p-3 rounded border flex items-center justify-between gap-3 transition-colors ${
                      r.isCompleted
                        ? 'bg-[#ecfdf5] border-[#a7f3d0]'
                        : 'bg-[#fafbfc] border-[#e5e9ec]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleRehearsal(r.id)}
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                          r.isCompleted
                            ? 'bg-[#059669] border-[#059669] text-white'
                            : 'bg-white border-[#d8dce0] hover:border-[#0063a3]'
                        }`}
                        title="Toggle completed"
                      >
                        {r.isCompleted && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div>
                        <div className="text-xs font-bold text-[#252a2e] flex items-center gap-2">
                          <span>{r.title}</span>
                          <span className="text-[10px] font-normal text-[#7c878e]">
                            ({r.targetDate} at {r.time})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#46535e] mt-0.5">
                          Location: {r.locationOrUrl} {r.notes ? `• ${r.notes}` : ''}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        r.isCompleted
                          ? 'bg-white text-[#059669]'
                          : 'bg-[#f1f3f6] text-[#7c878e]'
                      }`}
                    >
                      {r.isCompleted ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* STAGE 3: SIGN OFF & STRUCTURED MARKDOWN EXPORT           */}
          {/* ======================================================== */}
          <div className="border border-[#d8dce0] bg-white rounded p-4 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#059669] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                  <span>Stage 3: Executive & Stage Manager Sign Off</span>
                </h4>
                <p className="text-[11px] text-[#7c878e]">
                  Lock in the run of show, register sign-off, and export the structured Markdown table.
                </p>
              </div>

              {activeSession.currentStage === 'slide_deck_prep' && (
                <button
                  type="button"
                  onClick={() => handleSetStage('signed_off')}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-[#059669] text-white hover:bg-[#047857] transition-colors"
                >
                  Advance to Stage 3 &rarr;
                </button>
              )}
            </div>

            <div className="p-4 bg-[#f8f9fa] border border-[#d8dce0] rounded flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-semibold text-[#252a2e]">
                  {activeSession.signedOffBy ? (
                    <span className="flex items-center gap-1 text-[#059669] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Production Signed Off by {activeSession.signedOffBy} on {activeSession.signedOffAt}
                      </span>
                    </span>
                  ) : (
                    <span>Ready for final review and sign-off</span>
                  )}
                </span>
                <p className="text-[11px] text-[#7c878e]">
                  Signing off freezes the run of show and slide deck cues for show day distribution.
                </p>
              </div>

              {!activeSession.signedOffBy ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    placeholder="Approver Full Name"
                    className="bg-white border border-[#d8dce0] rounded px-3 py-1.5 text-xs text-[#252a2e]"
                  />
                  <button
                    type="button"
                    onClick={handleSignOff}
                    className="px-4 py-1.5 rounded text-xs font-semibold bg-[#059669] hover:bg-[#047857] text-white shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    Sign Off & Lock
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateActiveSession({
                      signedOffBy: undefined,
                      signedOffAt: undefined,
                      currentStage: 'slide_deck_prep',
                    })
                  }
                  className="px-3 py-1 rounded text-xs text-[#7c878e] hover:text-[#252a2e] border border-[#d8dce0] bg-white cursor-pointer"
                >
                  Unlock & Edit
                </button>
              )}
            </div>

            {/* Structured Markdown Export Section */}
            <div className="p-4 bg-[#f0f7fb] border border-[#b9dcf0] rounded space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0063a3]" />
                  <span className="text-xs font-bold text-[#0063a3]">
                    Structured Markdown Table Export
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMarkdownPreview((prev) => !prev)}
                    className="text-xs text-[#0063a3] hover:underline font-semibold"
                  >
                    {showMarkdownPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className="px-3 py-1 rounded text-xs font-semibold bg-white text-[#0063a3] border border-[#0063a3] hover:bg-[#e5f2f8] flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="px-3 py-1 rounded text-xs font-semibold bg-[#0063a3] text-white hover:bg-[#005084] flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download .md</span>
                  </button>
                </div>
              </div>

              {showMarkdownPreview && (
                <pre className="p-3 bg-white border border-[#b9dcf0] rounded text-[11px] font-mono text-[#252a2e] overflow-x-auto max-h-56 leading-relaxed">
                  {generateKeynoteMarkdown(activeSession, stakeholders)}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#d8dce0] bg-[#f8f9fa] flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="focus-ring px-3 py-1.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#0063a3] border border-[#d8dce0] hover:border-[#0063a3] bg-white transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin Hub</span>
          </button>

          <span className="text-[11px] text-[#7c878e] hidden sm:inline">
            3-Stage Keynote Production Workflow &bull; Structured Markdown Export
          </span>

          <button
            type="button"
            onClick={onClose}
            className="focus-ring px-4 py-1.5 rounded text-xs font-semibold bg-[#252a2e] hover:bg-[#1a1d20] text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
