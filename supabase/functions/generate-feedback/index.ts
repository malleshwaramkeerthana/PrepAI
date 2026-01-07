import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { interviewId, questions, role, scorePenalty = 0, tabSwitchCount = 0, deviceWarningCount = 0 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log(`Processing interview ${interviewId} with ${scorePenalty}% penalty from ${tabSwitchCount} tab switches and ${deviceWarningCount} device warnings`);

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const answersToEvaluate = questions.map((q: { text: string; answer?: string }) => ({
      question: q.text,
      answer: q.answer || "",
    }));

    // Generate feedback for each answer using AI
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
            content: `You are an expert interview coach evaluating answers for a ${role.replace(/-/g, " ")} position. 
For each answer, provide scores (0-100) for:
- relevance: How well does the answer address the question?
- clarity: How clear and well-structured is the response?
- grammar: Quality of language and grammar used
- confidence: How confident and assertive does the answer sound?

Also provide a brief, constructive feedback tip (max 30 words).

Return ONLY a JSON array with objects containing: relevance, clarity, grammar, confidence, feedback.`,
          },
          {
            role: "user",
            content: JSON.stringify(answersToEvaluate),
          },
        ],
        temperature: 0.3,
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

    let evaluations: Array<{
      relevance: number;
      clarity: number;
      grammar: number;
      confidence: number;
      feedback: string;
    }>;

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        evaluations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      // Fallback evaluations
      evaluations = answersToEvaluate.map(() => ({
        relevance: 70,
        clarity: 70,
        grammar: 75,
        confidence: 65,
        feedback: "Good attempt! Consider providing more specific examples.",
      }));
    }

    // Ensure we have evaluations for all answers
    while (evaluations.length < answersToEvaluate.length) {
      evaluations.push({
        relevance: 70,
        clarity: 70,
        grammar: 75,
        confidence: 65,
        feedback: "Consider elaborating more on your response.",
      });
    }

    // Insert answers into database
    const answersToInsert = answersToEvaluate.map((qa: { question: string; answer: string }, index: number) => ({
      interview_id: interviewId,
      question: qa.question,
      answer: qa.answer,
      relevance_score: Math.min(100, Math.max(0, evaluations[index]?.relevance || 70)),
      clarity_score: Math.min(100, Math.max(0, evaluations[index]?.clarity || 70)),
      grammar_score: Math.min(100, Math.max(0, evaluations[index]?.grammar || 75)),
      confidence_score: Math.min(100, Math.max(0, evaluations[index]?.confidence || 65)),
      feedback: evaluations[index]?.feedback || "Good effort!",
    }));

    const { error: insertError } = await supabase.from("answers").insert(answersToInsert);

    if (insertError) {
      console.error("Error inserting answers:", insertError);
      throw insertError;
    }

    // Calculate overall score with penalty applied
    let overallScore =
      evaluations.reduce((acc, e) => {
        return acc + (e.relevance + e.clarity + e.grammar + e.confidence) / 4;
      }, 0) / evaluations.length;

    // Apply tab-switch penalty
    if (scorePenalty > 0) {
      overallScore = Math.max(0, overallScore - scorePenalty);
      console.log(`Applied ${scorePenalty}% penalty. Final score: ${overallScore}`);
    }

    // Update interview with overall score
    const { error: updateError } = await supabase
      .from("interviews")
      .update({
        overall_score: Math.round(overallScore * 10) / 10,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", interviewId);

    if (updateError) {
      console.error("Error updating interview:", updateError);
      throw updateError;
    }

    console.log("Feedback generated successfully for interview:", interviewId);

    return new Response(
      JSON.stringify({ success: true, overallScore: Math.round(overallScore) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating feedback:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
