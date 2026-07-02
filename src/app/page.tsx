"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { 
  Mic, 
  MicOff, 
  Plus, 
  Trash2, 
  Check, 
  User, 
  Calendar, 
  AlertTriangle, 
  Database, 
  Sparkles, 
  Clock, 
  ChevronRight, 
  X, 
  UserPlus, 
  Terminal, 
  Cpu, 
  Monitor, 
  Smartphone, 
  PlusCircle
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Task, Decision, Blocker, TeamMember, ExtractionResult } from "@/lib/localExtractor"
import { 
  getTasks, 
  createTask, 
  updateTask, 
  deleteTask, 
  getDecisions, 
  createDecision, 
  deleteDecision, 
  getBlockers, 
  createBlocker, 
  deleteBlocker, 
  getTeamMembers, 
  addTeamMember, 
  getCurrentUser, 
  setCurrentUser,
  isFirebaseConnected
} from "@/lib/firebase"

const SpeechRecognition = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;



export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [blockers, setBlockers] = useState<Blocker[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [currentUser, setCurrentUserState] = useState<TeamMember | null>(null)
  
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isPendingAI, setIsPendingAI] = useState(false)
  const [viewMode, setViewMode] = useState<"mobile" | "desktop">("desktop")
  
  const [suggestions, setSuggestions] = useState<ExtractionResult | null>(null)
  const [mounted, setMounted] = useState(false)
  
  const recognitionRef = useRef<any>(null)
  const typingTimerRef = useRef<any>(null)
  
  const [newTeamMemberName, setNewTeamMemberName] = useState("")
  const [newTeamMemberAvatar, setNewTeamMemberAvatar] = useState("👨‍💻")

  const loadData = useCallback(async () => {
    try {
      const dbTeam = await getTeamMembers();
      const dbUser = await getCurrentUser();
      const dbTasks = await getTasks();
      const dbDecisions = await getDecisions();
      const dbBlockers = await getBlockers();
      
      setTeam(dbTeam);
      setCurrentUserState(dbUser);
      setTasks(dbTasks);
      setDecisions(dbDecisions);
      setBlockers(dbBlockers);
    } catch (e) {
      console.error("Failed to load initial data", e);
      toast.error("Failed to fetch database records");
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [loadData]);

  const performExtraction = useCallback(async (textToExtract: string) => {
    if (!textToExtract.trim()) {
      setSuggestions(null);
      return;
    }
    
    setIsPendingAI(true);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: textToExtract,
          teamMembers: team,
          currentUser: currentUser
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setSuggestions(result);
      } else {
        console.error("Extraction failed:", response.status);
      }
    } catch (e) {
      console.error("Extraction error:", e);
    } finally {
      setIsPendingAI(false);
    }
  }, [team, currentUser]);

  useEffect(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    
    if (transcript.trim()) {
      setIsPendingAI(true);
      typingTimerRef.current = setTimeout(() => {
        performExtraction(transcript);
      }, 1000);
    } else {
      setSuggestions(null);
      setIsPendingAI(false);
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, [transcript, performExtraction]);

  const startSpeechRecognition = () => {
    if (!SpeechRecognition) {
      toast.error("SpeechRecognition API not supported. Try simulator mode.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsRecording(true);
        setTranscript("");
        setSuggestions(null);
        toast.info("Recording transcript feed...");
      };

      rec.onresult = (event: any) => {
        let finalTrans = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript + " ";
          } else {
            finalTrans += event.results[i][0].transcript;
          }
        }
        if (finalTrans.trim()) {
          setTranscript(finalTrans);
        }
      };

      rec.onerror = (e: any) => {
        console.error(e);
        if (e.error !== "no-speech") {
          toast.error(`Mic error: ${e.error}`);
        }
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      toast.success("Recording finalized. Parsing tasks.");
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };



  const commitSuggestions = async () => {
    if (!suggestions) return;
    
    let addedTasks = 0;
    let addedDecisions = 0;
    let addedBlockers = 0;
    
    try {
      if (suggestions.tasks && suggestions.tasks.length > 0) {
        for (const t of suggestions.tasks) {
          await createTask({
            title: t.title,
            description: t.description || "",
            assigneeId: t.assigneeId,
            assigneeName: t.assigneeName,
            createdBy: currentUser?.name || "System",
            priority: t.priority || "medium",
            status: "todo",
            dueDate: t.dueDate,
            tags: t.tags || []
          });
          addedTasks++;
        }
      }
      
      if (suggestions.decisions && suggestions.decisions.length > 0) {
        for (const d of suggestions.decisions) {
          await createDecision({
            title: d.title,
            details: d.details || ""
          });
          addedDecisions++;
        }
      }

      if (suggestions.blockers && suggestions.blockers.length > 0) {
        for (const b of suggestions.blockers) {
          await createBlocker({
            title: b.title,
            details: b.details || ""
          });
          addedBlockers++;
        }
      }

      toast.success(`[STDOUT] COMMITTED: ${addedTasks} Tasks, ${addedDecisions} Decisions, ${addedBlockers} Blockers`);
      setTranscript("");
      setSuggestions(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to commit extracted logs");
    }
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "done" ? "todo" : "done";
    try {
      await updateTask(taskId, { status: nextStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
      toast.success(nextStatus === "done" ? "Task resolved successfully" : "Task reopened");
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeTaskAssignee = async (taskId: string, memberId: string) => {
    const member = team.find(m => m.id === memberId);
    if (!member) return;
    try {
      await updateTask(taskId, { assigneeId: memberId, assigneeName: member.name });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assigneeId: memberId, assigneeName: member.name } : t));
      toast.success(`Reassigned: ${member.name}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeTaskPriority = async (taskId: string, priority: 'low' | 'medium' | 'high') => {
    try {
      await updateTask(taskId, { priority });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority } : t));
      toast.success(`Priority set to: ${priority}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success("Record purged");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDecision = async (id: string) => {
    try {
      await deleteDecision(id);
      setDecisions(prev => prev.filter(d => d.id !== id));
      toast.success("Decision purged");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBlocker = async (id: string) => {
    try {
      await deleteBlocker(id);
      setBlockers(prev => prev.filter(b => b.id !== id));
      toast.success("Blocker resolved");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectSpeaker = async (member: TeamMember) => {
    try {
      await setCurrentUser(member);
      setCurrentUserState(member);
      toast.success(`Active speaker set: ${member.name}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTeamMember = async () => {
    if (!newTeamMemberName.trim()) return;
    try {
      const added = await addTeamMember({
        name: newTeamMemberName.trim(),
        avatar: newTeamMemberAvatar
      });
      setTeam(prev => [...prev, added]);
      setNewTeamMemberName("");
      toast.success(`Added user: ${added.name}`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 w-full min-h-screen flex flex-col items-center justify-start p-4 md:p-6 bg-[#030712] text-[#f3f4f6]">
      
      {/* Background ambient CRT scanlines / subtle grid look */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[20%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/* Main Command Header */}
      <header className="w-full max-w-6xl mb-6 py-4 border-b border-[#1f2937] flex flex-col md:flex-row items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded border border-[#06b6d4]/40 bg-[#0891b2]/10 flex items-center justify-center shadow-inner">
            <Terminal className="size-4.5 text-[#06b6d4]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-mono uppercase text-[#f3f4f6]">
                VAITSK // CORE-v1.0
              </h1>
              <span className="text-[9px] px-1.5 py-0.2 bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] font-semibold tracking-wider rounded uppercase">
                Stable
              </span>
            </div>
            <p className="text-[10px] text-[#9ca3af] font-mono">
              REAL-TIME VOICE TRANSCRIPTION & SEMANTIC EXTRACTION ENGINE
            </p>
          </div>
        </div>

        {/* Database state & full screen toggles */}
        <div className="flex flex-wrap items-center gap-3 font-mono">
          {mounted && (
            <div className={`px-2.5 py-1 rounded border text-[10px] flex items-center gap-1.5 ${
              isFirebaseConnected 
                ? "bg-[#10b981]/5 border-[#10b981]/30 text-[#10b981]" 
                : "bg-[#f59e0b]/5 border-[#f59e0b]/30 text-[#f59e0b]"
            }`}>
              <Database className="size-3" />
              <span>[DB: {isFirebaseConnected ? "FIRESTORE_ONLINE" : "LOCAL_SANDBOX"}]</span>
            </div>
          )}

          <div className="text-[10px] text-[#9ca3af] border border-[#1f2937] px-2 py-1 bg-[#0b0f19]">
            ACTIVE_SPEAKER: <span className="text-[#06b6d4] font-bold">{mounted && currentUser ? currentUser.name.toUpperCase() : "NONE"}</span>
          </div>
        </div>
      </header>

      {/* Main Terminal Workspace - Split Screen Layout */}
      <main className="w-full max-w-6xl flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 z-10 items-stretch">
        
        {/* LEFT COLUMN: Voice Input, Presets & Live Transcription Preview */}
        <div className="col-span-1 md:col-span-6 flex flex-col gap-6">
          
          <Card className="bg-[#0b0f19]/80 border-[#1f2937] rounded-none shadow-none font-mono flex-1 flex flex-col justify-between">
            <CardContent className="space-y-4 p-4 flex-1">
              
              {/* Live transcript buffer view with editor line numbers */}
              <div className="flex-1 flex flex-col min-h-[140px]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] text-[#4b5563]">// BUFFER_STREAM.log</span>
                  {isRecording && (
                    <span className="text-[9px] text-[#ef4444] animate-pulse">
                      [RECORDING LEVEL: ||||||||||||||..... 58dB]
                    </span>
                  )}
                </div>
                
                <div className="flex-1 flex gap-2.5 p-3 border border-[#1f2937] bg-[#030712] relative overflow-hidden">
                  <div className="text-[#374151] flex flex-col text-right pr-2 border-r border-[#1f2937] select-none text-[9px]">
                    <span>01</span>
                    <span>02</span>
                    <span>03</span>
                    <span>04</span>
                  </div>

                  <div className="flex-1 text-[#cbd5e1] text-xs font-mono leading-relaxed select-none overflow-y-auto max-h-[130px] scrollbar-none">
                    {transcript ? (
                      <span className="animate-fadeIn">{transcript}</span>
                    ) : (
                      <span className="text-[#4b5563] not-italic">
                        // awaiting voice signal input...
                        <br />
                        // trigger a shell preset above,
                        <br />
                        // or click the mic button below to record.
                      </span>
                    )}
                    {isRecording && (
                      <span className="inline-block w-1.5 h-3 bg-[#06b6d4] animate-pulse ml-1" />
                    )}
                  </div>
                </div>
              </div>

              {/* Textarea buffer editor for modifying transcript manually */}
              <div className="space-y-1">
                <span className="text-[9px] text-[#4b5563]">// EDIT_BUFFER_MANUALLY</span>
                <Textarea
                  placeholder="Type/Edit transcript manually to re-trigger live AI preview..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="min-h-[60px] bg-[#030712] border-[#1f2937] text-[#cbd5e1] text-[11px] resize-none focus:border-[#06b6d4]/50 rounded-none font-mono"
                />
              </div>

              {/* LIVE AI PREVIEW EXTRACTION LOGS */}
              <div className="border border-[#1f2937] bg-[#030712] p-3 flex flex-col gap-2 min-h-[160px]">
                <div className="flex items-center justify-between border-b border-[#1f2937] pb-1.5 text-[10px] font-bold text-[#06b6d4]">
                  <span>[+] SEMANTIC_EXTRACTOR_PREVIEW</span>
                  {isPendingAI && <span className="animate-pulse">[RUNNING...]</span>}
                </div>

                <div className="overflow-y-auto space-y-1.5 max-h-[150px] scrollbar-none text-[10px]">
                  {!suggestions || (suggestions.tasks.length === 0 && suggestions.decisions.length === 0 && suggestions.blockers.length === 0) ? (
                    <div className="py-6 text-center text-[#4b5563]">
                      // no temporary extractions compiled.
                    </div>
                  ) : (
                    <>
                      {suggestions.tasks.map((t, idx) => (
                        <div key={`live-task-${idx}`} className="p-1.5 border border-[#1f2937] bg-[#0b0f19] flex justify-between items-center">
                          <span className="text-[#cbd5e1] truncate flex-1 pr-2">
                            [TASK] "{t.title}" &rarr; {t.assigneeName.toLowerCase()}
                          </span>
                          <span className="text-[#6b7280] font-bold">[{t.priority}]</span>
                        </div>
                      ))}
                      {suggestions.decisions.map((d, idx) => (
                        <div key={`live-dec-${idx}`} className="p-1.5 border border-[#10b981]/20 bg-[#10b981]/5 text-[#10b981]">
                          [DECISION] "{d.title}"
                        </div>
                      ))}
                      {suggestions.blockers.map((b, idx) => (
                        <div key={`live-block-${idx}`} className="p-1.5 border border-[#ef4444]/20 bg-[#ef4444]/5 text-[#ef4444]">
                          [BLOCKER] "{b.title}"
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {suggestions && (suggestions.tasks.length > 0 || suggestions.decisions.length > 0 || suggestions.blockers.length > 0) && (
                  <Button
                    onClick={commitSuggestions}
                    className="w-full bg-[#06b6d4] hover:bg-[#0891b2] text-black font-bold h-7 text-[10px] rounded-none shadow-none uppercase"
                  >
                    [COMMIT SUGGESTIONS TO DB]
                  </Button>
                )}
              </div>

            </CardContent>

            <CardFooter className="py-3 border-t border-[#1f2937] bg-[#030712] flex items-center justify-between">
              
              {/* Record Mic toggle inside the card */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleRecording}
                  className={`size-10 border flex items-center justify-center transition-all ${
                    isRecording 
                      ? "bg-[#ef4444] border-[#ef4444] text-black hover:bg-[#f87171]" 
                      : "bg-[#030712] border-[#06b6d4]/40 text-[#06b6d4] hover:bg-[#06b6d4]/10"
                  }`}
                >
                  {isRecording ? <MicOff className="size-4 text-white" /> : <Mic className="size-4" />}
                </button>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#e2e8f0]">
                    {isRecording ? "MIC_ACTIVE" : "CAPTURE_MIC"}
                  </span>
                  <span className="text-[8px] text-[#6b7280]">
                    {isRecording ? "Streaming audio feed..." : "Click to stream voice"}
                  </span>
                </div>
              </div>

              <span className="text-[9px] text-[#6b7280] font-mono">
                [TTY: 3000/API]
              </span>
            </CardFooter>
          </Card>

        </div>

        {/* RIGHT COLUMN: Active workspace board grouped by team member name */}
        <div className="col-span-1 md:col-span-6 flex flex-col gap-6">
          
          <Card className="bg-[#0b0f19]/80 border-[#1f2937] rounded-none shadow-none font-mono flex-1 flex flex-col">
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-5 max-h-[680px] scrollbar-thin scrollbar-thumb-slate-800">
              <Tabs defaultValue="tasks" className="w-full">
                
                {/* Board navigation tabs */}
                <TabsList className="flex bg-[#030712] border border-[#1f2937] p-0.5 rounded-none h-8 mb-4">
                  <TabsTrigger value="tasks" className="text-[9px] rounded-none flex-1 data-[state=active]:bg-[#1f2937] data-[state=active]:text-[#06b6d4]">
                    [Tasks By Assignee]
                  </TabsTrigger>
                  <TabsTrigger value="decisions" className="text-[9px] rounded-none flex-1 data-[state=active]:bg-[#1f2937] data-[state=active]:text-[#10b981]">
                    [Decisions Log]
                  </TabsTrigger>
                  <TabsTrigger value="blockers" className="text-[9px] rounded-none flex-1 data-[state=active]:bg-[#1f2937] data-[state=active]:text-[#ef4444]">
                    [Blockers Interrupts]
                  </TabsTrigger>
                  <TabsTrigger value="team" className="text-[9px] rounded-none flex-1 data-[state=active]:bg-[#1f2937] data-[state=active]:text-[#e2e8f0]">
                    [Roster]
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: GROUPED TASKS BY NAME */}
                <TabsContent value="tasks" className="mt-0 space-y-4">
                  
                  {team.map((member) => {
                    const memberTasks = tasks.filter(t => t.assigneeId === member.id);
                    return (
                      <div key={member.id} className="border border-[#1f2937] bg-[#030712]/40">
                        
                        {/* Section Header for member */}
                        <div className="px-3 py-2 border-b border-[#1f2937] bg-[#0d1527]/20 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{member.avatar}</span>
                            <span className="text-xs font-bold text-[#e2e8f0] uppercase">
                              // USER: {member.name.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[9px] text-[#6b7280]">
                            {memberTasks.length} active tasks
                          </span>
                        </div>

                        {/* Member tasks list */}
                        <div className="p-2 space-y-2">
                          {memberTasks.length === 0 ? (
                            <div className="p-3 text-center text-[#4b5563] text-[10px] italic">
                              // No active task logs assigned.
                            </div>
                          ) : (
                            memberTasks.map((task) => (
                              <div 
                                key={task.id} 
                                className={`p-2.5 border border-[#1f2937] bg-[#030712] flex items-start justify-between gap-2.5 transition-all ${
                                  task.status === "done" ? "opacity-45" : "hover:border-[#374151]"
                                }`}
                              >
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <button
                                    onClick={() => handleToggleTaskStatus(task.id, task.status)}
                                    className={`mt-0.5 size-3.5 border flex items-center justify-center shrink-0 ${
                                      task.status === "done"
                                        ? "bg-[#06b6d4] border-[#06b6d4] text-black"
                                        : "border-[#4b5563] text-transparent hover:border-[#9ca3af]"
                                    }`}
                                  >
                                    <Check className="size-3" />
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    <h5 className={`text-[11px] font-bold text-[#cbd5e1] truncate ${
                                      task.status === "done" ? "line-through text-[#4b5563]" : ""
                                    }`}>
                                      {task.title}
                                    </h5>
                                    
                                    {/* Task settings indicators */}
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[8px] text-[#6b7280]">
                                      {task.dueDate && (
                                        <span className="text-[#10b981] font-semibold">
                                          [due:{task.dueDate.toLowerCase()}]
                                        </span>
                                      )}
                                      <span className={
                                        task.priority === 'high' ? "text-[#ef4444]" : "text-[#06b6d4]"
                                      }>
                                        [{task.priority}]
                                      </span>
                                      {task.tags.map(tag => (
                                        <span key={tag} className="text-[#818cf8]">#{tag}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Quick inline config toggles */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <select 
                                    value={task.assigneeId} 
                                    onChange={(e) => handleChangeTaskAssignee(task.id, e.target.value)}
                                    className="bg-[#030712] border border-[#1f2937] text-[#cbd5e1] text-[9px] p-0.5 focus:outline-none"
                                  >
                                    {team.map(m => (
                                      <option key={m.id} value={m.id}>{m.name.toLowerCase()}</option>
                                    ))}
                                  </select>
                                  
                                  <button 
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="text-[#4b5563] hover:text-[#ef4444] p-0.5 transition-colors"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>

                              </div>
                            ))
                          )}
                        </div>

                      </div>
                    )
                  })}

                </TabsContent>

                {/* TAB 2: DECISIONS LOG */}
                <TabsContent value="decisions" className="mt-0 space-y-2">
                  <div className="text-[10px] text-[#6b7280] mb-2">// LOG: SYSTEM_DECISIONS_STDOUT</div>
                  {decisions.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-[#1f2937] text-[10px] text-[#4b5563]">
                      No logged decisions recorded.
                    </div>
                  ) : (
                    decisions.map((dec) => (
                      <div key={dec.id} className="p-3 border border-[#1f2937] bg-[#030712] flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <span className="text-[9px] font-bold text-[#10b981] block mb-1">
                            [OK] FINALIZED_DECISION //
                          </span>
                          <h4 className="text-xs font-bold text-[#cbd5e1]">{dec.title}</h4>
                        </div>
                        <button 
                          onClick={() => handleDeleteDecision(dec.id)}
                          className="text-[#4b5563] hover:text-[#ef4444] p-0.5 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* TAB 3: BLOCKERS LOG */}
                <TabsContent value="blockers" className="mt-0 space-y-2">
                  <div className="text-[10px] text-[#6b7280] mb-2">// LOG: PROCESS_BLOCKERS_STDOUT</div>
                  {blockers.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-[#1f2937] text-[10px] text-[#4b5563]">
                      No active system blockers.
                    </div>
                  ) : (
                    blockers.map((block) => (
                      <div key={block.id} className="p-3 border border-[#ef4444]/30 bg-[#ef4444]/5 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <span className="text-[9px] font-bold text-[#ef4444] flex items-center gap-1 mb-1">
                            <AlertTriangle className="size-2.5" />
                            [WARN] EXECUTOR_BLOCKED //
                          </span>
                          <h4 className="text-xs font-bold text-[#cbd5e1]">{block.title}</h4>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteBlocker(block.id)}
                          className="h-6 text-[9px] text-[#10b981] hover:text-white hover:bg-[#10b981]/20 px-2 py-0 border border-[#10b981]/30 rounded-none font-mono"
                        >
                          [RESOLVE]
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* TAB 4: ROSTER MANAGEMENT */}
                <TabsContent value="team" className="mt-0 space-y-4">
                  
                  {/* Select Speaker */}
                  <div>
                    <label className="text-[10px] font-semibold text-[#cbd5e1] block mb-2">
                      SET_ACTIVE_SPEAKER (SYSTEM HOST):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {team.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => handleSelectSpeaker(member)}
                          className={`px-3 py-1.5 border text-xs flex items-center gap-1.5 transition-all ${
                            currentUser?.id === member.id
                              ? "bg-[#06b6d4]/10 border-[#06b6d4]/50 text-[#06b6d4] font-bold"
                              : "bg-[#030712] border-[#1f2937] text-[#9ca3af] hover:text-[#e2e8f0]"
                          }`}
                        >
                          <span>{member.avatar}</span>
                          <span>{member.name.toLowerCase()}</span>
                          {currentUser?.id === member.id && (
                            <span className="text-[8px] bg-[#06b6d4] text-black px-1 font-bold">
                              ACTIVE
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add user */}
                  <div className="pt-3 border-t border-[#1f2937]/50">
                    <label className="text-[10px] font-semibold text-[#cbd5e1] block mb-1.5">
                      CREATE_NEW_USER
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={newTeamMemberAvatar}
                        onChange={(e) => setNewTeamMemberAvatar(e.target.value)}
                        className="bg-[#030712] border border-[#1f2937] text-white text-xs px-2 focus:outline-none"
                      >
                        <option value="👨‍💻">👨‍💻</option>
                        <option value="👩‍💻">👩‍💻</option>
                        <option value="👨‍💼">👨‍💼</option>
                        <option value="👩‍💼">👩‍💼</option>
                        <option value="🤖">🤖</option>
                      </select>
                      <Input
                        placeholder="new_user_name"
                        value={newTeamMemberName}
                        onChange={(e) => setNewTeamMemberName(e.target.value)}
                        className="bg-[#030712] border-[#1f2937] text-xs h-9 focus:border-[#06b6d4]/50 rounded-none font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={handleCreateTeamMember}
                        className="bg-[#1f2937] hover:bg-[#374151] text-[#f3f4f6] text-xs h-9 shrink-0 rounded-none font-mono"
                      >
                        [ADD_MEMBER]
                      </Button>
                    </div>
                  </div>

                </TabsContent>

              </Tabs>
            </CardContent>
          </Card>

        </div>

      </main>

      {/* Info Guide Footer */}
      <footer className="w-full max-w-6xl mt-12 py-4 border-t border-[#1f2937] text-center text-[9px] text-[#4b5563] font-mono flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
        <p>SYSTEM HOST: LOCALHOST // SECURE SHELL INTERACTIVE CLIENT // 2026</p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-[#cbd5e1] transition-colors">[MAN_DOCS]</a>
          <a href="#" className="hover:text-[#cbd5e1] transition-colors">[LICENSES]</a>
          <a href="#" className="hover:text-[#cbd5e1] transition-colors">[HELP_SHELL]</a>
        </div>
      </footer>

    </div>
  );
}
