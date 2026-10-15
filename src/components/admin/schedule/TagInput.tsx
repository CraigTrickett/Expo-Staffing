import React, { useId, useState } from 'react';
import { X } from 'lucide-react';
import { cleanTags } from '@/lib/schedule';
import { formFieldClass } from '@/components/common/StakeholderSelect';

interface TagInputProps {
  tags: string[];
  /** Tags already used elsewhere, offered as suggestions. */
  suggestions: string[];
  onChange: (next: string[]) => void;
  label: string;
}

/** Product or track labels such as Field Systems or SketchUp. Enter or a comma adds one. */
export const TagInput: React.FC<TagInputProps> = ({ tags, suggestions, onChange, label }) => {
  const uid = useId();
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const next = cleanTags([...tags, ...raw.split(',')]);
    if (next.length !== tags.length) onChange(next);
    setDraft('');
  };

  return (
    <div>
      {tags.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label={`${label}: current tags`}>
          {tags.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded border border-[#d8dce0] bg-[#f1f3f6] py-0.5 pl-2 pr-1 text-[11px] font-semibold text-[#46535e]">
              {t}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="focus-ring cursor-pointer rounded p-0.5 hover:bg-[#d8dce0]">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={`${uid}-tag`} className="sr-only">Add a tag to {label}</label>
      <input
        id={`${uid}-tag`}
        type="text"
        list={`${uid}-list`}
        value={draft}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (draft.trim()) add(draft);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder="Add a tag and press Enter"
        className={formFieldClass}
      />
      <datalist id={`${uid}-list`}>
        {suggestions.filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase())).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
};
