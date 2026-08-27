import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CloudThumb } from "@/components/CloudThumb";
import { useAuth } from "@/hooks/useAuth";
import { deleteSighting, listMySightings, setSightingVisibility } from "@/lib/sightings";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "My cloud journal — Cloudspotting" },
      {
        name: "description",
        content: "Every cloud you named, kept exactly as it looked when you spotted it.",
      },
      { property: "og:title", content: "My cloud journal — Cloudspotting" },
      {
        property: "og:description",
        content: "Every cloud you named, kept exactly as it looked when you spotted it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Journal,
});

function Journal() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["sightings", "mine", user?.id],
    queryFn: listMySightings,
  });

  const mine = data?.filter((s) => s.userId === user?.id) ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sightings"] });

  const visibility = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      setSightingVisibility(id, isPublic),
    onSuccess: refresh,
    onError: () => toast.error("Could not change that"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSighting(id),
    onSuccess: () => {
      toast("Let it go");
      void refresh();
    },
  });

  return (
    <main className="min-h-dvh bg-[image:var(--gradient-sky)] px-5 py-12 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← back to the sky
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <h1 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          Your cloud journal
        </h1>
        <p className="mt-2 text-muted-foreground">
          {mine.length
            ? `${mine.length} sighting${mine.length === 1 ? "" : "s"} so far.`
            : "Nothing yet — go and find a dragon."}
        </p>

        {isLoading && <p className="mt-12 text-sm text-muted-foreground">Opening the journal…</p>}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((s) => (
            <figure
              key={s.id}
              className="overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-[var(--shadow-drift)] backdrop-blur-sm"
            >
              <CloudThumb seed={s.seed} skyTime={s.skyTime} />
              <figcaption className="p-5">
                <p className="font-serif text-xl leading-snug text-foreground">“{s.text}”</p>
                <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString()}
                </p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => visibility.mutate({ id: s.id, isPublic: !s.isPublic })}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {s.isPublic ? "Shared in gallery" : "Private"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(s.id)}
                    className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </main>
  );
}
