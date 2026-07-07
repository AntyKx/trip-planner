export type AvatarPerson = { name: string; avatarUrl?: string | null };

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
};

export function Avatar({
  name,
  avatarUrl,
  size = "sm",
}: AvatarPerson & { size?: keyof typeof SIZE_CLASSES }) {
  const sizeClass = SIZE_CLASSES[size];
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white ${sizeClass}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-medium text-brand-700 ring-2 ring-white ${sizeClass}`}
    >
      {name.slice(0, 1)}
    </div>
  );
}

// Overlapping avatar stack (see the collaborator list on Home trip cards
// and CollaboratorsPanel) — caps how many faces show and folds the rest
// into a "+N" pill instead of the row growing unbounded.
export function AvatarStack({
  members,
  max = 4,
  size = "sm",
}: {
  members: AvatarPerson[];
  max?: number;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((m, i) => (
        <Avatar key={i} name={m.name} avatarUrl={m.avatarUrl} size={size} />
      ))}
      {overflow > 0 && (
        <div
          className={`flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-medium text-slate-600 ring-2 ring-white ${SIZE_CLASSES[size]}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
