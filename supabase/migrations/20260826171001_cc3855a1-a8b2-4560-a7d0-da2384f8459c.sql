CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Cloudspotter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.sightings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  text TEXT NOT NULL,
  cloud_seed JSONB NOT NULL,
  sky_time DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sightings_user_created_idx ON public.sightings (user_id, created_at DESC);
CREATE INDEX sightings_public_created_idx ON public.sightings (created_at DESC) WHERE is_public;

GRANT SELECT ON public.sightings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sightings TO authenticated;
GRANT ALL ON public.sightings TO service_role;

ALTER TABLE public.sightings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public sightings are viewable by everyone" ON public.sightings FOR SELECT TO anon, authenticated USING (is_public);
CREATE POLICY "Users can view their own sightings" ON public.sightings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own sightings" ON public.sightings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sightings" ON public.sightings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sightings" ON public.sightings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), split_part(NEW.email, '@', 1), 'Cloudspotter')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();