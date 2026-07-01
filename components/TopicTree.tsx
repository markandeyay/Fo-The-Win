"use client";

export interface TopicTreeLeaf {
  topic_id: string;
  display_name: string;
  source_section?: string | null;
  starred?: boolean;
}

export interface TopicTreeGroup {
  group_id: string;
  display_name: string;
  order?: number;
  leaves: TopicTreeLeaf[];
}

interface TopicTreeProps {
  groups: TopicTreeGroup[];
  selectedTopicIds: string[];
  onSelectedTopicIdsChange: (topicIds: string[]) => void;
  masteryByTopic?: Record<string, number | undefined>;
  disabled?: boolean;
  title?: string;
  description?: string;
  maxHeightClassName?: string;
  defaultOpenCount?: number;
  compact?: boolean;
}

function masteryTone(value: number | undefined) {
  if (value === undefined) {
    return {
      label: "New",
      className: "border-slate-600 bg-slate-900 text-slate-200",
      barClassName: "bg-slate-500",
      width: "18%",
    };
  }

  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  if (percent >= 75) {
    return {
      label: `${percent}% locked`,
      className: "border-cyan-400/70 bg-cyan-400/10 text-cyan-100",
      barClassName: "bg-cyan-300",
      width: `${percent}%`,
    };
  }
  if (percent >= 40) {
    return {
      label: `${percent}% live`,
      className: "border-yellow-300/70 bg-yellow-300/10 text-yellow-100",
      barClassName: "bg-yellow-300",
      width: `${percent}%`,
    };
  }
  return {
    label: `${percent}% drill`,
    className: "border-fuchsia-300/70 bg-fuchsia-300/10 text-fuchsia-100",
    barClassName: "bg-fuchsia-300",
    width: `${Math.max(8, percent)}%`,
  };
}

export function TopicTree({
  groups,
  selectedTopicIds,
  onSelectedTopicIdsChange,
  masteryByTopic,
  disabled = false,
  title = "TopicTree",
  description,
  maxHeightClassName = "max-h-[34rem]",
  defaultOpenCount = 6,
  compact = false,
}: TopicTreeProps) {
  const selectedTopicSet = new Set(selectedTopicIds);

  function toggleTopic(topicId: string) {
    if (disabled) return;
    const next = selectedTopicSet.has(topicId)
      ? selectedTopicIds.filter((id) => id !== topicId)
      : [...selectedTopicIds, topicId];
    onSelectedTopicIdsChange(next);
  }

  function toggleGroup(topicIds: string[]) {
    if (disabled) return;
    const next = new Set(selectedTopicIds);
    const allSelected = topicIds.every((id) => next.has(id));
    for (const id of topicIds) {
      if (allSelected) {
        next.delete(id);
      } else {
        next.add(id);
      }
    }
    onSelectedTopicIdsChange([...next]);
  }

  return (
    <div className={disabled ? "opacity-70" : undefined}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={compact ? "text-xl font-black text-white" : "text-2xl font-black text-white"}>{title}</h2>
          <p className="mt-1 text-sm text-ftw-muted">
            {description ?? `${selectedTopicIds.length} topic${selectedTopicIds.length === 1 ? "" : "s"} selected`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelectedTopicIdsChange([])}
          disabled={disabled || selectedTopicIds.length === 0}
          className="rounded-full border border-slate-600 px-4 py-2 text-sm font-bold text-ftw-muted transition hover:border-ftw-accent hover:text-ftw-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <div className={`${maxHeightClassName} space-y-3 overflow-y-auto pr-1`}>
        {groups.map((group, index) => {
          const topicIds = group.leaves.map((leaf) => leaf.topic_id);
          const selectedCount = topicIds.filter((id) => selectedTopicSet.has(id)).length;
          const groupSelected = selectedCount === topicIds.length && topicIds.length > 0;
          return (
            <details
              key={group.group_id}
              open={index < defaultOpenCount || selectedCount > 0}
              className="group rounded-2xl border border-slate-700 bg-gray-950/60 p-4 shadow-inner shadow-black/30"
            >
              <summary className="cursor-pointer list-none rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ftw-accent">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-ftw-text">{group.display_name}</span>
                      <span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs font-bold text-ftw-muted">
                        {selectedCount}/{topicIds.length}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-ftw-muted">
                      {group.leaves.length} topic{group.leaves.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      toggleGroup(topicIds);
                    }}
                    disabled={disabled || topicIds.length === 0}
                    className={`rounded-full border px-4 py-2 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                      groupSelected
                        ? "border-ftw-accent bg-ftw-accent text-ftw-dark"
                        : "border-slate-600 bg-gray-900 text-ftw-muted hover:border-ftw-accent hover:text-ftw-text"
                    }`}
                  >
                    {groupSelected ? "Deselect chapter" : "Select chapter"}
                  </button>
                </div>
              </summary>
              <div className={compact ? "mt-4 grid gap-2" : "mt-4 grid gap-2 sm:grid-cols-2"}>
                {group.leaves.map((leaf) => {
                  const checked = selectedTopicSet.has(leaf.topic_id);
                  const mastery = masteryTone(masteryByTopic?.[leaf.topic_id]);
                  return (
                    <label
                      key={leaf.topic_id}
                      className={`relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-xl border px-3 py-3 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ftw-accent ${
                        checked
                          ? "border-ftw-accent bg-amber-400/10 shadow-lg shadow-amber-950/20"
                          : "border-slate-700 bg-ftw-panel hover:border-slate-500"
                      } ${disabled ? "cursor-not-allowed" : ""}`}
                    >
                      <span className={`absolute inset-x-0 bottom-0 h-1 ${mastery.barClassName}`} style={{ width: mastery.width }} />
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleTopic(leaf.topic_id)}
                        className="mt-1 h-4 w-4 accent-amber-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-ftw-text">{leaf.display_name}</span>
                          {leaf.starred && (
                            <span className="rounded-full border border-ftw-accent/70 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.18em] text-ftw-accent">
                              Boss
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block break-all text-xs text-ftw-muted">{leaf.topic_id}</span>
                      </span>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] ${mastery.className}`}>
                        {mastery.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
