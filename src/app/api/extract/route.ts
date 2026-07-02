import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractFromTranscriptLocal } from "@/lib/localExtractor";

export async function POST(request: NextRequest) {
  let transcript = "";
  let teamMembers = [];
  let currentUser = null;

  try {
    const body = await request.json();
    transcript = body.transcript || "";
    teamMembers = body.teamMembers || [];
    currentUser = body.currentUser || null;

    if (!transcript || typeof transcript !== "string") {
      return Response.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      // Graceful fallback to local extraction
      console.log("No GEMINI_API_KEY found, falling back to local rule-based extractor");
      const localResult = extractFromTranscriptLocal(transcript, teamMembers, currentUser);
      return Response.json(localResult);
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const prompt = `
You are an AI task extraction and project management assistant.
Your purpose is to convert voice transcripts, meeting conversations, and natural language commands into structured project data.

Available Team Members:
${JSON.stringify(teamMembers, null, 2)}

Current User:
${JSON.stringify(currentUser, null, 2)}

Current Local Time (reference for relative dates):
${new Date().toISOString()}

Voice Command / Transcript Input:
"${transcript}"

Task Extraction Rules:
Create a task when someone:
- agrees to do something
- is assigned work
- volunteers for work
- requests follow-up
- commits to a deadline
- asks someone else to complete something

Extract assigneeId and assigneeName matching from the list of available team members. If no owner is explicitly mentioned, assign the task to the speaker (current user).
Convert relative dates (today, tomorrow, next Monday, etc.) into structured text values (e.g. "tomorrow"). If no date exists, set dueDate to null.
Detect finalized decisions separately from tasks (e.g. "We'll launch on Friday", "Homepage design version B is approved").
Detect blockers separately from tasks (anything preventing progress, e.g. "Waiting for client approval", "Need API credentials").
Infer priority: "high" (urgent, critical, ASAP, immediately), "low" (whenever possible, later, backlog), or "medium" (normal work).
Auto-detect tags (e.g. dashboard -> ui, api -> backend, deployment -> devops, invoice -> finance, marketing campaign -> marketing).

You MUST return a JSON object with this exact schema (no markdown, no explanations, only raw JSON):
{
  "tasks": [
    {
      "title": "Clean, action-oriented task title (e.g., 'Finish login API')",
      "description": "Short explanation or context from transcript",
      "assigneeId": "ID of assignee matching team members list (e.g., 'u2')",
      "assigneeName": "Name of assignee matching team members list (e.g., 'Rahul')",
      "priority": "low|medium|high",
      "dueDate": "tomorrow|Friday|etc. or null",
      "tags": ["tag1", "tag2"]
    }
  ],
  "decisions": [
    {
      "title": "Decided topic/outcome",
      "details": "Details about the decision"
    }
  ],
  "blockers": [
    {
      "title": "Blocker description",
      "details": "Details about what is blocking"
    }
  ],
  "summary": "A 1-sentence summary of the transcript"
}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
    // Clean up markdown formatting if the model didn't obey the MIME type config
    if (text.startsWith("```json")) {
      text = text.substring(7);
    }
    if (text.startsWith("```")) {
      text = text.substring(3);
    }
    if (text.endsWith("```")) {
      text = text.substring(0, text.length - 3);
    }
    text = text.trim();

    try {
      const parsedData = JSON.parse(text);
      return Response.json(parsedData);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON response, falling back to local extractor. Response was:", text);
      const localResult = extractFromTranscriptLocal(transcript, teamMembers, currentUser);
      return Response.json(localResult);
    }
  } catch (error) {
    console.error("Gemini API error, falling back to local extractor:", error);
    try {
      const localResult = extractFromTranscriptLocal(transcript, teamMembers, currentUser);
      return Response.json(localResult);
    } catch (fallbackError) {
      return Response.json({ error: "Failed to process request" }, { status: 500 });
    }
  }
}
