CREATE TABLE IF NOT EXISTS public.sns_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.sns_profiles(id) on delete cascade,
    customer_name VARCHAR,
    customer_phone VARCHAR,
    cast_id UUID NOT NULL REFERENCES public.sns_profiles(id) on delete cascade,
    store_id UUID,
    reserve_date DATE NOT NULL,
    reserve_time VARCHAR NOT NULL,
    course_id UUID,
    course_name VARCHAR,
    course_price INT,
    nomination_id UUID,
    nomination_name VARCHAR,
    nomination_price INT,
    options JSONB,
    discount_id UUID,
    discount_name VARCHAR,
    discount_price INT,
    total_price INT NOT NULL DEFAULT 0,
    customer_notes TEXT,
    status VARCHAR NOT NULL DEFAULT 'pending', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- status: 'pending', 'confirmed', 'cancelled', 'completed'

-- Row Level Security (RLS) policies
ALTER TABLE public.sns_reservations ENABLE ROW LEVEL SECURITY;

-- 1. Create Policy: Customers can insert their own reservations
CREATE POLICY "Customers can insert own reservations" ON public.sns_reservations
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = customer_id);

-- 2. Select Policy: Customers can see their own, Casts can see their own
CREATE POLICY "Users can see their own reservations" ON public.sns_reservations
    FOR SELECT
    TO authenticated
    USING (auth.uid() = customer_id OR auth.uid() = cast_id);

-- 3. Admin can read all
CREATE POLICY "Admins can read all reservations" ON public.sns_reservations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sns_profiles
            WHERE sns_profiles.id = auth.uid() AND sns_profiles.is_admin = true
        )
    );
    
-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sns_reservations_modtime
    BEFORE UPDATE ON public.sns_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
