import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Mic, 
  TrendingUp, 
  Target, 
  AlertCircle, 
  BarChart3, 
  User, 
  LogOut,
  Sparkles,
  PlayCircle,
  Home
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface Stats {
  totalInterviews: number;
  averageScore: number;
  bestSkill: string;
  weakSkill: string;
}

interface Interview {
  id: string;
  role: string;
  overall_score: number;
  created_at: string;
}

interface SkillData {
  skill: string;
  score: number;
  userScore: number;
  platformAvg: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [stats, setStats] = useState<Stats>({
    totalInterviews: 0,
    averageScore: 0,
    bestSkill: "N/A",
    weakSkill: "N/A",
  });
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [skillData, setSkillData] = useState<SkillData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (currentUserId: string) => {
    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (profile?.name) {
      setUserName(profile.name);
    }

    // Fetch user interviews
    const { data: interviewData } = await supabase
      .from("interviews")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    // Fetch platform-wide averages for comparison
    const { data: allAnswers } = await supabase
      .from("answers")
      .select("relevance_score, clarity_score, grammar_score, confidence_score");

    // Calculate platform averages
    let platformAvg = { relevance: 0, clarity: 0, grammar: 0, confidence: 0 };
    if (allAnswers && allAnswers.length > 0) {
      platformAvg = {
        relevance: allAnswers.reduce((acc, a) => acc + (a.relevance_score || 0), 0) / allAnswers.length,
        clarity: allAnswers.reduce((acc, a) => acc + (a.clarity_score || 0), 0) / allAnswers.length,
        grammar: allAnswers.reduce((acc, a) => acc + (a.grammar_score || 0), 0) / allAnswers.length,
        confidence: allAnswers.reduce((acc, a) => acc + (a.confidence_score || 0), 0) / allAnswers.length,
      };
    }

    if (interviewData && interviewData.length > 0) {
      setInterviews(interviewData);
      
      const avgScore = interviewData.reduce((acc, i) => acc + Number(i.overall_score || 0), 0) / interviewData.length;
      
      // Fetch user's answers for skill analysis
      const interviewIds = interviewData.map(i => i.id);
      const { data: userAnswers } = await supabase
        .from("answers")
        .select("*")
        .in("interview_id", interviewIds);

      let bestSkill = "Communication";
      let weakSkill = "Technical";
      let userSkills = { Relevance: 0, Clarity: 0, Grammar: 0, Confidence: 0 };

      if (userAnswers && userAnswers.length > 0) {
        userSkills = {
          Relevance: userAnswers.reduce((acc, a) => acc + Number(a.relevance_score || 0), 0) / userAnswers.length,
          Clarity: userAnswers.reduce((acc, a) => acc + Number(a.clarity_score || 0), 0) / userAnswers.length,
          Grammar: userAnswers.reduce((acc, a) => acc + Number(a.grammar_score || 0), 0) / userAnswers.length,
          Confidence: userAnswers.reduce((acc, a) => acc + Number(a.confidence_score || 0), 0) / userAnswers.length,
        };

        const sortedSkills = Object.entries(userSkills).sort((a, b) => b[1] - a[1]);
        bestSkill = sortedSkills[0]?.[0] || "N/A";
        weakSkill = sortedSkills[sortedSkills.length - 1]?.[0] || "N/A";
      }

      // Build skill comparison data with real-time values
      const newSkillData: SkillData[] = [
        { skill: "Relevance", score: Math.round(userSkills.Relevance), userScore: Math.round(userSkills.Relevance), platformAvg: Math.round(platformAvg.relevance) },
        { skill: "Clarity", score: Math.round(userSkills.Clarity), userScore: Math.round(userSkills.Clarity), platformAvg: Math.round(platformAvg.clarity) },
        { skill: "Grammar", score: Math.round(userSkills.Grammar), userScore: Math.round(userSkills.Grammar), platformAvg: Math.round(platformAvg.grammar) },
        { skill: "Confidence", score: Math.round(userSkills.Confidence), userScore: Math.round(userSkills.Confidence), platformAvg: Math.round(platformAvg.confidence) },
      ];
      setSkillData(newSkillData);

      setStats({
        totalInterviews: interviewData.length,
        averageScore: Math.round(avgScore * 10) / 10,
        bestSkill,
        weakSkill,
      });
    } else {
      // Default skill data when no interviews
      setSkillData([
        { skill: "Relevance", score: 0, userScore: 0, platformAvg: Math.round(platformAvg.relevance) },
        { skill: "Clarity", score: 0, userScore: 0, platformAvg: Math.round(platformAvg.clarity) },
        { skill: "Grammar", score: 0, userScore: 0, platformAvg: Math.round(platformAvg.grammar) },
        { skill: "Confidence", score: 0, userScore: 0, platformAvg: Math.round(platformAvg.confidence) },
      ]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);
      
      if (session.user.user_metadata?.name) {
        setUserName(session.user.user_metadata.name);
      } else {
        setUserName(session.user.email?.split("@")[0] || "User");
      }

      await fetchData(session.user.id);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    checkAuth();
    return () => subscription.unsubscribe();
  }, [navigate, fetchData]);

  // Real-time subscription for live updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answers',
        },
        () => {
          // Refetch data when answers change
          fetchData(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchData(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out", description: "See you next time!" });
    navigate("/");
  };

  const chartData = interviews.slice(0, 10).reverse().map((i, index) => ({
    name: `#${index + 1}`,
    score: Number(i.overall_score) || 0,
  }));


  const statCards = [
    { label: "Total Interviews", value: stats.totalInterviews, icon: Mic, color: "text-primary" },
    { label: "Average Score", value: `${stats.averageScore}%`, icon: TrendingUp, color: "text-green-500" },
    { label: "Best Skill", value: stats.bestSkill, icon: Target, color: "text-blue-400" },
    { label: "Needs Work", value: stats.weakSkill, icon: AlertCircle, color: "text-amber-400" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-lg bg-gradient-warm flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-semibold">PrepAI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">
            Welcome back, <span className="text-gradient">{userName}</span>
          </h1>
          <p className="text-muted-foreground">
            Track your progress and continue improving your interview skills.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <Card 
              key={stat.label} 
              className="bg-card/80 border-border hover:border-primary/30 transition-all"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold mb-1">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-card/80 border-border">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Performance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Complete your first interview to see trends
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/80 border-border">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Skill Comparison (You vs Platform)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {skillData.length > 0 && skillData.some(s => s.userScore > 0 || s.platformAvg > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={skillData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="skill" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => [
                        `${value}%`,
                        name === "userScore" ? "Your Score" : "Platform Avg"
                      ]}
                    />
                    <Bar
                      dataKey="userScore"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name="userScore"
                    />
                    <Bar
                      dataKey="platformAvg"
                      fill="hsl(var(--muted-foreground))"
                      radius={[4, 4, 0, 0]}
                      name="platformAvg"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Complete interviews to see your skill comparison
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            size="lg"
            variant="warm"
            className="group flex-1"
            onClick={() => navigate("/interview")}
          >
            <PlayCircle className="w-5 h-5 mr-2" />
            Start New Interview
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/profile")}
          >
            <User className="w-5 h-5 mr-2" />
            View Profile
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
