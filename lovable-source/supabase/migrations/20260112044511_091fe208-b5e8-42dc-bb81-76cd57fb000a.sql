-- Add unique constraint on qbo_customer_id for upsert support
ALTER TABLE public.customers 
ADD CONSTRAINT customers_qbo_customer_id_key UNIQUE (qbo_customer_id);