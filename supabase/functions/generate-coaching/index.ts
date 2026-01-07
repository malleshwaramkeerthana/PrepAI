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
    const { answers, role, overallScore } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Prepare summary of performance
    const avgScores = {
      relevance: answers.reduce((acc: number, a: any) => acc + Number(a.relevance_score || 0), 0) / answers.length,
      clarity: answers.reduce((acc: number, a: any) => acc + Number(a.clarity_score || 0), 0) / answers.length,
      grammar: answers.reduce((acc: number, a: any) => acc + Number(a.grammar_score || 0), 0) / answers.length,
      confidence: answers.reduce((acc: number, a: any) => acc + Number(a.confidence_score || 0), 0) / answers.length,
    };

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
            content: `You are an expert career coach providing actionable interview feedback. Based on the candidate's performance in a ${role.replace(/-/g, " ")} interview, provide coaching insights.

Return ONLY a JSON object with:
- strengths: array of 2-3 specific things they did well
- weaknesses: array of 2-3 areas to improve
- focusAreas: array of 2 key focus areas for next interview
- recommendations: array of 3 specific courses or resources to study

Keep each item concise (max 15 words). Be encouraging but honest.`,
          },
          {
            role: "user",
            content: `Interview performance:
- Overall score: ${overallScore}%
- Relevance: ${Math.round(avgScores.relevance)}%
- Clarity: ${Math.round(avgScores.clarity)}%
- Grammar: ${Math.round(avgScores.grammar)}%
- Confidence: ${Math.round(avgScores.confidence)}%

Questions and answers:
${answers.map((a: any, i: number) => `Q${i + 1}: ${a.question}\nA: ${a.answer}`).join("\n\n")}`,
          },
        ],
        temperature: 0.5,
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

    let coaching: {
      strengths: string[];
      weaknesses: string[];
      focusAreas: string[];
      recommendations: string[];
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        coaching = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      // Fallback coaching
      coaching = {
        strengths: [
          "Good communication of ideas",
          "Structured approach to answering",
        ],
        weaknesses: [
          "Could provide more specific examples",
          "Consider elaborating on technical details",
        ],
        focusAreas: [
          "Practice with real scenarios",
          "Improve confidence in delivery",
        ],
        recommendations: [
          "Take a course on effective communication",
          "Practice mock interviews with peers",
          "Study common behavioral question patterns",
        ],
      };
    }

    console.log("Coaching generated successfully");

    return new Response(
      JSON.stringify({ coaching }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating coaching:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
