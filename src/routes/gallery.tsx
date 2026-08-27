import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { CloudThumb } from "@/components/CloudThumb";
import { listPublicSightings } from "@/lib/sightings";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "What everyone saw — Cloudspotting" },
      {
        name: "description",
        content:
          "A shared wall of clouds and the shapes people found in them: dragons, teapots, sleeping dogs and stranger things.",
      },
      { property: "og:title", content: "What everyone saw — Cloudspotting" },
      {
        property: "og:description",
        content: "A shared wall of clouds and the shapes people found in them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  const { data, isLoading } = useQuery({
    queryKey: ["sightings", "public"],
    queryFn: listPublicSightings,
  });

  return (
    <main className="min-h-dvh bg-[image:var(--gradient-sky)] px-5 py-12 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← back to the sky
        </Link>
        <h1 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          What everyone saw
        </h1>
        <p className="mt-2 max-w-lg text-muted-foreground">
          Each card is the exact cloud someone was looking at, rebuilt from its shape.
        </p>

        {isLoading && <p className="mt-12 text-sm text-muted-foreground">Gathering clouds…</p>}

        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="mt-12 text-sm text-muted-foreground">
            Nobody has shared a sighting yet. Be the first.
          </p>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((s) => (
            <figure
              key={s.id}
              className="overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-[var(--shadow-drift)] backdrop-blur-sm"
            >
              <CloudThumb seed={s.seed} skyTime={s.skyTime} />
              <figcaption className="p-5">
                <p className="font-serif text-xl leading-snug text-foreground">“{s.text}”</p>
                <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {s.author} · {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </main>
  );
}
