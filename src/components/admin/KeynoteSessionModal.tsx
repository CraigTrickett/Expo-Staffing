import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowLeft,
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
  KeyStakeholder,
} from '@/types';
import {
  getKeynoteSessions,
  saveKeynoteSessions,
  createKeynoteSession,
  updateKeynoteSession,
  deleteKeynoteSession,
  describeTimingStatus,
  generateKeynoteMarkdown,
  sessionWindowMinutes,
  timingStatus,
  totalSegmentMinutes,
  downloadMarkdownFile,
  copyFormattedForGoogleDocs,
} from '@/lib/keynote';
import { getStakeholders } from '@/lib/stakeholders';
import { useModalA11y } from '@/lib/hooks';
import { toast } from '@/components/common/Toast';
import { formatDate } from '@/lib/utils';
import { StageSection } from './keynote/StageSection';
import { RunOfShowEditor } from './keynote/RunOfShowEditor';
import { RehearsalList } from './keynote/RehearsalList';
import { RunOfShowExportSection } from './keynote/RunOfShowExportSection';

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

  // Production stages start folded; the summary line on each header says where it stands.
  const [openStages, setOpenStages] = useState<Record<KeynoteStage, boolean>>({
    develop_run_of_show: false,
    slide_deck_prep: false,
    signed_off: false,
  });

  // New session modal
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionDate, setNewSessionDate] = useState(event.startDate || '');
  const [newSessionStartTime, setNewSessionStartTime] = useState('09:00');
  const [newSessionEndTime, setNewSessionEndTime] = useState('10:30');
  const [newSessionRoom, setNewSessionRoom] = useState('Mainstage Hall A');

  // Edit session state
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editDeckUrl, setEditDeckUrl] = useState('');

  // Delete session modal state
  const [sessionToDelete, setSessionToDelete] = useState<KeynoteSession | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Sign off state
  const [approverName, setApproverName] = useState('');

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

  const handleStartEditSession = () => {
    if (!activeSession) return;
    setEditTitle(activeSession.title);
    setEditDate(activeSession.date || '');
    setEditStartTime(activeSession.startTime || '09:00');
    setEditEndTime(activeSession.endTime || '10:30');
    setEditRoom(activeSession.stageOrRoom || 'Mainstage Hall A');
    setEditDeckUrl(activeSession.slideDeckUrl || '');
    setIsEditingSession(true);
  };

  const handleSaveEditSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    if (!editTitle.trim()) {
      toast.error('Session title cannot be empty.', 'Title Required');
      return;
    }

    handleUpdateActiveSession({
      title: editTitle.trim(),
      date: editDate,
      startTime: editStartTime.trim() || '09:00',
      endTime: editEndTime.trim() || '10:30',
      stageOrRoom: editRoom.trim() || 'Mainstage',
      slideDeckUrl: editDeckUrl.trim() || undefined,
    });
    setIsEditingSession(false);
    toast.success('Session details successfully updated.', 'Session Updated');
  };

  const handleInitiateDelete = (session: KeynoteSession) => {
    setSessionToDelete(session);
    setDeleteConfirmInput('');
  };

  const handleConfirmDelete = () => {
    if (!sessionToDelete) return;
    if (deleteConfirmInput.trim().toUpperCase() !== 'DELETE') {
      toast.error('Please type DELETE to confirm session deletion.', 'Confirmation Required');
      return;
    }

    const targetId = sessionToDelete.id;
    const targetTitle = sessionToDelete.title;
    deleteKeynoteSession(event.id, targetId);

    const remaining = sessions.filter((s) => s.id !== targetId);
    if (remaining.length > 0) {
      setSessions(remaining);
      setActiveSessionId(remaining[0].id);
    } else {
      const created = createKeynoteSession(event.id, {
        title: 'General Session',
        date: event.startDate || new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:30',
        stageOrRoom: 'Mainstage Hall A',
      });
      setSessions([created]);
      setActiveSessionId(created.id);
    }

    toast.success(`Session "${targetTitle}" has been permanently deleted.`, 'Session Deleted');
    setSessionToDelete(null);
    setDeleteConfirmInput('');
  };

  const toggleStage = (stage: KeynoteStage) =>
    setOpenStages((prev) => ({ ...prev, [stage]: !prev[stage] }));

  const goToStage = (stage: KeynoteStage) => {
    if (handleSetStage(stage)) setOpenStages((prev) => ({ ...prev, [stage]: true }));
  };

  const handleSetStage = (stage: KeynoteStage): boolean => {
    if (!activeSession) return false;
    if (stage === 'signed_off' && !activeSession.slideDeckUrl) {
      toast.error('Stage 2 slide deck URL must be provided before final sign-off.', 'Slide Deck Required');
      return false;
    }
    handleUpdateActiveSession({ currentStage: stage });
    toast.info(`Advanced to ${stage === 'signed_off' ? 'Stage 3: Sign Off' : stage === 'slide_deck_prep' ? 'Stage 2: Slide Deck Preparation' : 'Stage 1: Develop Run of Show'}.`, 'Stage Updated');
    return true;
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

  const handleCopyGoogleDocs = async () => {
    if (!activeSession) return;
    const ok = await copyFormattedForGoogleDocs(activeSession, stakeholders);
    if (ok) {
      toast.success(
        'Formatted run of show copied! Paste directly into Google Docs (Ctrl+V / Cmd+V) to preserve tables and styling.',
        'Ready for Google Docs'
      );
    } else {
      toast.error('Could not copy to clipboard. Please check browser permissions.', 'Copy Failed');
    }
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

  const segmentCount = activeSession.segments.length;
  const plannedMinutes = totalSegmentMinutes(activeSession.segments);
  const timing = timingStatus(plannedMinutes, sessionWindowMinutes(activeSession.startTime, activeSession.endTime));
  const rehearsalsDone = activeSession.rehearsals.filter((r) => r.isCompleted).length;
  const stage1Summary = `${segmentCount} ${segmentCount === 1 ? 'segment' : 'segments'} \u00b7 ${plannedMinutes} min planned \u00b7 ${describeTimingStatus(timing)} \u00b7 Narrative ${
    activeSession.stage1Narrative.confirmedNarrative ? 'confirmed' : 'not yet confirmed'
  }`;
  const stage2Summary = `${activeSession.slideDeckUrl ? 'Master deck linked' : 'No master deck yet'} \u00b7 ${
    activeSession.weeklyMeeting.enabled
      ? `Weekly sync ${activeSession.weeklyMeeting.dayOfWeek} ${activeSession.weeklyMeeting.time}`
      : 'Weekly sync off'
  } \u00b7 ${rehearsalsDone} of ${activeSession.rehearsals.length} rehearsals done`;
  const stage3Summary = activeSession.signedOffBy
    ? `Signed off by ${activeSession.signedOffBy}${activeSession.signedOffAt ? ` on ${activeSession.signedOffAt}` : ''}`
    : 'Not signed off yet';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#252a2e]/60 backdrop-blur-xs modal-scrim">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keynote-modal-title"
        className="modal-panel bg-white border border-[#d8dce0] rounded max-w-[98vw] 2xl:max-w-[1760px] w-full max-h-[96vh] flex flex-col shadow-modus-3 focus:outline-hidden overflow-hidden"
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
                  <span className="text-[#5b6770]">&bull;</span>
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
                onClick={handleCopyGoogleDocs}
                className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-[#0063a3] text-white hover:bg-[#005084] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Copy formatted document for Google Docs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy for Google Docs</span>
              </button>

              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="focus-ring px-2.5 py-1.5 rounded text-xs font-semibold bg-white hover:bg-[#f1f3f6] text-[#0063a3] border border-[#0063a3] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy structured Markdown table"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Copy Markdown</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="focus-ring px-2.5 py-1.5 rounded text-xs font-semibold bg-white hover:bg-[#f1f3f6] text-[#46535e] border border-[#d8dce0] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Download .md file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Export .md</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="focus-ring p-1.5 text-[#5b6770] hover:text-[#252a2e] hover:bg-[#e5e9ec] rounded transition-colors cursor-pointer"
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
                onClick={() => goToStage('develop_run_of_show')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeSession.currentStage === 'develop_run_of_show'
                    ? 'bg-white text-[#0063a3] shadow-2xs'
                    : 'text-[#5b6770] hover:text-[#252a2e]'
                }`}
              >
                <span>1. Run of Show</span>
              </button>
              <ChevronRight className="w-3 h-3 text-[#5b6770]" />
              <button
                type="button"
                onClick={() => goToStage('slide_deck_prep')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeSession.currentStage === 'slide_deck_prep'
                    ? 'bg-white text-[#0063a3] shadow-2xs'
                    : 'text-[#5b6770] hover:text-[#252a2e]'
                }`}
              >
                <span>2. Slide Deck & Sync</span>
              </button>
              <ChevronRight className="w-3 h-3 text-[#5b6770]" />
              <button
                type="button"
                onClick={() => goToStage('signed_off')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeSession.currentStage === 'signed_off'
                    ? 'bg-white text-[#059669] shadow-2xs'
                    : 'text-[#5b6770] hover:text-[#252a2e]'
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
                  className="text-xs text-[#5b6770]"
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
          {!isEditingSession ? (
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
                <div className="flex items-center gap-4 text-xs text-[#5b6770] mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-[#0063a3]" />
                    <span>
                      {activeSession.startTime} &ndash; {activeSession.endTime}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#5b6770]" />
                    <span>{formatDate(activeSession.date)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#5b6770]" />
                    <span>{activeSession.stageOrRoom}</span>
                  </span>
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

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleStartEditSession}
                  className="focus-ring px-3 py-1.5 rounded text-xs font-semibold text-[#0063a3] hover:text-[#005084] border border-[#b9dcf0] hover:border-[#0063a3] bg-[#e5f2f8] hover:bg-[#d0e8f5] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Edit session title, date, time window, and location"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateDelete(activeSession)}
                  className="focus-ring px-2.5 py-1.5 text-[#da3832] hover:bg-[#fdf2f2] rounded border border-[#f5b5b3] hover:border-[#da3832] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
                  title="Delete this keynote session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>
          ) : (
            /* Inline Edit Session Form */
            <form
              onSubmit={handleSaveEditSession}
              className="p-4 bg-[#f8f9fa] border-2 border-[#0063a3] rounded shadow-sm space-y-4 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#d8dce0]">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-[#0063a3]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0063a3]">
                    Edit Session Details
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingSession(false)}
                  className="text-xs text-[#5b6770] hover:text-[#252a2e]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Session Title / Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Opening Keynote: Scaling Enterprise Spatial AI"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Start Time (HH:MM)
                  </label>
                  <input
                    type="text"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    placeholder="09:00"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    End Time (HH:MM)
                  </label>
                  <input
                    type="text"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    placeholder="10:30"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Stage / Room / Location
                  </label>
                  <input
                    type="text"
                    value={editRoom}
                    onChange={(e) => setEditRoom(e.target.value)}
                    placeholder="e.g. Mainstage Hall A"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Master Slide Deck URL (Google Slides / PowerPoint Online)
                  </label>
                  <input
                    type="url"
                    value={editDeckUrl}
                    onChange={(e) => setEditDeckUrl(e.target.value)}
                    placeholder="https://docs.google.com/presentation/d/..."
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#d8dce0]">
                <button
                  type="button"
                  onClick={() => setIsEditingSession(false)}
                  className="px-3 py-1.5 text-xs text-[#46535e] bg-white border border-[#d8dce0] hover:bg-[#f1f3f6] rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0063a3] hover:bg-[#005084] rounded shadow-xs transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* STAGE 1: DEVELOP RUN OF SHOW & NARRATIVE ALIGNMENT       */}
          {/* ======================================================== */}
          <StageSection
            title="Stage 1: Develop Run of Show"
            description="Confirm the narrative, then build the sequence and timing blocks."
            summary={stage1Summary}
            open={openStages.develop_run_of_show}
            onToggle={() => toggleStage('develop_run_of_show')}
            isCurrent={activeSession.currentStage === 'develop_run_of_show'}
            icon={<Mic className="w-4 h-4 text-[#0063a3]" aria-hidden="true" />}
          >
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
                    className="rounded accent-[#0063a3] cursor-pointer"
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

            <RunOfShowEditor
              session={activeSession}
              stakeholders={stakeholders}
              onChange={(segments) => handleUpdateActiveSession({ segments })}
              onAddStakeholder={(newStakeholder) => {
                setStakeholders((prev) => [newStakeholder, ...prev]);
              }}
            />

            {/* Structured Markdown Table Export & Human-Friendly Document Preview */}
            <RunOfShowExportSection
              session={activeSession}
              stakeholders={stakeholders}
              className="mt-4"
            />
          </StageSection>

          {/* ======================================================== */}
          {/* STAGE 2: SLIDE DECK PREPARATION & PRODUCTION CADENCE    */}
          {/* ======================================================== */}
          <StageSection
            title="Stage 2: Slide Deck Preparation & Production Cadence"
            description="Attach presentation deck, establish weekly stakeholder sync, and schedule 2-3 rehearsals ~1 month before the event."
            summary={stage2Summary}
            open={openStages.slide_deck_prep}
            onToggle={() => toggleStage('slide_deck_prep')}
            isCurrent={activeSession.currentStage === 'slide_deck_prep'}
            icon={<Presentation className="w-4 h-4 text-[#0063a3]" aria-hidden="true" />}
            action={
              activeSession.currentStage === 'develop_run_of_show' ? (
                <button
                  type="button"
                  onClick={() => goToStage('slide_deck_prep')}
                  className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-[#0063a3] text-white hover:bg-[#005084] transition-colors cursor-pointer"
                >
                  Advance to Stage 2 &rarr;
                </button>
              ) : undefined
            }
          >

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
                    className="rounded accent-[#0063a3] cursor-pointer"
                  />
                  <span>Active Cadence</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5b6770] mb-1">
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
                  <label className="block text-[11px] font-semibold text-[#5b6770] mb-1">
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
                  <label className="block text-[11px] font-semibold text-[#5b6770] mb-1">
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
                <label className="block text-[11px] font-semibold text-[#5b6770] mb-1">
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

            <RehearsalList
              rehearsals={activeSession.rehearsals}
              fallbackDate={activeSession.date}
              onChange={(rehearsals) => handleUpdateActiveSession({ rehearsals })}
            />
          </StageSection>

          {/* ======================================================== */}
          {/* STAGE 3: SIGN OFF & STRUCTURED MARKDOWN EXPORT           */}
          {/* ======================================================== */}
          <StageSection
            title="Stage 3: Executive & Stage Manager Sign Off"
            description="Lock in the run of show, register sign-off, and export the structured Markdown table."
            summary={stage3Summary}
            open={openStages.signed_off}
            onToggle={() => toggleStage('signed_off')}
            isCurrent={activeSession.currentStage === 'signed_off'}
            titleClassName="text-[#005a28]"
            icon={<CheckCircle2 className="w-4 h-4 text-[#00823b]" aria-hidden="true" />}
            action={
              activeSession.currentStage === 'slide_deck_prep' ? (
                <button
                  type="button"
                  onClick={() => goToStage('signed_off')}
                  className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-[#00823b] text-white hover:bg-[#005a28] transition-colors cursor-pointer"
                >
                  Advance to Stage 3 &rarr;
                </button>
              ) : undefined
            }
          >

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
                <p className="text-[11px] text-[#5b6770]">
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
                  className="px-3 py-1 rounded text-xs text-[#5b6770] hover:text-[#252a2e] border border-[#d8dce0] bg-white cursor-pointer"
                >
                  Unlock & Edit
                </button>
              )}
            </div>

            {/* Structured Run of Show Export & Google Docs Document Section */}
            <RunOfShowExportSection
              session={activeSession}
              stakeholders={stakeholders}
              className="mt-4"
            />
          </StageSection>
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

          <span className="text-[11px] text-[#5b6770] hidden sm:inline">
            3-Stage Keynote Production Workflow &bull; Structured Markdown &amp; Google Docs Export
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

      {/* Delete Session Confirmation Modal (Requires typing DELETE) */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-[#d8dce0] rounded-lg p-5 max-w-md w-full shadow-modus-3 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#fdf2f2] text-[#da3832] rounded-full shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#252a2e]">Delete Keynote Session</h4>
                <p className="text-xs text-[#5b6770] mt-1">
                  Are you sure you want to delete <strong className="text-[#252a2e]">&ldquo;{sessionToDelete.title}&rdquo;</strong>?
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#fdf2f2] border border-[#f5b5b3] rounded text-xs text-[#da3832] space-y-1">
              <p className="font-semibold">This action cannot be undone.</p>
              <p className="text-[11px] text-[#252a2e]">
                All {sessionToDelete.segments.length} run-of-show segments, narrative planning, rehearsals, and slide cues will be permanently removed.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#252a2e]">
                To confirm deletion, please type <span className="font-mono text-[#da3832] font-bold">DELETE</span> below:
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder="Type DELETE to confirm"
                autoFocus
                className="w-full bg-white border border-[#d8dce0] focus:border-[#da3832] rounded px-3 py-2 text-xs text-[#252a2e] focus:outline-hidden font-mono uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e9ec]">
              <button
                type="button"
                onClick={() => {
                  setSessionToDelete(null);
                  setDeleteConfirmInput('');
                }}
                className="px-3 py-1.5 rounded text-xs font-semibold text-[#46535e] bg-white border border-[#d8dce0] hover:bg-[#f1f3f6] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmInput.trim().toUpperCase() !== 'DELETE'}
                onClick={handleConfirmDelete}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  deleteConfirmInput.trim().toUpperCase() === 'DELETE'
                    ? 'bg-[#da3832] text-white hover:bg-[#b52621] shadow-xs cursor-pointer'
                    : 'bg-[#e5e9ec] text-[#7c878e] cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Delete Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
