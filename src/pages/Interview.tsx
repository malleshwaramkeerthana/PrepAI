import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Mic, 
  MicOff, 
  Upload, 
  Loader2, 
  Send, 
  ChevronRight,
  Briefcase,
  Code,
  LineChart,
  Palette,
  FileText,
  Camera,
  CameraOff,
  AlertTriangle,
  Eye,
  Smartphone,
  ShieldAlert
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const roles = [
  { id: "software-engineer", name: "Software Engineer", icon: Code },
  { id: "product-manager", name: "Product Manager", icon: Briefcase },
  { id: "data-analyst", name: "Data Analyst", icon: LineChart },
  { id: "ux-designer", name: "UX Designer", icon: Palette },
];

interface Question {
  text: string;
  answer?: string;
}

const Interview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<"role" | "interview" | "submitting">("role");
  const [selectedRole, setSelectedRole] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [interviewId, setInterviewId] = useState("");
  const [userId, setUserId] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  
  // Camera and proctoring states
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [scorePenalty, setScorePenalty] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Device detection hook
  const {
    isModelLoaded,
    isDetecting,
    deviceWarningCount,
    showDeviceWarning,
    currentDeviceWarning,
    loadModel,
    startDetection,
    stopDetection,
    dismissWarning,
  } = useDeviceDetection(videoRef);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  // Tab visibility detection
  useEffect(() => {
    if (step !== "interview") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const newCount = prev + 1;
          // Apply 5% penalty per tab switch
          setScorePenalty(prevPenalty => prevPenalty + 5);
          toast({
            title: "⚠️ Tab Switch Detected!",
            description: `You switched tabs. 5% score penalty applied. Total switches: ${newCount}`,
            variant: "destructive",
          });
          setShowTabWarning(true);
          return newCount;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [step, toast]);

  // Load AI model on mount
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Apply penalty when device is detected
  useEffect(() => {
    if (deviceWarningCount > 0 && step === "interview") {
      setScorePenalty(prev => prev + 10); // 10% penalty per device detection
      toast({
        title: "📱 External Device Detected!",
        description: `Suspicious device detected. 10% score penalty applied.`,
        variant: "destructive",
      });
    }
  }, [deviceWarningCount, step, toast]);

  // Camera setup
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
        audio: false,
      });
      setCameraStream(stream);
      setCameraEnabled(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      toast({ title: "Camera enabled", description: "Your interview is now being proctored with AI device detection." });
      
      // Start device detection after camera starts
      setTimeout(() => {
        startDetection();
      }, 1000);
    } catch (error) {
      console.error("Camera error:", error);
      toast({
        title: "Camera access denied",
        description: "Please enable camera access for proctored interviews.",
        variant: "destructive",
      });
    }
  }, [toast, startDetection]);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraEnabled(false);
    stopDetection();
  }, [cameraStream, stopDetection]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Set video source when stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setResumeFile(file);
      toast({ title: "Resume selected", description: file.name });
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
    }
  };

  const uploadResume = async () => {
    if (!resumeFile || !userId) return null;
    
    const fileName = `${Date.now()}-${resumeFile.name}`;
    const { error } = await supabase.storage
      .from("resumes")
      .upload(`${userId}/${fileName}`, resumeFile);

    if (error) {
      console.error("Resume upload error:", error);
      return null;
    }
    
    // Return the file name for reference (we can't parse PDF content easily in frontend)
    return resumeFile.name;
  };

  const generateQuestions = async () => {
    setIsGenerating(true);
    
    try {
      // Upload resume if selected
      let resumeText = "";
      if (resumeFile) {
        const uploadedName = await uploadResume();
        if (uploadedName) {
          // Include resume filename as context hint
          resumeText = `Resume uploaded: ${uploadedName}`;
        }
      }

      // Create interview record
      const { data: interview, error: interviewError } = await supabase
        .from("interviews")
        .insert({
          user_id: userId,
          role: selectedRole,
          status: "in_progress",
        })
        .select()
        .single();

      if (interviewError) throw interviewError;
      setInterviewId(interview.id);

      // Generate questions via edge function with resume context
      const { data, error } = await supabase.functions.invoke("generate-questions", {
        body: { 
          role: selectedRole,
          resumeText: resumeText,
          previousQuestions: [], // Could store and pass previous questions for variety
        },
      });

      if (error) throw error;

      setQuestions(data.questions.map((q: string) => ({ text: q })));
      setStep("interview");
      
      // Auto-start camera for proctoring
      await startCamera();
    } catch (error: any) {
      console.error("Error generating questions:", error);
      toast({
        title: "Error",
        description: "Failed to generate questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const startRecording = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast({
        title: "Not supported",
        description: "Speech recognition is not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setCurrentAnswer(transcript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognitionRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleNext = async () => {
    // Save current answer
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestion].answer = currentAnswer;
    setQuestions(updatedQuestions);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setCurrentAnswer("");
    } else {
      // Submit interview
      await submitInterview(updatedQuestions);
    }
  };

  const submitInterview = async (finalQuestions: Question[]) => {
    setStep("submitting");
    stopCamera();

    try {
      // Call feedback edge function with penalty info
      const { data, error } = await supabase.functions.invoke("generate-feedback", {
        body: {
          interviewId,
          questions: finalQuestions,
          role: selectedRole,
          scorePenalty: scorePenalty,
          tabSwitchCount: tabSwitchCount,
          deviceWarningCount: deviceWarningCount,
        },
      });

      if (error) throw error;

      // Navigate to feedback page
      navigate(`/feedback/${interviewId}`);
    } catch (error: any) {
      console.error("Error submitting interview:", error);
      toast({
        title: "Error",
        description: "Failed to submit interview. Please try again.",
        variant: "destructive",
      });
      setStep("interview");
    }
  };

  const progress = questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Tab Switch Warning Dialog */}
      <AlertDialog open={showTabWarning} onOpenChange={setShowTabWarning}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Tab Switch Detected!
            </AlertDialogTitle>
            <AlertDialogDescription>
              You switched away from the interview tab. A 5% score penalty has been applied.
              <br /><br />
              <strong>Total tab switches:</strong> {tabSwitchCount}
              <br />
              <strong>Total penalty:</strong> {scorePenalty}%
              <br /><br />
              Please stay focused on the interview to avoid further penalties.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="warm" onClick={() => setShowTabWarning(false)}>
              I Understand, Continue
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Device Detection Warning Dialog */}
      <AlertDialog open={showDeviceWarning} onOpenChange={dismissWarning}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Smartphone className="w-5 h-5" />
              External Device Detected!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Our AI proctoring system detected: <strong className="text-foreground">{currentDeviceWarning}</strong>
              <br /><br />
              Using external devices during the interview is not allowed. A 10% score penalty has been applied.
              <br /><br />
              <strong>Total device warnings:</strong> {deviceWarningCount}
              <br />
              <strong>Total penalty:</strong> {scorePenalty}%
              <br /><br />
              Please remove all external devices from your camera view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="warm" onClick={dismissWarning}>
              I Understand, Continue
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => {
            stopCamera();
            navigate("/");
          }}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        {step === "role" && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="font-serif text-3xl font-bold mb-2">Start Interview</h1>
              <p className="text-muted-foreground">
                Select your target role and optionally upload your resume.
              </p>
            </div>

            <Card className="bg-card/80 border-border">
              <CardHeader>
                <CardTitle className="font-serif">Select Role</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`p-4 rounded-xl border transition-all text-left ${
                        selectedRole === role.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/50 hover:border-primary/50"
                      }`}
                    >
                      <role.icon className={`w-6 h-6 mb-2 ${
                        selectedRole === role.id ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <span className="font-medium">{role.name}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 border-border">
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Resume (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {resumeFile ? resumeFile.name : "Upload PDF Resume"}
                </Button>
              </CardContent>
            </Card>

            {/* Proctoring Notice */}
            <Card className="bg-amber-950/30 border-amber-700/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-200">AI-Proctored Interview</h4>
                    <p className="text-sm text-amber-300/80 mt-1">
                      This interview uses AI proctoring to ensure integrity:
                    </p>
                    <ul className="text-sm text-amber-300/80 mt-2 space-y-1 list-disc list-inside">
                      <li>Camera enabled with AI device detection</li>
                      <li>External devices (phones, books, laptops) = <strong>10% penalty</strong></li>
                      <li>Tab switching = <strong>5% penalty</strong> per switch</li>
                    </ul>
                    <div className="mt-3 flex items-center gap-2">
                      {isModelLoaded ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          AI Detection Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading AI Model...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              variant="warm"
              className="w-full"
              disabled={!selectedRole || isGenerating}
              onClick={generateQuestions}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Questions...
                </>
              ) : (
                <>
                  Start Interview
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {step === "interview" && questions.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            {/* Camera Feed & Progress */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Camera Section */}
              <div className="w-full md:w-auto">
                <Card className="bg-card/80 border-border overflow-hidden">
                  <CardContent className="p-2">
                    <div className="relative w-full md:w-48 aspect-video bg-muted rounded-lg overflow-hidden">
                      {cameraEnabled ? (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CameraOff className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 text-xs">
                        {cameraEnabled ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span>Recording</span>
                          </>
                        ) : (
                          <>
                            <CameraOff className="w-3 h-3" />
                            <span>Off</span>
                          </>
                        )}
                      </div>
                      {/* AI Detection Status */}
                      {cameraEnabled && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 text-xs">
                          {isDetecting ? (
                            <>
                              <ShieldAlert className="w-3 h-3 text-green-500" />
                              <span className="text-green-500">AI Active</span>
                            </>
                          ) : (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Loading...</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant={cameraEnabled ? "destructive" : "outline"}
                        onClick={cameraEnabled ? stopCamera : startCamera}
                        className="flex-1"
                      >
                        {cameraEnabled ? (
                          <>
                            <CameraOff className="w-3 h-3 mr-1" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Camera className="w-3 h-3 mr-1" />
                            Start
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress & Penalties */}
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Question {currentQuestion + 1} of {questions.length}
                    </span>
                    <span className="text-sm text-primary font-medium">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                
                {(tabSwitchCount > 0 || deviceWarningCount > 0) && (
                  <div className="flex flex-col gap-2">
                    {tabSwitchCount > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/20 border border-destructive/30">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">
                          Tab switches: {tabSwitchCount}
                        </span>
                      </div>
                    )}
                    {deviceWarningCount > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/20 border border-destructive/30">
                        <Smartphone className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">
                          Device detections: {deviceWarningCount}
                        </span>
                      </div>
                    )}
                    <div className="text-sm text-destructive font-semibold">
                      Total Penalty: -{scorePenalty}%
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Card className="bg-card/80 border-border">
              <CardContent className="p-8">
                <h2 className="font-serif text-xl md:text-2xl font-semibold mb-6">
                  {questions[currentQuestion].text}
                </h2>

                <Textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Type your answer or use the microphone..."
                  className="min-h-[150px] bg-input border-border resize-none mb-4"
                />

                <div className="flex items-center gap-4">
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    onClick={isRecording ? stopRecording : startRecording}
                    className="flex-shrink-0"
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="w-4 h-4 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 mr-2" />
                        Start Recording
                      </>
                    )}
                  </Button>

                  <Button
                    variant="warm"
                    className="flex-1"
                    onClick={handleNext}
                    disabled={!currentAnswer.trim()}
                  >
                    {currentQuestion < questions.length - 1 ? (
                      <>
                        Next Question
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Submit Interview
                        <Send className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "submitting" && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h2 className="font-serif text-2xl font-bold mb-2">Analyzing Your Interview</h2>
            <p className="text-muted-foreground text-center">
              Our AI is reviewing your responses and generating personalized feedback...
            </p>
            {scorePenalty > 0 && (
              <p className="text-sm text-destructive mt-4">
                Note: {scorePenalty}% penalty will be applied due to {tabSwitchCount} tab switch(es).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Interview;
