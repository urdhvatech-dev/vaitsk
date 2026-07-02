import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  setDoc
} from "firebase/firestore";
import { Task, Decision, Blocker, TeamMember } from "./localExtractor";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if we have a valid configuration (checking at least apiKey and projectId)
const hasFirebaseConfig = 
  typeof window !== 'undefined' && 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId;

let app;
let db: any = null;
let isFirebaseConnected = false;

if (hasFirebaseConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    isFirebaseConnected = true;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

// Default initial data for team members and current user
export const DEFAULT_TEAM: TeamMember[] = [
  { id: "u1", name: "Ankith", avatar: "👨‍💻" },
  { id: "u2", name: "Rahul", avatar: "👨‍" },
  { id: "u3", name: "Sarah", avatar: "👩‍💻" },
];

export const DEFAULT_CURRENT_USER: TeamMember = {
  id: "u1",
  name: "Ankith",
  avatar: "👨‍💻"
};

// --- MOCK DATABASE (LOCAL STORAGE FALLBACK) ---
const MOCK_DB = {
  getTasks: (): Task[] => {
    if (typeof window === 'undefined') return [];
    const tasks = localStorage.getItem("vaitsk_tasks");
    return tasks ? JSON.parse(tasks) : [];
  },
  saveTasks: (tasks: Task[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("vaitsk_tasks", JSON.stringify(tasks));
  },
  getDecisions: (): Decision[] => {
    if (typeof window === 'undefined') return [];
    const decisions = localStorage.getItem("vaitsk_decisions");
    return decisions ? JSON.parse(decisions) : [];
  },
  saveDecisions: (decisions: Decision[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("vaitsk_decisions", JSON.stringify(decisions));
  },
  getBlockers: (): Blocker[] => {
    if (typeof window === 'undefined') return [];
    const blockers = localStorage.getItem("vaitsk_blockers");
    return blockers ? JSON.parse(blockers) : [];
  },
  saveBlockers: (blockers: Blocker[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("vaitsk_blockers", JSON.stringify(blockers));
  },
  getTeam: (): TeamMember[] => {
    if (typeof window === 'undefined') return DEFAULT_TEAM;
    const team = localStorage.getItem("vaitsk_team");
    if (!team) {
      localStorage.setItem("vaitsk_team", JSON.stringify(DEFAULT_TEAM));
      return DEFAULT_TEAM;
    }
    return JSON.parse(team);
  },
  saveTeam: (team: TeamMember[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("vaitsk_team", JSON.stringify(team));
  },
  getCurrentUser: (): TeamMember => {
    if (typeof window === 'undefined') return DEFAULT_CURRENT_USER;
    const user = localStorage.getItem("vaitsk_current_user");
    if (!user) {
      localStorage.setItem("vaitsk_current_user", JSON.stringify(DEFAULT_CURRENT_USER));
      return DEFAULT_CURRENT_USER;
    }
    return JSON.parse(user);
  },
  setCurrentUser: (user: TeamMember) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("vaitsk_current_user", JSON.stringify(user));
  }
};

// --- UNIFIED API HELPER FUNCTIONS ---

export { isFirebaseConnected };

// 1. Team Members
export async function getTeamMembers(): Promise<TeamMember[]> {
  if (isFirebaseConnected && db) {
    try {
      const snap = await getDocs(collection(db, "team"));
      if (snap.empty) {
        // Initialize Firebase with defaults
        for (const m of DEFAULT_TEAM) {
          await setDoc(doc(db, "team", m.id), m);
        }
        return DEFAULT_TEAM;
      }
      return snap.docs.map(d => d.data() as TeamMember);
    } catch (e) {
      console.warn("Firestore error getting team, falling back to localStorage:", e);
      return MOCK_DB.getTeam();
    }
  }
  return MOCK_DB.getTeam();
}

export async function addTeamMember(member: Omit<TeamMember, 'id'>): Promise<TeamMember> {
  const newMember: TeamMember = {
    ...member,
    id: `u_${Date.now()}`
  };
  
  if (isFirebaseConnected && db) {
    try {
      await setDoc(doc(db, "team", newMember.id), newMember);
      return newMember;
    } catch (e) {
      console.warn("Firestore error adding team member, falling back to localStorage:", e);
    }
  }
  
  const team = MOCK_DB.getTeam();
  team.push(newMember);
  MOCK_DB.saveTeam(team);
  return newMember;
}

// 2. Current User
export async function getCurrentUser(): Promise<TeamMember> {
  if (isFirebaseConnected && db) {
    try {
      const snap = await getDocs(collection(db, "current_user"));
      if (snap.empty) {
        await setDoc(doc(db, "current_user", "active"), DEFAULT_CURRENT_USER);
        return DEFAULT_CURRENT_USER;
      }
      return snap.docs[0].data() as TeamMember;
    } catch (e) {
      console.warn("Firestore error getting current user, falling back to localStorage:", e);
      return MOCK_DB.getCurrentUser();
    }
  }
  return MOCK_DB.getCurrentUser();
}

export async function setCurrentUser(user: TeamMember): Promise<void> {
  if (isFirebaseConnected && db) {
    try {
      await setDoc(doc(db, "current_user", "active"), user);
      return;
    } catch (e) {
      console.warn("Firestore error setting current user, falling back to localStorage:", e);
    }
  }
  MOCK_DB.setCurrentUser(user);
}

// 3. Tasks
export async function getTasks(): Promise<Task[]> {
  if (isFirebaseConnected && db) {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Task));
  }
  return MOCK_DB.getTasks().sort((a, b) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

export async function createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  const newTask: Task = {
    ...task,
    id: `task_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConnected && db) {
    const docRef = await addDoc(collection(db, "tasks"), {
      ...newTask,
      createdAt: newTask.createdAt
    });
    return { ...newTask, id: docRef.id };
  }

  const tasks = MOCK_DB.getTasks();
  tasks.push(newTask);
  MOCK_DB.saveTasks(tasks);
  return newTask;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  if (isFirebaseConnected && db) {
    const docRef = doc(db, "tasks", id);
    await updateDoc(docRef, updates);
    return;
  }

  const tasks = MOCK_DB.getTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...updates };
    MOCK_DB.saveTasks(tasks);
  }
}

export async function deleteTask(id: string): Promise<void> {
  if (isFirebaseConnected && db) {
    await deleteDoc(doc(db, "tasks", id));
    return;
  }

  const tasks = MOCK_DB.getTasks();
  const filtered = tasks.filter(t => t.id !== id);
  MOCK_DB.saveTasks(filtered);
}

// 4. Decisions
export async function getDecisions(): Promise<Decision[]> {
  if (isFirebaseConnected && db) {
    const q = query(collection(db, "decisions"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Decision));
  }
  return MOCK_DB.getDecisions().sort((a, b) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

export async function createDecision(decision: Omit<Decision, 'id' | 'createdAt'>): Promise<Decision> {
  const newDecision: Decision = {
    ...decision,
    id: `decision_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConnected && db) {
    const docRef = await addDoc(collection(db, "decisions"), {
      ...newDecision,
      createdAt: newDecision.createdAt
    });
    return { ...newDecision, id: docRef.id };
  }

  const decisions = MOCK_DB.getDecisions();
  decisions.push(newDecision);
  MOCK_DB.saveDecisions(decisions);
  return newDecision;
}

export async function deleteDecision(id: string): Promise<void> {
  if (isFirebaseConnected && db) {
    await deleteDoc(doc(db, "decisions", id));
    return;
  }

  const decisions = MOCK_DB.getDecisions();
  const filtered = decisions.filter(d => d.id !== id);
  MOCK_DB.saveDecisions(filtered);
}

// 5. Blockers
export async function getBlockers(): Promise<Blocker[]> {
  if (isFirebaseConnected && db) {
    const q = query(collection(db, "blockers"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Blocker));
  }
  return MOCK_DB.getBlockers().sort((a, b) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

export async function createBlocker(blocker: Omit<Blocker, 'id' | 'createdAt'>): Promise<Blocker> {
  const newBlocker: Blocker = {
    ...blocker,
    id: `blocker_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConnected && db) {
    const docRef = await addDoc(collection(db, "blockers"), {
      ...newBlocker,
      createdAt: newBlocker.createdAt
    });
    return { ...newBlocker, id: docRef.id };
  }

  const blockers = MOCK_DB.getBlockers();
  blockers.push(newBlocker);
  MOCK_DB.saveBlockers(blockers);
  return newBlocker;
}

export async function deleteBlocker(id: string): Promise<void> {
  if (isFirebaseConnected && db) {
    await deleteDoc(doc(db, "blockers", id));
    return;
  }

  const blockers = MOCK_DB.getBlockers();
  const filtered = blockers.filter(b => b.id !== id);
  MOCK_DB.saveBlockers(filtered);
}
