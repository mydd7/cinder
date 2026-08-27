import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TranscriptResult } from "@/lib/types";
import { Panel } from "@/components/Primitives";

const ROLE_LABEL: Record<string, string> = { user: "You", assistant: "Assistant", tool: "Tool" };
const PAGE = 25;

export function Transcript({ source, session }: { source: string; session: string }) {
  const [data, setData] = useState<TranscriptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const requested = useRef("");

  useEffect(() => {
    setData(null);
    setOpen(false);
    setShown(PAGE);
    requested.current = "";
  }, [session]);

  useEffect(() => {
    const key = source + "/" + session;
    if (requested.current === key) return;
    requested.current = key;
    const api = window.cinder;
    if (!api) {
      setData({ supported: true, messages: [], error: "Bridge unavailable" });
      return;
    }
    setLoading(true);
    api
      .transcript(source, session)
      .then((res) => {
        if (requested.current !== key) return;
        setData(res.cancelled ? { supported: true, messages: [], error: "Read cancelled" } : res);
        setLoading(false);
      })
      .catch(() => {
        if (requested.current !== key) return;
        setData({ supported: true, messages: [], error: "Could not read the session file" });
        setLoading(false);
      });
  }, [source, session]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl bg-muted/40 py-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Show conversation
      </button>
    );
  }

  const all = data?.messages ?? [];
  const messages = all.slice(0, shown);

  return (
    <Panel
      title="Conversation"
      hint={
        <button onClick={() => setOpen(false)} className="transition-colors hover:text-foreground">
          Hide
        </button>
      }
    >
      {loading && <div className="py-6 text-center text-[12px] text-muted-foreground">Reading session log…</div>}
      {!loading && data && !data.supported && (
        <div className="py-6 text-center text-[12px] text-muted-foreground">
          Message text is not available for this source.
        </div>
      )}
      {!loading && data?.error && <div className="py-6 text-center text-[12px] text-muted-foreground">{data.error}</div>}
      {!loading && data?.supported && !data.error && !messages.length && (
        <div className="py-6 text-center text-[12px] text-muted-foreground">No messages in this session log.</div>
      )}
      {!loading && messages.length > 0 && (
        <div className="flex max-h-[60vh] flex-col gap-2.5 overflow-y-auto pr-1">
          {messages.map((m, i) => {
            const tokens = m.input + m.output + m.cacheWrite + m.cacheRead;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border p-3",
                  m.role === "user" ? "border-brand/25 bg-brand/[0.06]" : "border-foreground/5 bg-muted/25"
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                  <span className="font-semibold text-foreground">{ROLE_LABEL[m.role] || m.role}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {m.ts && <span>{new Date(m.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>}
                    {tokens > 0 && (
                      <>
                        <span className="tnum">
                          {fmt.int(m.input + m.cacheWrite + m.cacheRead)} in · {fmt.int(m.output)} out
                        </span>
                        <span className="font-semibold text-brand tnum">{fmt.usd(m.cost)}</span>
                      </>
                    )}
                  </span>
                </div>
                {m.text && (
                  <details className="group">
                    <summary className="line-clamp-3 cursor-pointer list-none whitespace-pre-wrap break-words text-[12.5px] leading-[1.55] text-muted-foreground group-open:hidden">
                      {m.text}
                    </summary>
                    <div className="hidden whitespace-pre-wrap break-words text-[12.5px] leading-[1.55] text-muted-foreground group-open:block">
                      {m.text}
                    </div>
                  </details>
                )}
                {m.tools && m.tools.length > 0 && (
                  <div className={cn("flex flex-col gap-1.5", m.text && "mt-2")}>
                    {m.tools.map((t, k) => (
                      <div key={k} className="flex items-start gap-2">
                        <span className="shrink-0 rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                          {t.name}
                        </span>
                        {t.detail && (
                          <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-[1.5] text-muted-foreground/85">
                            {t.detail}
                          </code>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {all.length > messages.length && (
            <button
              onClick={() => setShown((n) => n + PAGE)}
              className="w-full rounded-xl bg-muted/50 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Show more ({fmt.int(messages.length)} of {fmt.int(all.length)})
            </button>
          )}
          {all.length === messages.length && data?.total && data.total > all.length ? (
            <div className="py-2 text-center text-[11.5px] text-muted-foreground">
              Session log truncated to the first {fmt.int(all.length)} of {fmt.int(data.total)} messages
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
