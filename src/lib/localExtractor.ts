export interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  createdBy: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
  dueDate: string | null;
  tags: string[];
  createdAt?: string;
}

export interface Decision {
  id: string;
  title: string;
  details: string;
  createdAt?: string;
}

export interface Blocker {
  id: string;
  title: string;
  details: string;
  createdAt?: string;
}

export interface ExtractionResult {
  tasks: Omit<Task, 'id' | 'status' | 'createdBy'>[];
  decisions: Omit<Decision, 'id'>[];
  blockers: Omit<Blocker, 'id'>[];
  summary: string;
}

export function extractFromTranscriptLocal(
  transcript: string,
  teamMembers: TeamMember[],
  currentUser: TeamMember
): ExtractionResult {
  const result: ExtractionResult = {
    tasks: [],
    decisions: [],
    blockers: [],
    summary: ""
  };

  if (!transcript.trim()) {
    return result;
  }

  // Generate summary
  const words = transcript.trim().split(/\s+/);
  result.summary = words.slice(0, 8).join(" ") + (words.length > 8 ? "..." : "");

  // Split transcript into sentences/clauses
  const clauses = transcript.split(/[.;]|\band\b|\bthen\b/i).map(s => s.trim()).filter(Boolean);

  for (const clause of clauses) {
    const lowerClause = clause.toLowerCase();

    // 1. Detect Blockers
    if (
      lowerClause.includes("waiting for") ||
      lowerClause.includes("need api credentials") ||
      lowerClause.includes("stuck on") ||
      lowerClause.includes("blocker:") ||
      lowerClause.includes("blocked by") ||
      (lowerClause.includes("cannot") && lowerClause.includes("until"))
    ) {
      result.blockers.push({
        title: clause.replace(/^(blocker:|waiting for|blocked by|stuck on)/i, "").trim(),
        details: `Identified from: "${clause}"`
      });
      continue;
    }

    // 2. Detect Decisions
    if (
      lowerClause.includes("decided") ||
      lowerClause.includes("we'll launch") ||
      lowerClause.includes("approved") ||
      lowerClause.includes("finalized") ||
      lowerClause.includes("agreed to") ||
      lowerClause.includes("decision:")
    ) {
      result.decisions.push({
        title: clause.replace(/^(decision:|we decided to|agreed to|we'll)/i, "").trim(),
        details: `Decided: "${clause}"`
      });
      continue;
    }

    // 3. Detect Tasks
    // Look for assignees
    let assignee: TeamMember | null = null;
    let textToParse = clause;

    // Check if any team member name is mentioned
    for (const member of teamMembers) {
      const nameRegex = new RegExp(`\\b${member.name}\\b`, 'i');
      if (nameRegex.test(clause)) {
        assignee = member;
        // Clean the name out of the title optionally, or keep context
        break;
      }
    }

    // Common action verbs
    const actionVerbs = [
      "finish", "create", "review", "update", "write", "deploy", "build", "design", "fix", "setup",
      "add", "remove", "integrate", "send", "remind", "test", "check", "implement", "start", "make"
    ];

    let isTask = false;
    let title = "";

    // Check if clause starts with / contains action verbs or task patterns
    const verbRegex = new RegExp(`\\b(${actionVerbs.join('|')})\\b`, 'i');
    if (verbRegex.test(lowerClause) || lowerClause.includes("will") || lowerClause.includes("please") || assignee) {
      isTask = true;
      
      // Clean up title
      title = clause;
      
      // Strip helper words
      title = title.replace(/^(please|will|can you|could you|i will|let's|need to)\b/i, "").trim();
      
      // Strip assignee name if it starts with it
      if (assignee) {
        const cleanNameRegex = new RegExp(`^${assignee.name}\\b\\s*(will|please|to)?`, 'i');
        title = title.replace(cleanNameRegex, "").trim();
      }
    }

    if (isTask && title) {
      // Priority
      let priority: 'low' | 'medium' | 'high' = 'medium';
      if (lowerClause.includes("urgent") || lowerClause.includes("critical") || lowerClause.includes("asap") || lowerClause.includes("immediately")) {
        priority = 'high';
      } else if (lowerClause.includes("whenever possible") || lowerClause.includes("later") || lowerClause.includes("backlog")) {
        priority = 'low';
      }

      // Due date extraction
      let dueDate: string | null = null;
      const dateMatches = [
        { key: "today", pattern: /\btoday\b/i },
        { key: "tomorrow", pattern: /\btomorrow\b/i },
        { key: "next Monday", pattern: /\bnext monday\b/i },
        { key: "Friday", pattern: /\bfriday\b/i },
        { key: "end of week", pattern: /\bend of (the )?week\b/i },
        { key: "Monday", pattern: /\bmonday\b/i },
        { key: "Tuesday", pattern: /\btuesday\b/i },
        { key: "Wednesday", pattern: /\bwednesday\b/i },
        { key: "Thursday", pattern: /\bthursday\b/i },
        { key: "Saturday", pattern: /\bsaturday\b/i },
        { key: "Sunday", pattern: /\bsunday\b/i }
      ];

      for (const item of dateMatches) {
        if (item.pattern.test(lowerClause)) {
          dueDate = item.key;
          // Strip date from title
          title = title.replace(new RegExp(`\\bby ${item.key}\\b|\\bon ${item.key}\\b|\\b${item.key}\\b`, 'gi'), "").trim();
          break;
        }
      }

      // Tags auto-detection
      const tags: string[] = [];
      const tagMappings = [
        { tag: "ui", patterns: [/\bui\b/i, /\bdashboard\b/i, /\bpage\b/i, /\bhomepage\b/i, /\binterface\b/i, /\bdesign\b/i, /\bfrontend\b/i, /\bcss\b/i] },
        { tag: "backend", patterns: [/\bapi\b/i, /\bbackend\b/i, /\bdatabase\b/i, /\bdb\b/i, /\bserver\b/i, /\bauth\b/i, /\bsignup\b/i, /\blogin\b/i, /\bpayment\b/i] },
        { tag: "devops", patterns: [/\bdeployment\b/i, /\bdeploy\b/i, /\bdevops\b/i, /\baws\b/i, /\bvercel\b/i, /\bbuild\b/i, /\bci\/cd\b/i] },
        { tag: "finance", patterns: [/\binvoice\b/i, /\bfinance\b/i, /\bgst\b/i, /\bbilling\b/i, /\btax\b/i, /\bpayment integration\b/i] },
        { tag: "marketing", patterns: [/\bmarketing\b/i, /\bcampaign\b/i, /\bemail\b/i, /\bnewsletter\b/i, /\bsocial\b/i, /\bad\b/i] }
      ];

      for (const mapping of tagMappings) {
        for (const pattern of mapping.patterns) {
          if (pattern.test(lowerClause)) {
            tags.push(mapping.tag);
            break; // Move to next mapping
          }
        }
      }

      // Final cleanups on title (remove trailing prepositions/punctuation)
      title = title.replace(/^(by|on|for|to)\b/i, "").trim();
      title = title.replace(/^[,\-\s]+|[,\-\s]+$/g, "").trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);

      if (title.length > 3) {
        result.tasks.push({
          title,
          description: `Extracted from voice transcript: "${clause.trim()}"`,
          assigneeId: assignee ? assignee.id : currentUser.id,
          assigneeName: assignee ? assignee.name : currentUser.name,
          priority,
          dueDate,
          tags
        });
      }
    }
  }

  // If we couldn't parse anything but the transcript is not empty, create a generic task assigned to the current user
  if (result.tasks.length === 0 && result.decisions.length === 0 && result.blockers.length === 0 && transcript.length > 5) {
    result.tasks.push({
      title: transcript.length > 50 ? transcript.slice(0, 50) + "..." : transcript,
      description: `Draft task from transcript: "${transcript}"`,
      assigneeId: currentUser.id,
      assigneeName: currentUser.name,
      priority: 'medium',
      dueDate: null,
      tags: []
    });
  }

  return result;
}
