import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractFromTranscriptLocal } from "@/lib/localExtractor";

export async function POST(request: NextRequest) {
  let transcript = "";
  let teamMembers = [];
  let currentUser = null;
  let pendingSuggestions = null;

  try {
    const body = await request.json();
    transcript = body.transcript || "";
    teamMembers = body.teamMembers || [];
    currentUser = body.currentUser || null;
    pendingSuggestions = body.pendingSuggestions || null;

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
      const localResult = extractFromTranscriptLocal(transcript, teamMembers, currentUser, pendingSuggestions);
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

    let conversationContextPrompt = "";
    if (pendingSuggestions && (pendingSuggestions.tasks?.length > 0 || pendingSuggestions.decisions?.length > 0 || pendingSuggestions.blockers?.length > 0)) {
      conversationContextPrompt = `
CONVERSATIONAL WORKFLOW CONTEXT:
The user previously entered a command, and we generated the following draft suggestions (which are NOT committed to the database yet):
${JSON.stringify(pendingSuggestions, null, 2)}

In the previous step, we asked the user this clarification question:
"${pendingSuggestions.clarification || "N/A"}"

INSTRUCTIONS FOR THIS RESPONSE:
1. Determine if the user's new input ("${transcript}") is answering the clarification question or refining/correcting the previous draft suggestions.
2. If it IS updating/answering:
   - Merge the updates into the previous suggestions. For example, if they specify an assignee name (like 'Rahul' or '@Rahul') or a deadline (like 'tomorrow'), update those fields in the existing tasks list.
   - Do NOT create duplicate tasks. Return the updated tasks list.
   - Clear the clarification field (set it to null) once all necessary information is obtained.
3. If the user's new reply is NOT updating the previous draft (e.g. they typed/said a completely unrelated command or requested a new task):
   - Discard the previous suggestions.
   - Extract new tasks, decisions, or blockers solely from the new transcript "${transcript}".
`;
    }

    const prompt = `
You are an AI task extraction and project management assistant.
Your purpose is to convert voice transcripts, meeting conversations, and natural language commands into structured project data.
${conversationContextPrompt}

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

Extract assigneeId and assigneeName matching from the list of available team members. Check for explicit @mentions (e.g., '@Rahul' or '@Sarah'). If a name is prefixed with '@', explicitly assign the task to that user and STRIP the '@name' token from the task title. If no owner is mentioned (either normally or with @), assign the task to the speaker (current user).
Convert relative dates (today, tomorrow, next Monday, etc.) into structured text values. Extract and preserve granular deadlines and times if mentioned (e.g., 'tomorrow evening', 'EOD', 'Friday at 12:30 pm', 'today by 5:00 pm', 'next Monday afternoon'). If no date exists, set dueDate to null. Strip these deadline phrases from the task title.
Detect finalized decisions separately from tasks (e.g. "We'll launch on Friday", "Homepage design version B is approved").
Detect blockers separately from tasks (anything preventing progress, e.g. "Waiting for client approval", "Need API credentials").
Intelligently infer priority:
- "high": if the speaker states it's important, urgent, critical, critical path, vital, needed immediately, asap, or shows high emotion/emphasis about it.
- "low": if they mention there's no rush, it's low priority, backlog, later, whenever possible.
- "medium": normal/routine tasks.
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
  "summary": "A 1-sentence summary of the transcript",
  "clarification": "If any critical task metadata is missing (like who is assigned or when it's due), write a short conversational question (15 words max) to ask the speaker. Otherwise, return null."
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
      const localResult = extractFromTranscriptLocal(transcript, teamMembers, currentUser, pendingSuggestions);
      return Response.json(localResult);
    }
  } catch (error) {
    console.error("Gemini API error, falling back to local extractor:", error);
    try {
      const localResult = extractFromTranscriptLocal(transcript, teamMembers, currentUser, pendingSuggestions);
      return Response.json(localResult);
    } catch (fallbackError) {
      return Response.json({ error: "Failed to process request" }, { status: 500 });
    }
  }
}
