import { redirect } from 'next/navigation';

type Props = {
  params: { rest?: string[] };
  searchParams: Record<string, string | string[] | undefined>;
};

export default function CatchAll({ params, searchParams }: Props) {
  // Rebuild query string to preserve params like status=success
  const qs = new URLSearchParams();
  Object.entries(searchParams || {}).forEach(([k, v]) => {
    if (v === undefined) return;
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
    else qs.append(k, String(v));
  });

  // If path contains an ID as first segment, include it as session_id if not present
  const rest = params?.rest || [];
  if (rest.length > 0) {
    const candidate = String(rest[0]);
    if (!qs.has('session_id')) qs.append('session_id', candidate);
  }

  const suffix = qs.toString();
  const target = `/verification-success${suffix ? `?${suffix}` : ''}`;
  redirect(target);
}
