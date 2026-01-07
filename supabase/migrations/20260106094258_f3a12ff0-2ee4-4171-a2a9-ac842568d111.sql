-- Enable realtime for answers table
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;

-- Enable realtime for interviews table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;