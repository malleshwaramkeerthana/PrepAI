import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, BarChart3, Brain, Target, Sparkles, ArrowRight, User, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import heroBg from "@/assets/hero-bg.jpg";

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      
      if (session) {
        // Get user name from metadata or profile
        if (session.user.user_metadata?.name) {
          setUserName(session.user.user_metadata.name);
        } else {
          // Try to fetch from profiles table
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", session.user.id)
            .maybeSingle();
          
          if (profile?.name) {
            setUserName(profile.name);
          } else {
            setUserName(session.user.email?.split("@")[0] || "User");
          }
        }
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserName("");
    toast({ title: "Logged out", description: "See you next time!" });
  };

  const services = [
    {
      icon: Mic,
      title: "AI Mock Interviews",
      description: "Practice with intelligent AI that adapts to your responses in real-time",
    },
    {
      icon: Target,
      title: "Role-Based Questions",
      description: "Get tailored questions specific to your target job role and industry",
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description: "Track your progress with detailed charts and insights over time",
    },
    {
      icon: Brain,
      title: "Personalized Feedback",
      description: "Receive actionable coaching tips and course recommendations",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-warm flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-semibold text-foreground">PrepAI</span>
          </div>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <span className="text-foreground font-medium">
                  HI!! {userName}
                </span>
                <Button variant="ghost" onClick={() => navigate("/profile")}>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Button>
                <Button variant="ghost" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/auth")}>
                  Log In
                </Button>
                <Button variant="warm" onClick={() => navigate("/auth?mode=signup")}>
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 min-h-[85vh] flex items-center overflow-hidden">
        <div 
          className="absolute inset-0 z-0 opacity-30"
          style={{ 
            backgroundImage: `url(${heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background z-0" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">AI-Powered Interview Preparation</span>
            </div>
            
            <h1 className="font-serif text-5xl md:text-7xl font-bold leading-tight">
              Master Your Next
              <span className="block text-gradient">Interview</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Practice with our intelligent AI coach, receive personalized feedback, 
              and build the confidence to ace any interview.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                variant="warm"
                className="group"
                onClick={() => navigate(isLoggedIn ? "/interview" : "/auth")}
              >
                Start Interview
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate(isLoggedIn ? "/dashboard" : "/auth")}
              >
                {isLoggedIn ? "Go to Dashboard" : "Learn More"}
              </Button>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="relative mt-20">
            <div className="absolute -top-10 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -top-10 right-1/4 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Our comprehensive platform provides all the tools to prepare you for your dream job.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <div
                key={service.title}
                className="group p-6 rounded-xl bg-gradient-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-warm"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <service.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-serif text-lg font-semibold mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="relative p-12 rounded-2xl bg-gradient-card border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-warm opacity-5" />
            <div className="relative text-center space-y-6">
              <h2 className="font-serif text-3xl md:text-4xl font-bold">
                Ready to Ace Your Interview?
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Join thousands of candidates who have improved their interview skills 
                and landed their dream jobs.
              </p>
              <Button 
                size="lg" 
                variant="warm"
                className="group"
                onClick={() => navigate("/auth")}
              >
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          © 2025 PrepAI. Built to help you succeed.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
