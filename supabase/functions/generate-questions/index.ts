import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { role, resumeText, previousQuestions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const rolePrompts: Record<string, string> = {
      "software-engineer": "software engineering, coding, system design, algorithms, debugging, and technical problem-solving",
      "product-manager": "product management, roadmap planning, stakeholder communication, metrics-driven decisions, and product strategy",
      "data-analyst": "data analysis, SQL, Python, data visualization, statistical analysis, and deriving actionable insights from data",
      "ux-designer": "UX design, user research, wireframing, prototyping, usability testing, and creating intuitive user experiences",
    };

    const roleContext = rolePrompts[role] || "general professional skills and competencies";

    // Create a unique seed for randomness based on timestamp
    const randomSeed = Date.now() % 10000;
    const questionVariants = ["behavioral", "technical", "situational", "problem-solving", "experience-based"];
    const selectedVariants = questionVariants.sort(() => Math.random() - 0.5).slice(0, 3).join(", ");

    // Build resume context if provided
    let resumeContext = "";
    if (resumeText && resumeText.trim()) {
      resumeContext = `\n\nCandidate's Resume/Skills:\n${resumeText}\n\nTailor questions to specifically test skills mentioned in the resume.`;
    }

    // Build exclusion context if previous questions provided
    let exclusionContext = "";
    if (previousQuestions && previousQuestions.length > 0) {
      exclusionContext = `\n\nIMPORTANT: Do NOT repeat or ask similar questions to these previously asked ones:\n${previousQuestions.join("\n")}\n\nGenerate completely different questions.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer for ${roleContext}. Generate exactly 5 UNIQUE interview questions. 

REQUIREMENTS:
- Maximum 20 words per question
- Conversational and friendly tone
- Focus on: ${selectedVariants} questions
- Progressively more challenging
- Each question MUST be completely different from others
- Random seed for variety: ${randomSeed}${resumeContext}${exclusionContext}

Return ONLY a JSON array of strings with exactly 5 questions. No other text or explanation.`,
          },
          {
            role: "user",
            content: `Generate 5 unique, fresh interview questions for a ${role.replace(/-/g, " ")} position. Make them different from typical questions. Timestamp: ${Date.now()}`,
          },
        ],
        temperature: 0.95,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON array from the response
    let questions: string[];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: split by newlines and clean up
        questions = content
          .split("\n")
          .filter((line: string) => line.trim().length > 10)
          .slice(0, 5)
          .map((q: string) => q.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").trim());
      }
    } catch {
      // Ultimate fallback questions with variety
      const fallbackSets = [
        [
          "What drew you to this career path?",
          "Describe your approach to solving complex problems.",
          "How do you prioritize competing deadlines?",
          "Tell me about a time you led a team.",
          "What's your biggest professional achievement?",
        ],
        [
          "What excites you most about this role?",
          "How do you handle constructive criticism?",
          "Describe a project that challenged you.",
          "How do you stay updated with industry trends?",
          "What would you change about your last project?",
        ],
        [
          "Why are you passionate about this field?",
          "How do you approach learning new skills?",
          "Tell me about a failure and what you learned.",
          "How do you collaborate with remote teams?",
          "What metrics do you use to measure success?",
        ],
      ];
      questions = fallbackSets[randomSeed % 3];
    }

    // Ensure we have exactly 5 questions
    while (questions.length < 5) {
      questions.push("What unique perspective would you bring to our team?");
    }
    questions = questions.slice(0, 5);

    console.log("Generated questions:", questions);

    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating questions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
