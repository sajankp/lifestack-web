import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '../../components/ui/input';
import type { SpendingTag } from '../../types/spending';

interface TagPickerProps {
  tags: SpendingTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreateTag: (name: string) => Promise<SpendingTag>;
  testId?: string;
}

export const TagPicker: React.FC<TagPickerProps> = ({
  tags,
  selectedIds,
  onChange,
  onCreateTag,
  testId = 'spending-transaction-tags',
}) => {
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const selected = useMemo(
    () => tags.filter((tag) => selectedIds.includes(tag.public_id)),
    [selectedIds, tags],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = tags
    .filter((tag) => !selectedIds.includes(tag.public_id))
    .filter((tag) => !normalizedQuery || tag.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 8);
  const exactMatch = tags.some((tag) => tag.name.toLowerCase() === normalizedQuery);

  const addTag = (tag: SpendingTag) => {
    onChange([...selectedIds, tag.public_id]);
    setQuery('');
  };

  const createTag = async () => {
    const name = query.trim();
    if (!name || exactMatch || isCreating) return;
    setIsCreating(true);
    try {
      addTag(await onCreateTag(name));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div data-testid={testId} className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((tag) => (
          <span
            key={tag.public_id}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200"
          >
            {tag.name}
            <button
              type="button"
              aria-label={`Remove ${tag.name}`}
              onClick={() => onChange(selectedIds.filter((id) => id !== tag.public_id))}
              className="text-cyan-300 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void (suggestions[0] ? addTag(suggestions[0]) : createTag());
            }
          }}
          placeholder="Add or create a tag"
          autoComplete="off"
        />
        {query.trim() ? (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
            {suggestions.map((tag) => (
              <button
                key={tag.public_id}
                type="button"
                onClick={() => addTag(tag)}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                {tag.name}
              </button>
            ))}
            {!exactMatch ? (
              <button
                type="button"
                onClick={() => void createTag()}
                disabled={isCreating}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-cyan-300 hover:bg-slate-800 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {isCreating ? 'Creating…' : `Create “${query.trim()}”`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">Use tags for trips, people, merchants, or behaviors.</p>
    </div>
  );
};
