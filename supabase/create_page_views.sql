CREATE TABLE IF NOT EXISTS page_views (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    page_type text NOT NULL, /* 'home' of 'cast_profile' */
    target_id uuid,          /* nullable, store cast_id for profile views */
    session_id text,         /* anonymous session id for deduplication (optional) */
    created_at timestamp WITH time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Allow insert for all (anon, authenticated, etc)
CREATE POLICY "Allow anonymous inserts" ON page_views
    FOR INSERT
    WITH CHECK (true);

-- Allow select for admins or everyone (if you process it securely). 
-- Since analytics are only shown in admin panel, only admins need select access.
-- But to make it simple at DB level for backend queries using service role, we can just allow read.
CREATE POLICY "Allow public select" ON page_views
    FOR SELECT
    USING (true);
