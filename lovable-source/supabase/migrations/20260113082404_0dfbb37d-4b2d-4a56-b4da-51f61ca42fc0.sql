-- Create invitations table for invite-only signup
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  role app_role NOT NULL DEFAULT 'office',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(email, token)
);

-- Create index for token lookups
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
ON public.invitations
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
ON public.invitations
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can delete invitations
CREATE POLICY "Admins can delete invitations"
ON public.invitations
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow anonymous users to read invitation by token (for accepting)
CREATE POLICY "Anyone can read invitation by token"
ON public.invitations
FOR SELECT
USING (true);