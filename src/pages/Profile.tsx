import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Mail, FileText, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Resume {
  name: string;
  created_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);
      setEmail(session.user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profile) {
        setName(profile.name || "");
      }

      // Fetch resumes
      const { data: files } = await supabase.storage
        .from("resumes")
        .list(session.user.id);

      if (files) {
        setResumes(files.map(f => ({
          name: f.name,
          created_at: f.created_at,
        })));
      }

      setIsLoading(false);
    };

    fetchProfile();
  }, [navigate]);

  const handleSave = async () => {
    setIsSaving(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
    }
    
    setIsSaving(false);
  };

  const handleDeleteResume = async (fileName: string) => {
    const { error } = await supabase.storage
      .from("resumes")
      .remove([`${userId}/${fileName}`]);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete resume.",
        variant: "destructive",
      });
    } else {
      setResumes(resumes.filter(r => r.name !== fileName));
      toast({
        title: "Deleted",
        description: "Resume removed successfully.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-2xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="space-y-6 animate-fade-in">
          <div>
            <h1 className="font-serif text-3xl font-bold mb-2">Your Profile</h1>
            <p className="text-muted-foreground">
              Manage your account information
            </p>
          </div>

          <Card className="bg-card/80 border-border">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={email}
                    disabled
                    className="bg-muted border-border pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <Button
                variant="warm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/80 border-border">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Uploaded Resumes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resumes.length > 0 ? (
                <div className="space-y-3">
                  {resumes.map((resume) => (
                    <div
                      key={resume.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-sm truncate max-w-[200px]">
                          {resume.name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteResume(resume.name)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No resumes uploaded yet. Upload one during an interview!
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
