import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Target, 
  BookOpen,
  PlayCircle,
  LayoutDashboard,
  Trophy,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Answer {
  question: string;
  answer: string;
  relevance_score: number;
  clarity_score: number;
  grammar_score: number;
  confidence_score: number;
  feedback: string;
}

interface InterviewData {
  role: string;
  overall_score: number;
  answers: Answer[];
  coaching?: {
    strengths: string[];
    weaknesses: string[];
    focusAreas: string[];
    recommendations: string[];
  };
}

const Feedback = () => {
  const navigate = useNavigate();
  const { interviewId } = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);

  useEffect(() => {
    const fetchFeedback = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      try {
        // Fetch interview
        const { data: interview, error: interviewError } = await supabase
          .from("interviews")
          .select("*")
          .eq("id", interviewId)
          .single();

        if (interviewError) throw interviewError;

        // Fetch answers
        const { data: answers, error: answersError } = await supabase
          .from("answers")
          .select("*")
          .eq("interview_id", interviewId)
          .order("created_at", { ascending: true });

        if (answersError) throw answersError;

        // Generate coaching summary if not cached
        const { data: coachingData } = await supabase.functions.invoke("generate-coaching", {
          body: { 
            answers,
            role: interview.role,
            overallScore: interview.overall_score 
          },
        });

        setInterviewData({
          role: interview.role,
          overall_score: Number(interview.overall_score),
          answers: answers.map(a => ({
            question: a.question,
            answer: a.answer || "",
            relevance_score: Number(a.relevance_score),
            clarity_score: Number(a.clarity_score),
            grammar_score: Number(a.grammar_score),
            confidence_score: Number(a.confidence_score),
            feedback: a.feedback || "",
          })),
          coaching: coachingData?.coaching,
        });
      } catch (error: any) {
        console.error("Error fetching feedback:", error);
        toast({
          title: "Error",
          description: "Failed to load feedback.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [interviewId, navigate, toast]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading feedback...</div>
      </div>
    );
  }

  if (!interviewData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Interview not found</p>
          <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const roleName = interviewData.role.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <div className="text-center">
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">
              Interview Feedback
            </h1>
            <p className="text-muted-foreground">
              {roleName} Interview
            </p>
          </div>

          {/* Overall Score */}
          <Card className="bg-gradient-card border-border overflow-hidden">
            <CardContent className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-4">
                <Trophy className={`w-12 h-12 ${getScoreColor(interviewData.overall_score)}`} />
              </div>
              <div className={`text-5xl font-bold mb-2 ${getScoreColor(interviewData.overall_score)}`}>
                {interviewData.overall_score}%
              </div>
              <div className="text-lg text-muted-foreground">
                {getScoreLabel(interviewData.overall_score)}
              </div>
            </CardContent>
          </Card>

          {/* Coaching Summary */}
          {interviewData.coaching && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-card/80 border-border">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="w-5 h-5" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {interviewData.coaching.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-border">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2 text-amber-400">
                    <AlertCircle className="w-5 h-5" />
                    Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {interviewData.coaching.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Target className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Per-Question Feedback */}
          <Card className="bg-card/80 border-border">
            <CardHeader>
              <CardTitle className="font-serif">Question-by-Question Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {interviewData.answers.map((answer, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium mb-2">Q{index + 1}: {answer.question}</h4>
                  <p className="text-sm text-muted-foreground mb-4 italic">
                    "{answer.answer}"
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {[
                      { label: "Relevance", score: answer.relevance_score },
                      { label: "Clarity", score: answer.clarity_score },
                      { label: "Grammar", score: answer.grammar_score },
                      { label: "Confidence", score: answer.confidence_score },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{metric.label}</span>
                          <span className={getScoreColor(metric.score)}>{metric.score}%</span>
                        </div>
                        <Progress value={metric.score} className="h-1.5" />
                      </div>
                    ))}
                  </div>

                  {answer.feedback && (
                    <p className="text-sm text-muted-foreground">
                      💡 {answer.feedback}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {interviewData.coaching?.recommendations && (
            <Card className="bg-card/80 border-border">
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Recommended Learning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {interviewData.coaching.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <BookOpen className="w-4 h-4 text-primary mt-0.5" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              variant="warm"
              className="flex-1"
              onClick={() => navigate("/interview")}
            >
              <PlayCircle className="w-5 h-5 mr-2" />
              Start New Interview
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/dashboard")}
            >
              <LayoutDashboard className="w-5 h-5 mr-2" />
              View Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feedback;
