import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SkyScene } from "@/components/SkyScene";
import { useAuth } from "@/hooks/useAuth";
import { createSighting } from "@/lib/sightings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cloudspotting — lie back and name the clouds" },
      {
        name: "description",
        content:
          "A calm sky you can sit under. Watch drifting clouds, blow a gust of wind, and write down what each one looks like.",
      },
      { property: "og:title", content: "Cloudspotting — lie back and name the clouds" },
      {
        property: "og:description",
        content:
          "A calm sky you can sit under. Watch drifting clouds, blow a gust of wind, and write down what each one looks like.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const handleSave = async ({
    text,
    seed,
    skyTime,
  }: {
    text: string;
    seed: import("@/lib/sky/cloud").CloudSeed;
    skyTime: number;
  }) => {
    if (!user) {
      toast("Sign in to keep your sightings", {
        description: "Your cloud will drift on for now.",
        action: { label: "Sign in", onClick: () => void navigate({ to: "/auth" }) },
      });
      return;
    }
    setSaving(true);
    try {
      await createSighting({ text, seed, skyTime, isPublic: true });
      toast.success("Kept in your journal", { description: `“${text}”` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that one");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <h1 className="sr-only">Cloudspotting</h1>
      <SkyScene onSave={handleSave} signedIn={!!user} saving={saving} />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5 sm:p-7">
        <div className="pointer-events-auto rounded-2xl border border-border/40 bg-card/50 px-4 py-2.5 backdrop-blur-md">
          <p className="font-serif text-xl leading-none text-foreground">Cloudspotting</p>
          <p className="mt-1 text-xs text-muted-foreground">Tap a cloud. Say what you see.</p>
        </div>
        <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/40 bg-card/50 p-1.5 text-sm backdrop-blur-md">
          <Link
            to="/gallery"
            className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            Gallery
          </Link>
          {user ? (
            <Link
              to="/journal"
              className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            >
              My journal
            </Link>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-primary px-3.5 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {loading ? "…" : "Sign in"}
            </Link>
          )}
        </nav>
      </header>
    </main>
  );
}
