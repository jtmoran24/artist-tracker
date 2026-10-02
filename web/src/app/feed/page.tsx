import { createClient } from "@/utils/supabase/server";
import { acknowledgeAlert } from "./actions";

type Alert = {
  id: string;
  message: string;
  priority: string;
  is_uncertain: boolean;
  requires_ack: boolean;
  created_at: string;
  acknowledgements: { id: string }[];
};

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*, acknowledgements(id)")
    .order("created_at", { ascending: false })
    .returns<Alert[]>();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Feed</h1>
      {!alerts || alerts.length === 0 ? (
        <p className="text-gray-500">
          No alerts yet. The worker checks your followed artists' sources on
          a schedule and alerts will show up here when something changes.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => {
            const acked = alert.acknowledgements.length > 0;
            return (
              <li key={alert.id} className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase text-gray-500">
                    {alert.priority}
                    {alert.is_uncertain ? " · uncertain" : ""}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1">{alert.message}</p>
                {alert.requires_ack && (
                  <form
                    action={async () => {
                      "use server";
                      await acknowledgeAlert(alert.id);
                    }}
                  >
                    <button
                      type="submit"
                      disabled={acked}
                      className="mt-2 rounded-md bg-black px-3 py-1 text-sm text-white disabled:opacity-40"
                    >
                      {acked ? "Acknowledged" : "Acknowledge"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
