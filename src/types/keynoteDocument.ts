/** Document-level text for the run of show export, shared by every session in the event. */
export interface KeynoteDocumentSettings {
  /** Top line, e.g. "Trimble Developer Summit 2026 — Run of Show". */
  title: string;
  /** Bold line under it, e.g. the event name and tagline. */
  headline: string;
  /** Italic line under that. */
  descriptor: string;
  objective: string;
  message: string;
  structure: string;
}
