-- Add UPC column to parts table for barcode data
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS upc TEXT;