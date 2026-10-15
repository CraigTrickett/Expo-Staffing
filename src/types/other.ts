export interface OtherNote {
  id: string;
  title: string;
  body: string;
  /** The module it relates to, if any. */
  moduleId?: string;
  createdAt: string;
  updatedAt: string;
}

/** An attachment is a link to a file that lives elsewhere (Drive, SharePoint). Files are never uploaded. */
export interface OtherLink {
  id: string;
  title: string;
  url: string;
  moduleId?: string;
  createdAt: string;
}

export interface OtherData {
  notes: OtherNote[];
  links: OtherLink[];
}
