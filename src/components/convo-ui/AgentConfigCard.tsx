/**
 * AgentConfigCard — agent identity summary. Renders the persona avatar, name + live badge,
 * a prompt excerpt with a fade-to-bg cutoff, tool chips, and a three-column telemetry row.
 * Static content for the catalog; real usage would accept props.
 */
export function AgentConfigCard() {
  const tools = ['get_invoice', 'issue_refund', 'lookup_user', 'schedule_callback'];
  const telemetry: Array<{ label: string; value: string; colorClass: string }> = [
    { label: 'Latency', value: '180ms', colorClass: 'text-success' },
    { label: 'Turns', value: '2.4k', colorClass: 'text-foreground' },
    { label: 'Avg call', value: '3:42', colorClass: 'text-foreground' },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      {/* Header — persona + title + live badge */}
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="relative size-12 overflow-hidden rounded-xl bg-gradient-to-br from-voice-a via-voice-b to-voice-c shadow-sm"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent)]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold text-foreground">
              Customer Support
            </div>
            <span className="rounded bg-[#E7F3EC] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#1E6B43]">
              LIVE
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Voice · MiMo v2.5 Pro · Ada · en-US
          </div>
        </div>
      </div>

      {/* System prompt excerpt with fade-out */}
      <div>
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          System prompt
        </div>
        <div className="relative max-h-20 overflow-hidden rounded-xl bg-muted p-3 font-mono text-xs leading-normal text-foreground">
          You are a friendly support agent for Nimbus, a cloud hosting company.
          Keep responses under 3 sentences. When customers ask about billing, use{' '}
          <span className="text-accent">get_invoice</span> before…
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-muted" />
        </div>
      </div>

      {/* Tool chips */}
      <div>
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Tools · {tools.length} enabled
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px] text-foreground"
            >
              <span className="size-[5px] rounded-full bg-success" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Telemetry snapshot */}
      <div className="grid grid-cols-3 gap-2.5 border-t border-border pt-3.5">
        {telemetry.map((s) => (
          <div key={s.label}>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
            <div className={`mt-0.5 font-ui text-lg font-medium ${s.colorClass}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentConfigCard;
