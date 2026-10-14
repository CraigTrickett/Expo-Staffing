# Key Stakeholders Directory & Keynote Run-of-Show Session Hub (3-Stage Workflow)

Deliver dedicated management workspaces for **Key Stakeholders** and **Keynote / General Session** with a structured **3-stage production workflow**, including **Stage 1 narrative confirmation, section flow transitions, and customer involvement checks**, **Stage 2 weekly stakeholder meetings and rehearsals**, streamline the top navigation header with "Events" and "Menu", prune unwanted admin cards, and generate structured Markdown run-of-show exports.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Keynote 3-Stage Production Workflow**:
> Every Keynote / General Session advances through three explicit production milestones with structured task checklists:
> 
> 1. **Stage 1: Develop Run of Show & Narrative Alignment**
>    - **Confirm Narrative**: Overarching keynote storyline, core theme statement, and key executive takeaways.
>    - **Section Flow & Handover Dynamics**: Confirm how sections connect and transition (continued narrative, connecting graphics/motion stingers, video bumpers, speaker stage handovers).
>    - **Customer / Client Involvement**: Track customer speakers, client co-presenters, video testimonials, and case study approval.
>    - **Run of Show Segment Grid**: Chronological order of segments with duration, speaker assignments, and stage cue notes (slide deck is not required at this stage).
> 
> 2. **Stage 2: Slide Deck Preparation & Production Cadence**
>    - **Slide Deck Integration**: Attaching master presentation deck URL (Google Slides / PowerPoint Online) with direct launcher and segment-level slide link cues.
>    - **Weekly Stakeholder Progress Meeting**: Establishing and tracking a weekly sync with key stakeholders to monitor progress in their segment of the session.
>    - **Rehearsal Scheduling (2–3 Rehearsals ~1 Month Out)**: Planning and tracking 2 to 3 rehearsals scheduled approximately 1 month prior to the event (Dry Run 1: Content Flow, Dry Run 2: Slide Walkthrough, Dry Run 3: Technical AV & Mic Check).
> 
> 3. **Stage 3: Sign Off**
>    - Final executive and stage manager sign-off with approver attribution, status badge ("Approved & Locked"), read-only run-of-show view, and one-click structured Markdown export.

- **Confirmed Decision 1**: Header links updated — "All Events" becomes "Events", and "New Event" is replaced by "Menu" (which routes to the Event Administration Hub).
- **Confirmed Decision 2**: "Security & Emergency" and "Vendor & Freight Logistics" cards are completely removed from the Admin Hub catalog.
- **Confirmed Decision 3**: Unified stakeholder directory where existing booth staff are accessible as stakeholders with extended fields (First Name, Surname, Email, Team, and Involved With areas).
- **Confirmed Decision 4**: Structured Markdown table export with Time, Duration, Speaker(s), Topic / Segment, Handover / Slide Link, and Stage Cues.

---

## 1. Overview & Core Concept

### What It Delivers
1. **Header Navigation Refinement**:
   - Replaces "All Events" with **"Events"**.
   - Replaces "New Event" with **"Menu"**, which launches the **Event Administration Hub** for the active event (or opens the Events selector if no event is currently active).

2. **Key Stakeholders Management**:
   - Comprehensive stakeholder directory per event.
   - Captures **Name** (first name), **Surname** (last name), **Email**, **Team/Department**, and **Involved with** (multi-select tag taxonomy referencing: *Keynote & General Session*, *Marketing*, *Expo Booths*, *Badging & Registration*, *Social Event*, *Sponsorship*, *Swag*, etc.).
   - Unified with the booth roster: existing booth staff are automatically surfaced with pre-filled names and emails, and adding a stakeholder allows optionally flagging them for booth staffing.
   - Quick filtering by team and involved area, inline editing, and deletion.

3. **Keynote / General Session Management (3-Stage Workflow)**:
   - Supports **single or multiple sessions** (e.g., Day 1 Morning Keynote, Day 2 General Session, Closing Keynote).
   - **Stage 1 (Develop Run of Show & Narrative)**:
     - Master Narrative Definition (Theme, Core Message, Confirmed checkbox).
     - Section Handover Tracker (Connecting Graphics, Live Walk-on, Video Interstitial).
     - Customer / Client Involvement Tracker (Company, Client Speaker, Format: Co-presentation / Video / Case Study).
     - Segment Builder (Topic, Speaker, Duration, Stage Cues, Move Up/Down reordering).
   - **Stage 2 (Slide Deck Prep & Production Cadence)**:
     - Master Slide Deck URL with instant "Open Deck" launcher.
     - Weekly Stakeholder Sync Tracker (Day, Time, Video Link, Attendance).
     - Rehearsal Schedule (2–3 rehearsals ~1 month before event with completion toggles).
   - **Stage 3 (Sign Off & Export)**:
     - Sign-off lock, approver name, timestamp, and structured Markdown export.

4. **Pruned Admin Hub Catalog**:
   - Removed "Security & Emergency" and "Vendor & Freight Logistics" from the module list.
   - Elevated "Key Stakeholders" and "Keynote / General Session" to **Active** modules that open full-featured management views.

---

## 2. User Experience & Visual Design

### 3-Stage Workflow Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│ Keynote Session: "Day 1 Morning Keynote: Spatial AI Keynote"           │
│                                                                        │
│  [✓ 1. Develop Run of Show]  ──>  [2. Slide Deck Prep]  ──>  [3. Sign Off]│
├────────────────────────────────────────────────────────────────────────┤
│ Stage 1: Develop Run of Show & Narrative Alignment                     │
│  • [Narrative Check]: Theme statement, core executive message [✓]      │
│  • [Flow & Handover]: Visualizing section connections & graphics       │
│  • [Customer Involvement]: Client co-presenters & video case studies   │
│  • Run of Show Grid: Move Up / Down controls & Start Time sync         │
│  • [Advance to Stage 2: Slide Deck Prep ->]                            │
├────────────────────────────────────────────────────────────────────────┤
│ Stage 2: Slide Deck Prep & Production Cadence                          │
│  • Master Slide Deck URL (Google Slides / PPT) & [Test Open Deck]      │
│  • Weekly Stakeholder Sync (Day/Time, Video Call link, Notes)          │
│  • Rehearsal Milestones (2-3 scheduled ~1 month before event):         │
│     [✓] Rehearsal 1: Content & Flow (Date: Sep 20)                     │
│     [✓] Rehearsal 2: Full Slide Deck Walkthrough (Date: Sep 27)        │
│     [ ] Rehearsal 3: Technical AV & Stage Mic Check (Date: Oct 04)     │
│  • Segment slide links / slide deck references                         │
│  • [Advance to Stage 3: Sign Off ->]                                   │
├────────────────────────────────────────────────────────────────────────┤
│ Stage 3: Sign Off                                                      │
│  • Final run-of-show preview & stage cues                              │
│  • Approver Name & Sign-off timestamp                                 │
│  • Status: "Production Signed Off"                                     │
│  • Actions: [Copy Markdown Table] [Download .md File]                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Design Rules Applied
- Adheres to **Trimble Modus** design language: `#004f83` (Trimble Blue header), `#0063a3` (Action primary), `#252a2e` (Deep charcoal text), `#f1f3f6` (Clean neutral canvas), `#d8dce0` (Hairline border).
- High-density data presentation with zero generic AI clutter: unboxed metadata (`·` dividers), tabular numerals (`font-mono tabular-nums`), and single-elevation cards.
- Complete working event handlers for adding, editing, reordering, advancing stages, signing off, and exporting.

---

## 3. Technical Architecture & Data Strategy

### Data Models
```typescript
export type KeynoteStage = 'develop_run_of_show' | 'slide_deck_prep' | 'signed_off';

export interface Stage1NarrativeConfig {
  confirmedNarrative: boolean;
  themeStatement: string;
  coreMessage: string;
  flowHandoverNotes: string;       // e.g. "Connecting graphic between Section 2 and 3; host bridge into client demo"
  hasConnectingGraphics: boolean;
  customerInvolvementNotes: string; // e.g. "Acme Corp VP of Digital Transformation co-presenting in segment 3"
  customerCompanies: string[];     // ['Acme Corp', 'Global Logistics Inc']
}

export interface WeeklyMeetingConfig {
  enabled: boolean;
  dayOfWeek: string;    // e.g. "Tuesday"
  time: string;         // e.g. "10:00 AM PT"
  meetingUrl?: string;  // e.g. Google Meet / Teams link
  notes?: string;
  lastMeetingDate?: string;
}

export interface RehearsalItem {
  id: string;
  title: string;        // e.g. "Rehearsal 1: Timing & Content Dry Run"
  targetDate: string;   // ~1 month before event
  time: string;
  locationOrUrl: string;
  isCompleted: boolean;
  notes?: string;
}

export interface KeyStakeholder {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  team: string;
  involvedWith: string[]; // ['Keynote / General Session', 'Marketing', 'Expo Booths', 'Badging & Registration', 'Social Event', 'Sponsorship']
  phone?: string;
  notes?: string;
  createdAt: string;
}

export interface RunOfShowSegment {
  id: string;
  order: number;
  time: string;           // e.g. "09:00 - 09:15"
  durationMinutes: number;
  topic: string;
  speakerIds: string[];
  speakerNames: string;
  handoverNotes?: string; // Connecting transition, stinger, graphic or host handoff
  slideDeckLink?: string;
  cueNotes?: string;
}

export interface KeynoteSession {
  id: string;
  eventId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  stageOrRoom: string;
  currentStage: KeynoteStage;
  slideDeckUrl?: string;
  assignedSpeakerIds: string[];
  stage1Narrative: Stage1NarrativeConfig;
  weeklyMeeting: WeeklyMeetingConfig;
  rehearsals: RehearsalItem[];
  segments: RunOfShowSegment[];
  signedOffBy?: string;
  signedOffAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Markdown Export Format
```markdown
# Day 1 Morning Keynote: Spatial AI Keynote
- **Date & Time:** October 21, 2026 | 09:00 – 10:30
- **Stage / Room:** Mainstage Hall A
- **Slide Deck:** https://docs.google.com/presentation/d/...
- **Production Status:** Signed Off (Approved by Craig Trickett on 2026-10-14 09:30)
- **Narrative Theme:** From Disruption to Practical Spatial Intelligence
- **Customer Involvement:** Acme Corp (VP Infrastructure Co-Presentation)
- **Weekly Sync:** Tuesdays at 10:00 AM PT
- **Rehearsals:** 3 Scheduled (~1 Month Out) — All Completed

## Run of Show

| Time | Duration | Speaker(s) | Topic / Segment | Handover / Transition | Slide / Deck Link | Stage Cues & AV Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 09:00 - 09:05 | 5 min | MC / Host | Welcome & Housekeeping | Walk-on from Stage Left | [Deck](...) | House lights down, spotlight center |
| 09:05 - 09:30 | 25 min | Sarah Chen | Executive Keynote Address | Connecting 3D Motion Stinger | [Slides 1-18](...) | Lapel mic 1, teleprompter feed active |
...
```
