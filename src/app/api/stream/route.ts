import { getDataVersion, subscribeDataVersion } from "@/lib/data-version";

export const dynamic = "force-dynamic";

// Server-Sent Events stream — pushes the data version to clients the moment
// anything changes in the database, so the UI refreshes instantly.
export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        unsubscribe?.();
        unsubscribe = null;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
      };

      // Initial version so the client has a baseline
      send(`data: ${getDataVersion()}\n\n`);

      unsubscribe = subscribeDataVersion(() => {
        send(`data: ${getDataVersion()}\n\n`);
      });

      // Heartbeat keeps proxies from closing the idle connection
      heartbeat = setInterval(() => send(`: ping\n\n`), 25000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
