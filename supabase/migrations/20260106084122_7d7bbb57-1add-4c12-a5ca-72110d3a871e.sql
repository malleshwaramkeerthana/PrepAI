-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create interviews table
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  overall_score NUMERIC(4,2) DEFAULT 0,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on interviews
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Interviews policies
CREATE POLICY "Users can view their own interviews"
ON public.interviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own interviews"
ON public.interviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interviews"
ON public.interviews FOR UPDATE
USING (auth.uid() = user_id);

-- Create answers table
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  relevance_score NUMERIC(4,2) DEFAULT 0,
  clarity_score NUMERIC(4,2) DEFAULT 0,
  grammar_score NUMERIC(4,2) DEFAULT 0,
  confidence_score NUMERIC(4,2) DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on answers
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Answers policies (users can access answers for their interviews)
CREATE POLICY "Users can view answers for their interviews"
ON public.answers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.interviews
    WHERE interviews.id = answers.interview_id
    AND interviews.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create answers for their interviews"
ON public.answers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.interviews
    WHERE interviews.id = answers.interview_id
    AND interviews.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update answers for their interviews"
ON public.answers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.interviews
    WHERE interviews.id = answers.interview_id
    AND interviews.user_id = auth.uid()
  )
);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (new.id, new.raw_user_meta_data ->> 'name', new.email);
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for profiles timestamp
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);

-- Storage policies for resumes
CREATE POLICY "Users can upload their own resumes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own resumes"
ON storage.objects FOR SELECT
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own resumes"
ON storage.objects FOR DELETE
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);