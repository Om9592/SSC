import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  increment,
  writeBatch,
  arrayUnion,
  query,
  orderBy,
  limit,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import QuoteSection from "./QuoteSection.jsx";
import { 
  Shield, 
  Brain, 
  Clock, 
  Calendar, 
  BarChart2, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Lock, 
  Zap,
  ChevronRight,
  Activity,
  Target,
  LogOut,
  FilePenLine,
  ArrowLeft,
  BookOpen,
  Plus,
  FileText,
  Image as ImageIcon,
  Upload,
  FileQuestion,
  CheckSquare,
  AlertCircle,
  Loader2,
  Scan,
  Youtube,
  Trash2,
  Languages,
  RefreshCw,
  Volume2
} from 'lucide-react';

// --- CONFIGURATION ---
const APP_NAME = "SSC-CGL-COMMAND-CENTER";
const TARGET_HOURS = 7;
const TARGET_MINUTES = TARGET_HOURS * 60;

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
   measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const requiredFirebaseKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingFirebaseKeys = requiredFirebaseKeys.filter(key => !firebaseConfig[key]);
const app = missingFirebaseKeys.length === 0 ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const appId = "ssc-cgl-v1";

// --- UTILS ---
const safeJSONParse = (str) => {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    try {
      const cleaned = str.replace(/```json\s*|\s*```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error("Safe JSON Parse Failed:", e2);
      return null;
    }
  }
};

// --- AI UTILS ---
const generateAIResponse = async (prompt, systemInstruction, inlineData) => {
  if (!auth?.currentUser) {
    throw new Error("Sign in again before using AI features.");
  }

  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, systemInstruction, inlineData }),
    signal: AbortSignal.timeout(65000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`AI service returned an unreadable response (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(data.error || `AI service failed (${response.status}).`);
  }
  if (!data.text) {
    throw new Error("AI service returned an empty response. Please try again.");
  }
  return data.text;
};

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isValidTestQuestion = (question) => {
  const prompt = question?.question_en || question?.question;
  const options = question?.options_en || question?.options;
  return typeof prompt === 'string'
    && prompt.trim().length > 0
    && Array.isArray(options)
    && options.length === 4
    && Number.isInteger(question.correctIndex)
    && question.correctIndex >= 0
    && question.correctIndex < options.length;
};

// --- SEO UTILS ---
const updateSEO = (title, description, keywords, jsonLd) => {
  document.title = title;
  
  // Helper to update or create meta tag
  const setMeta = (name, content) => {
    let element = document.querySelector(`meta[name='${name}']`);
    if (!element) {
      element = document.createElement("meta");
      element.name = name;
      document.head.appendChild(element);
    }
    element.content = content;
  };

  // Helper for OG tags (Social & Search Rich Results)
  const setOg = (property, content) => {
    let element = document.querySelector(`meta[property='${property}']`);
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute("property", property);
      document.head.appendChild(element);
    }
    element.content = content;
  };

  setMeta("description", description);
  setMeta("keywords", keywords);
  setMeta("robots", "index, follow"); // CRITICAL: Tells Google to index this page
  setMeta("author", "SSC CGL Command Center");

  // Open Graph Tags (Helps in ranking and sharing)
  setOg("og:title", title);
  setOg("og:description", description);
  setOg("og:type", "website");
  setOg("og:url", window.location.href);
  setOg("og:site_name", "SSC CGL Command Center");

  // Canonical URL (Prevents duplicate content issues)
  let linkCanonical = document.querySelector("link[rel='canonical']");
  if (!linkCanonical) {
    linkCanonical = document.createElement("link");
    linkCanonical.rel = "canonical";
    document.head.appendChild(linkCanonical);
  }
  linkCanonical.href = window.location.href;

  // JSON-LD (Structured Data)
  let scriptJson = document.querySelector("script[type='application/ld+json']");
  if (!scriptJson) {
    scriptJson = document.createElement("script");
    scriptJson.type = "application/ld+json";
    document.head.appendChild(scriptJson);
  }
  scriptJson.text = JSON.stringify(jsonLd);
};

// --- COMPONENT: AUTH GATE ---
const AuthGate = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    // IMMEDIATE SEO FOR LANDING PAGE (What Google sees first)
    updateSEO(
      "SSC CGL Command Center | Best AI Preparation App 2025",
      "Boost your SSC CGL preparation with AI-powered study plans, mock tests, and discipline tracking. The ultimate tool for government job aspirants.",
      "SSC CGL Command Center, SSC CGL AI Planner, SSC CGL 2025, Best App for SSC CGL, Free Mock Test Generator, Government Job Preparation",
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "SSC CGL Command Center",
        "applicationCategory": "EducationalApplication",
        "operatingSystem": "Web",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" }
      }
    );

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setAuthError(error.message);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-mono">
      <div className="animate-pulse">INITIALIZING SECURE ENVIRONMENT...</div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        {/* SEO HIDDEN HEADER FOR CRAWLERS */}
        <h1 className="sr-only">SSC CGL Command Center - Best AI Preparation App for SSC CGL 2025</h1>

        <div className="bg-slate-900 p-8 rounded-lg shadow-xl max-w-md w-full">
          <h1 className="text-2xl font-bold text-emerald-500 mb-6 text-center">
            SSC CGL Command Center
          </h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            {authError && (
              <div className="text-red-500 text-sm">{authError}</div>
            )}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-emerald-400 hover:text-emerald-300 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
          </div>
        </div>

        {/* SEO CONTENT SECTION (Visible & Crawlable) */}
        <div className="max-w-2xl mt-12 text-slate-400 text-sm space-y-6 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 border border-slate-800 rounded bg-slate-900/50">
              <h3 className="text-emerald-500 font-bold mb-1">AI Study Planner</h3>
              <p>Automated daily schedules for SSC CGL, CHSL, and MTS based on your weak areas.</p>
            </div>
            <div className="p-3 border border-slate-800 rounded bg-slate-900/50">
              <h3 className="text-emerald-500 font-bold mb-1">Smart Mock Tests</h3>
              <p>Generate unlimited mock tests from PDFs or text for Quant, Reasoning & English.</p>
            </div>
            <div className="p-3 border border-slate-800 rounded bg-slate-900/50">
              <h3 className="text-emerald-500 font-bold mb-1">Discipline Tracker</h3>
              <p>Gamified focus mode to ensure 7+ hours of daily study for government exams.</p>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Optimize your preparation for SSC CGL 2024-2025. Covers Quantitative Aptitude, General Intelligence & Reasoning, English Comprehension, and General Awareness.
          </p>
        </div>
      </div>
    );
  }

  return children(user);
};

// --- MAIN APP ---
export default function App() {
  if (missingFirebaseKeys.length > 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-red-900 bg-slate-900 p-6">
          <h1 className="text-xl font-bold text-red-400">Firebase configuration required</h1>
          <p className="mt-3 text-sm text-slate-300">
            Set these Vite environment variables in your deployment settings, then rebuild:
          </p>
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-400">
            {missingFirebaseKeys.map(key => <li key={key}>VITE_FIREBASE_{key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}</li>)}
          </ul>
        </div>
      </div>
    );
  }
  return (
    <AuthGate>
      {(user) => <Dashboard user={user} />}
    </AuthGate>
  );
}

// --- DASHBOARD COMPONENT ---
const Dashboard = ({ user }) => {
  const [view, setView] = useState('dashboard'); 
  const [userData, setUserData] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [activeTest, setActiveTest] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeTaskIndex, setActiveTaskIndex] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [syncError, setSyncError] = useState("");

  // Firestore Refs
  const userRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
  const scheduleRef = doc(db, 'artifacts', appId, 'users', user.uid, 'schedules', getLocalDateKey());

  useEffect(() => {
    if (!user) return;
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        const initData = {
          name: "Aspirant",
          disciplineScore: 85,
          weakSubjects: ["Quant Geometry", "English Vocab"],
          streak: 0,
          totalHoursStudied: 0,
        };
        setDoc(userRef, initData).catch((err) => {
          console.error("User profile initialization failed", err);
          setSyncError("Could not initialize your profile. Check your Firebase permissions and connection.");
        });
      }
    }, (err) => {
      console.error("User sync error", err);
      setSyncError("Could not sync your profile. Check your Firebase connection and permissions.");
    });

    const unsubSchedule = onSnapshot(scheduleRef, (docSnap) => {
      if (docSnap.exists()) {
        setTodaySchedule(docSnap.data());
      } else {
        setTodaySchedule(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Schedule sync error", err);
      setLoading(false);
      setSyncError("Could not sync today's plan. Check your Firebase connection and permissions.");
    });

    return () => {
      unsubUser();
      unsubSchedule();
    };
  }, [user]);

  // --- SEO & METADATA MANAGEMENT ---
  useEffect(() => {
    const viewMeta = {
      dashboard: { 
        title: "Mission Control | SSC CGL AI Planner", 
        desc: "Track your daily SSC CGL study targets, discipline score, and progress. The best app for SSC CGL 2025 preparation.",
        keywords: "SSC CGL, Study Planner, Daily Targets, Government Job, SSC Preparation App"
      },
      library: { 
        title: "Smart Library | SSC Mock Test Generator", 
        desc: "Upload study materials and generate AI-powered mock tests for SSC CGL preparation. Convert PDFs to Quizzes instantly.",
        keywords: "SSC Mock Test, PDF to Quiz, AI Question Generator, SSC CGL Previous Papers"
      },
      focus: { 
        title: "Focus Mode | Deep Work Timer", 
        desc: "Distraction-free study timer with YouTube integration and discipline tracking for serious aspirants.",
        keywords: "Pomodoro for Students, Study Timer, Focus App, SSC CGL Discipline"
      },
      test: { 
        title: "CBT Mock Test | SSC CGL Exam Interface", 
        desc: "Attempt strict time-bound mock tests to improve speed and accuracy. Simulates real SSC CGL exam environment.",
        keywords: "SSC CGL Mock Test Free, CBT Exam, Online Test Series"
      },
      analysis: { 
        title: "Performance Analysis | AI Coach", 
        desc: "Get AI-driven insights on your study habits and test performance. Identify weak areas in Quant and English.",
        keywords: "Exam Analysis, Performance Tracker, AI Education Coach"
      },
      vocabulary: {
        title: "Vocabulary Builder | SSC CGL English",
        desc: "Learn high-frequency SSC CGL vocabulary with Hindi meanings and examples using AI.",
        keywords: "SSC CGL Vocabulary, English Vocab, Daily Words, Government Exam English"
      },
      practice: {
        title: "Practice Mode | SSC CGL Error Detection",
        desc: "Sharpen your grammar with difficult error detection questions. Instant feedback and explanations for SSC CGL English preparation.",
        keywords: "SSC CGL Error Detection, English Grammar Practice, Spot the Error, SSC English"
      }
    };

    const current = viewMeta[view] || viewMeta.dashboard;
    document.title = `${current.title} | SSC CGL Command Center`;

    // Structured Data for Rich Snippets (Google Search Cards)
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "SSC CGL Command Center",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "description": current.desc,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" }
    };

    // Update Meta Description
    let metaDesc = document.querySelector("meta[name='description']");
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = current.desc;

    updateSEO(current.title, current.desc, current.keywords, jsonLd);
    document.documentElement.lang = 'en'; // Keep language setting
  }, [view]);

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      // Optional: Fetch library context if needed, currently just using weak areas
      const weakAreas = userData?.weakSubjects?.join(", ") || "General Awareness";
      
      const systemPrompt = `You are a strict Exam Planner AI. 
      Create a JSON schedule for an SSC CGL aspirant. 
      Total time MUST be approx 7 hours.
      MANDATORY: Include exactly one 60-minute session titled "Reading & Practice Task" that uses the user's uploaded library material.
      Focus on: ${weakAreas}.
      Format: JSON Array of objects: [{"title": "Subject", "duration_min": 90, "type": "Deep Work"}, ...]
      IMPORTANT: Return Strictly Valid JSON. Escape all backslashes in strings.`;

      const userPrompt = `Generate today's plan. Date: ${new Date().toLocaleDateString()}. Make it hard.`;

      const rawText = await generateAIResponse(userPrompt, systemPrompt);
      const jsonMatch = rawText.match(/\[.*\]/s);
      const plan = jsonMatch && safeJSONParse(jsonMatch[0]);
      if (!Array.isArray(plan) || plan.length === 0) {
        throw new Error("AI returned an invalid study plan. Please try again.");
      }
      const blocks = plan.map((item) => {
        const duration = Number(item.duration_min);
        if (!item.title || !Number.isFinite(duration) || duration <= 0) {
          throw new Error("AI returned a plan with an invalid task or duration. Please try again.");
        }
        return { ...item, duration_min: duration, completed_min: 0, status: 'pending' };
      });
      await setDoc(scheduleRef, {
        date: new Date().toISOString(),
        blocks,
        totalMinutesDone: 0,
        targetMinutes: blocks.reduce((total, block) => total + block.duration_min, 0)
      });
    } catch (e) {
      console.error(e);
      alert(`Could not generate today's plan: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const renderView = () => {
    switch(view) {
      case 'dashboard': return <HomeView user={user} userData={userData} todaySchedule={todaySchedule} setView={setView} scheduleRef={scheduleRef} setActiveTaskIndex={setActiveTaskIndex} handleGeneratePlan={handleGeneratePlan} generating={generating} />;
      case 'library': return <LibraryView user={user} setView={setView} setActiveTest={setActiveTest} />;
      case 'focus': return <FocusMode user={user} scheduleRef={scheduleRef} todaySchedule={todaySchedule} setView={setView} userData={userData} userRef={userRef} activeVideo={activeVideo} setActiveVideo={setActiveVideo} activeTaskIndex={activeTaskIndex} setActiveTaskIndex={setActiveTaskIndex} handleGeneratePlan={handleGeneratePlan} generating={generating} />;
      case 'test': return <TestMode user={user} activeTest={activeTest} setView={setView} userRef={userRef} />;
      case 'analysis': return <AnalysisView user={user} userData={userData} setView={setView} setActiveVideo={setActiveVideo} />;
      case 'vocabulary': return <VocabularyView user={user} setView={setView} setActiveTest={setActiveTest} />;
      case 'practice': return <PracticeMode user={user} setView={setView} />;
      default: return <HomeView user={user} userData={userData} todaySchedule={todaySchedule} setView={setView} scheduleRef={scheduleRef} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      {view !== 'test' && (
        <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {view !== 'dashboard' && (
              <button 
                onClick={() => setView('dashboard')} 
                className="p-1 hover:bg-slate-800 rounded-full transition-colors"
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            )}
            <div className="flex items-center gap-2" onClick={() => setView('dashboard')}>
              <Shield className="w-6 h-6 text-emerald-500" />
              <span className="font-bold tracking-tighter text-lg hidden sm:block">CGL.COMMAND</span>
              <span className="font-bold tracking-tighter text-lg sm:hidden">CGL</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userData && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${userData.disciplineScore > 80 ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'}`}>
                <Activity className="w-3 h-3" />
                {userData.disciplineScore}%
              </div>
            )}
            <button 
              onClick={() => setView('vocabulary')}
              className="flex items-center gap-1 px-2 py-1 hover:bg-slate-800 rounded transition-colors"
              title="Vocabulary Builder"
            >
              <Languages className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-bold text-violet-400">Vocab</span>
            </button>
            <button 
              onClick={() => {
                sessionStorage.removeItem('gita_welcome_played'); // Reset welcome audio flag
                signOut(auth);
              }} 
              className="p-1 hover:bg-slate-800 rounded-full transition-colors"
              title="Logout"
              aria-label="Sign Out"
            >
              <LogOut className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
          </div>
        </header>
      )}

      <main className={`mx-auto ${view === 'test' ? 'max-w-full h-screen' : 'max-w-md min-h-[calc(100vh-60px)]'} relative`}>
        {syncError && view !== 'test' && (
          <div role="alert" className="mx-4 mt-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
            {syncError}
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center text-slate-500 animate-pulse">Syncing Mission Data...</div>
        ) : (
          renderView()
        )}
      </main>

      {view !== 'test' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around p-3 pb-5 z-40">
          <NavBtn icon={Target} label="Mission" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavBtn icon={BookOpen} label="Library" active={view === 'library'} onClick={() => setView('library')} />
          <NavBtn icon={Zap} label="Focus" active={view === 'focus'} onClick={() => { setView('focus'); setActiveTaskIndex(null); }} />
          <NavBtn icon={FilePenLine} label="Practice" active={view === 'practice'} onClick={() => setView('practice')} />
          <NavBtn icon={Brain} label="Analysis" active={view === 'analysis'} onClick={() => setView('analysis')} />
        </nav>
      )}
    </div>
  );
};

// --- VIEW: LIBRARY ---
const LibraryView = ({ user, setView, setActiveTest }) => {
  const [materials, setMaterials] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', content: '', type: 'text', instruction: '' });
  const [generatingTest, setGeneratingTest] = useState(null); 
  const [aiStatus, setAiStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'materials'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMaterials(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }, (error) => {
      console.error("Library sync error", error);
      alert("Could not load your study materials. Check your Firebase connection and permissions.");
    });
    return () => unsub();
  }, [user]);

  const handleAdd = async () => {
    if (!newMaterial.title.trim()) {
      alert("Please enter a Title/Topic Name.");
      return;
    }
    if (newMaterial.type === 'text' && !newMaterial.content.trim()) {
      alert("Please paste text content.");
      return;
    }
    if (newMaterial.type !== 'text' && !newMaterial.content.trim()) {
      alert("Select a PDF or image and wait for its content to be read before saving.");
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'materials'), {
        ...newMaterial,
        timestamp: new Date().toISOString(),
        status: 'active'
      });
      setIsAdding(false);
      setNewMaterial({ title: '', content: '', type: 'text', instruction: '' });
    } catch (error) {
      console.error("Error saving material:", error);
      alert("Failed to save material.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("Files must be 3 MB or smaller to fit the serverless request limit.");
      e.target.value = "";
      return;
    }
    const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      alert("Choose a PDF, JPEG, PNG, or WebP file.");
      e.target.value = "";
      return;
    }

    setIsReadingFile(true);
    setNewMaterial((current) => ({ ...current, title: file.name, content: '', type: 'pdf' }));
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const prompt = `Read the attached ${mimeType === 'application/pdf' ? 'PDF' : 'image'} named "${file.name}". Extract its study content faithfully, including important facts, formulas, and headings. For scanned pages, use OCR. Return plain text only; do not invent missing or unreadable content.`;
      const extractedContent = await generateAIResponse(
        prompt,
        "You extract educational material from user-provided documents. Preserve the source's meaning and structure.",
        { mime_type: mimeType, data: btoa(binary) }
      );
      setNewMaterial((current) => ({ ...current, title: file.name, content: extractedContent, type: 'pdf' }));
    } catch (error) {
      console.error("File reading failed:", error);
      alert(`Could not read this file: ${error.message}`);
      setNewMaterial((current) => ({ ...current, content: '' }));
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleCreateTest = async (material) => {
    setGeneratingTest(material.id);
    setAiStatus("Generating questions...");

    let contextPrompt = `Analyze the study material below and create a comprehensive mock test. Cover the full material, not only its beginning.\n\nTitle: ${material.title}\n\nStudy material:\n${material.content.substring(0, 20000)}`;
    if (material.instruction) {
      contextPrompt += `\n\nIMPORTANT USER INSTRUCTION: ${material.instruction}\nFollow this instruction strictly while generating questions.`;
    }

    const systemPrompt = `You are an Exam Setter for SSC CGL. 
    Task: Generate a JSON object with a "questions" array.
    Create 10 Multiple Choice Questions based on the User's Topic/Material. Ensure questions are distributed evenly across the entire content provided.
    Each question object must have: id (1-10), question, options (array of 4 strings), correctIndex (0-3).
    Each question object must have: 
    - id (1-10)
    - question_en (English text)
    - question_hi (Hindi translation)
    - options_en (array of 4 English strings)
    - options_hi (array of 4 Hindi strings)
    - correctIndex (0-3)
    - explanation_en (Detailed solution in English)
    - explanation_hi (Detailed solution in Hindi).
    IMPORTANT: Return Strictly Valid JSON. Escape all backslashes in math formulas (e.g. use \\\\theta instead of \\theta).`;

    try {
      const rawText = await generateAIResponse(contextPrompt, systemPrompt);
      const jsonMatch = rawText.match(/\{.*\}/s);
      
      if (jsonMatch) {
        const testData = safeJSONParse(jsonMatch[0]); 
        
        if (Array.isArray(testData?.questions) && testData.questions.length > 0 && testData.questions.every(isValidTestQuestion)) {
          const formattedTest = {
            title: `Mock Test: ${material.title}`,
            questions: testData.questions,
            duration: testData.questions.length * 60,
          };
          setActiveTest(formattedTest);
          setView('test');
        } else {
          // Fallback if AI gets confused
          alert("AI could not identify the topic. Please edit the material title to be more specific.");
        }
      } else {
        alert("Failed to generate test. AI returned invalid format.");
      }
    } catch (e) {
      console.error(e);
      alert(`Could not generate the test: ${e.message}`);
    } finally {
      setGeneratingTest(null);
      setAiStatus("");
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-500" />
          Smart Library
        </h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg transition-colors"
          aria-label="Add New Material"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {isAdding && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-sm font-bold text-slate-300">Add Study Material</h3>
          <input 
            type="text" 
            placeholder="Document Title / Topic Name (Important)"
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm focus:border-emerald-500 outline-none transition-colors"
            value={newMaterial.title}
            onChange={e => setNewMaterial({...newMaterial, title: e.target.value})}
          />
          
          <div className="flex gap-2 text-xs">
            <button 
              onClick={() => setNewMaterial({...newMaterial, type: 'text', content: ''})}
              className={`flex-1 py-2 rounded border ${newMaterial.type === 'text' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
            >
              Text Paste
            </button>
            <button 
              onClick={() => setNewMaterial({...newMaterial, type: 'pdf', content: ''})}
              className={`flex-1 py-2 rounded border ${newMaterial.type === 'pdf' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
            >
              PDF / Photo
            </button>
          </div>

          {newMaterial.type === 'text' ? (
            <textarea 
              placeholder="Paste chapter text here for deep analysis..."
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm h-32 focus:border-emerald-500 outline-none transition-colors"
              value={newMaterial.content}
              onChange={e => setNewMaterial({...newMaterial, content: e.target.value})}
            />
          ) : (
            <div 
              className="border-2 border-dashed border-slate-800 rounded p-8 text-center bg-slate-950 group hover:border-slate-700 transition-colors cursor-pointer relative overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload PDF or Image"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".pdf,image/*" 
                onChange={handleFileSelect}
              />
              <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2 group-hover:text-emerald-500 transition-colors" />
              <p className="text-xs text-slate-500 mb-4">
                Click to upload PDF or Photos<br/>
                <span className="text-emerald-500/50">AI will read the document contents</span>
              </p>
              
              {isReadingFile ? (
                 <span className="text-emerald-400 text-xs flex items-center justify-center gap-2">
                   <Loader2 className="w-3 h-3 animate-spin" /> Reading file...
                 </span>
              ) : !newMaterial.title ? (
                 <span className="bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded">
                   Browse Files
                 </span>
              ) : (
                  <div className="mt-3 text-xs text-emerald-500 flex items-center justify-center gap-1 animate-in fade-in bg-emerald-950/30 py-2 rounded border border-emerald-900/50">
                      <CheckCircle className="w-3 h-3" /> Ready: {newMaterial.title}
                  </div>
              )}
            </div>
          )}

          <textarea 
            placeholder="Optional: Instructions for AI (e.g. 'Focus on formulas', 'Make it extremely hard')..."
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm h-16 focus:border-emerald-500 outline-none transition-colors"
            value={newMaterial.instruction || ''}
            onChange={e => setNewMaterial({...newMaterial, instruction: e.target.value})}
          />

          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setIsAdding(false)} className="px-3 py-1 text-xs text-slate-400 hover:text-white">Cancel</button>
            <button 
              onClick={handleAdd} 
              disabled={isSaving || isReadingFile}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded font-bold flex items-center gap-2"
            >
              {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save to Memory'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {materials.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-10">
            No books added.<br/>Upload chapters to generate tests.
          </div>
        ) : (
          materials.map(mat => (
            <div key={mat.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-950 rounded-lg text-emerald-500">
                    {mat.type === 'pdf' ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-sm text-slate-200 truncate max-w-[200px]">{mat.title}</h3>
                    <p className="text-[10px] text-slate-500">{new Date(mat.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => handleCreateTest(mat)}
                disabled={generatingTest === mat.id}
                className="w-full py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded text-xs font-bold text-slate-300 flex items-center justify-center gap-2 transition-all"
              >
                {generatingTest === mat.id ? (
                  <div className="flex items-center gap-2 text-emerald-500 animate-pulse">
                    <Scan className="w-3 h-3 animate-spin" />
                    {aiStatus || "PROCESSING..."}
                  </div>
                ) : (
                  <>
                    <FileQuestion className="w-3 h-3" />
                    ANALYZE & CREATE TEST
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- VIEW: TEST MODE (CBT / STRICT) ---
const TestMode = ({ user, activeTest, setView, userRef }) => {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [timeLeft, setTimeLeft] = useState(activeTest?.duration || 600);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [breaches, setBreaches] = useState(0);
  const [language, setLanguage] = useState('en');
  const responsesRef = useRef(responses);
  const breachesRef = useRef(breaches);
  const submittedRef = useRef(false);
  responsesRef.current = responses;
  breachesRef.current = breaches;

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setIsSubmitted(true);
    let rawScore = 0;
    activeTest.questions.forEach((q, idx) => {
      if (responsesRef.current[idx] === q.correctIndex) rawScore++;
    });
    setScore(rawScore);

    try {
      const sessionRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'test_results'));
      await setDoc(sessionRef, {
        testTitle: activeTest.title,
        score: rawScore,
        total: activeTest.questions.length,
        breaches: breachesRef.current,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Test result save failed:", error);
      alert("Your score is shown, but the result could not be saved to history.");
    }
  }, [activeTest, user.uid]);

  useEffect(() => {
    if (isSubmitted) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setTimeLeft(time => Math.max(0, time - 1)), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, isSubmitted, handleSubmit]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitted) {
        breachesRef.current += 1;
        setBreaches(breachesRef.current);
        updateDoc(userRef, { disciplineScore: increment(-5) }).catch((error) => {
          console.error("Discipline penalty update failed:", error);
          alert("The discipline penalty could not be saved. Check your connection.");
        });
        alert("WARNING: Test Discipline Breach! -5 Score.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isSubmitted, userRef]);

  if (!Array.isArray(activeTest?.questions) || activeTest.questions.length === 0) {
    return <div className="p-8">Error loading test. Return to the Library and generate it again.</div>;
  }

  const currentQ = activeTest.questions[currentQIndex];

  const handleOptionSelect = (optIndex) => {
    if (isSubmitted) return;
    setResponses(prev => ({ ...prev, [currentQIndex]: optIndex }));
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getQuestionText = (q) => {
    if (language === 'hi' && q.question_hi) return q.question_hi;
    return q.question_en || q.question;
  };

  const getOptions = (q) => {
    if (language === 'hi' && q.options_hi) return q.options_hi;
    return q.options_en || q.options || [];
  };

  const getExplanation = (q) => {
    if (language === 'hi' && q.explanation_hi) return q.explanation_hi;
    return q.explanation_en || q.explanation || "Solution not available for this question.";
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <h1 className="font-bold text-slate-200 truncate max-w-[50%]">{activeTest.title}</h1>
        <div className="flex items-center gap-4">
          {!isSubmitted && (
            <button 
              onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
              className="flex items-center gap-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-bold text-slate-300 transition-colors"
              aria-label="Switch Language"
            >
              <Languages className="w-3 h-3" />
              {language === 'en' ? 'English' : 'à¤¹à¤¿à¤‚à¤¦à¥€'}
            </button>
          )}
          <div className={`flex items-center gap-2 px-3 py-1 rounded font-mono font-bold ${timeLeft < 60 ? 'bg-red-900/50 text-red-500' : 'bg-slate-800 text-emerald-400'}`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
          {!isSubmitted && (
             <button 
               onClick={handleSubmit}
               className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded text-sm font-bold"
             >
               SUBMIT
             </button>
          )}
          {isSubmitted && (
            <button 
              onClick={() => setView('library')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-sm font-bold"
            >
              EXIT
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto">
          {isSubmitted ? (
            <div className="max-w-3xl mx-auto space-y-8 pt-6 pb-20">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center">
                <CheckSquare className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-2">Test Submitted</h2>
                <div className="text-6xl font-black text-emerald-400 mb-2">{score} / {activeTest.questions.length}</div>
                <p className="text-slate-500">Discipline Breaches: <span className="text-red-500 font-bold">{breaches}</span></p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-500" />
                    Detailed Solutions
                  </h3>
                </div>
                
                {activeTest.questions.map((q, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                    <div className="flex gap-3 mb-4">
                      <span className="font-bold text-slate-500 shrink-0">Q{idx + 1}.</span>
                      <p className="font-medium text-slate-200 leading-relaxed">
                        {getQuestionText(q)}
                      </p>
                    </div>

                    <div className="space-y-2 mb-5">
                      {getOptions(q).map((opt, optIdx) => {
                        const isSelected = responses[idx] === optIdx;
                        const isCorrect = q.correctIndex === optIdx;
                        let style = "border-slate-800 bg-slate-950 text-slate-400";
                        
                        if (isCorrect) {
                          style = "border-emerald-500 bg-emerald-900/20 text-emerald-400 ring-1 ring-emerald-500";
                        } else if (isSelected) {
                          style = "border-red-500 bg-red-900/20 text-red-400";
                        }

                        return (
                          <div key={optIdx} className={`p-3 rounded-lg border text-sm flex items-center justify-between ${style}`}>
                            <span>{opt}</span>
                            {isCorrect && <CheckCircle className="w-4 h-4 shrink-0" />}
                            {isSelected && !isCorrect && <XCircle className="w-4 h-4 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">
                        Solution / Explanation
                      </p>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {getExplanation(q)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-start gap-4">
                <span className="text-slate-500 font-bold text-lg">Q{currentQIndex + 1}.</span>
                <p className="text-lg text-slate-200 leading-relaxed font-medium">
                  {getQuestionText(currentQ)}
                </p>
              </div>

              <div className="space-y-3">
                {getOptions(currentQ).map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOptionSelect(idx)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      responses[currentQIndex] === idx
                        ? 'bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      responses[currentQIndex] === idx ? 'border-emerald-500' : 'border-slate-600'
                    }`}>
                      {responses[currentQIndex] === idx && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                    </div>
                    <span className="text-slate-300">{opt}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="w-64 bg-slate-900 border-l border-slate-800 p-4 hidden md:flex flex-col">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Question Palette</h3>
          <div className="grid grid-cols-4 gap-2">
            {activeTest.questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQIndex(idx)}
                className={`h-10 rounded font-bold text-sm transition-colors ${
                  currentQIndex === idx 
                    ? 'ring-2 ring-white bg-slate-800'
                    : responses[idx] !== undefined
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-800 text-slate-500'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          
          <div className="mt-auto space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 bg-emerald-600 rounded" /> Answered
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 bg-slate-800 rounded" /> Not Answered
            </div>
          </div>
        </div>
      </div>

      <div className="h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6">
        <button 
          onClick={() => setCurrentQIndex(Math.max(0, currentQIndex - 1))}
          disabled={currentQIndex === 0}
          className="px-4 py-2 bg-slate-800 rounded-lg text-slate-300 disabled:opacity-50"
        >
          Previous
        </button>
        <button 
          onClick={() => setCurrentQIndex(Math.min(activeTest.questions.length - 1, currentQIndex + 1))}
          disabled={currentQIndex === activeTest.questions.length - 1}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg disabled:opacity-50"
        >
          Save & Next
        </button>
      </div>
    </div>
  );
};

// --- VIEW: HOME / DASHBOARD ---
const HomeView = ({ user, userData, todaySchedule, setView, scheduleRef, setActiveTaskIndex, handleGeneratePlan, generating }) => {
  const progress = todaySchedule ? (todaySchedule.totalMinutesDone / TARGET_MINUTES) * 100 : 0;
  const isPlanComplete = todaySchedule && todaySchedule.blocks.every(b => b.status === 'completed');

  return (
    <div className="p-4 space-y-6 pb-24">
      <QuoteSection />

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Clock className="w-12 h-12" />
          </div>
          <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Today's Focus</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">
              {todaySchedule ? Math.round(todaySchedule.totalMinutesDone / 60 * 10) / 10 : 0}
            </span>
            <span className="text-sm text-slate-500">/ 7 hrs</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
            <div 
              className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Discipline</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-3xl font-bold ${userData?.disciplineScore < 70 ? 'text-red-500' : 'text-emerald-500'}`}>
              {userData?.disciplineScore || 100}
            </span>
            <span className="text-xs text-slate-500">POINTS</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-tight">
            Score drops if you exit app during study sessions.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            Tactical Plan
          </h2>
          {(!todaySchedule || isPlanComplete) && (
            <button 
              onClick={handleGeneratePlan}
              disabled={generating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-colors"
            >
              {generating ? <Clock className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {isPlanComplete ? "GENERATE NEW PLAN" : "AUTO-GENERATE"}
            </button>
          )}
        </div>

        {!todaySchedule ? (
          <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-500 text-sm">No battle plan for today.</p>
            <p className="text-slate-600 text-xs mt-1">Generate one to start tracking.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todaySchedule.blocks.map((block, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  block.status === 'completed' 
                    ? 'bg-emerald-950/30 border-emerald-900/50 opacity-60' 
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div>
                  <h3 className={`font-semibold text-sm ${block.status === 'completed' ? 'text-emerald-500 line-through' : 'text-slate-200'}`}>
                    {block.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 bg-slate-950 px-2 py-0.5 rounded">
                      {block.completed_min || 0} / {block.duration_min} mins
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                      {block.type}
                    </span>
                  </div>
                  {block.status === 'pending' && (block.completed_min || 0) > 0 && (
                    <div className="w-24 h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, ((block.completed_min || 0) / block.duration_min) * 100)}%` }}></div>
                    </div>
                  )}
                </div>
                {block.status === 'pending' && (
                  <button 
                    onClick={() => { setActiveTaskIndex(idx); setView('focus'); }}
                    className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-emerald-500" />
                  </button>
                )}
                {block.status === 'completed' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- VIEW: FOCUS MODE (THE DISCIPLINE ENGINE) ---
const FocusMode = ({ user, scheduleRef, todaySchedule, setView, userData, userRef, activeVideo, setActiveVideo, activeTaskIndex, setActiveTaskIndex, handleGeneratePlan, generating }) => {
  const blocks = todaySchedule?.blocks || [];
  
  // Determine if we are in Custom Mode or Schedule Mode
  const [isCustom, setIsCustom] = useState(activeTaskIndex === null && !activeVideo);
  const [customConfirmed, setCustomConfirmed] = useState(false);
  const [customTaskInput, setCustomTaskInput] = useState({ title: "", duration: 30 });

  // Derive the effective task based on mode
  const currentTask = useMemo(() => {
    if (activeVideo) {
      return { title: activeVideo.title || "Video Revision", duration_min: 30, type: "Revision", isAdHoc: true };
    }
    if (isCustom) {
      return { title: customTaskInput.title || "Self Study Session", duration_min: customTaskInput.duration, type: "Custom", isAdHoc: true };
    }
    if (activeTaskIndex !== null && blocks[activeTaskIndex]) {
      const b = blocks[activeTaskIndex];
      // Calculate remaining time for the timer
      const remaining = Math.max(5, b.duration_min - (b.completed_min || 0));
      return { ...b, duration_min: remaining, original_duration: b.duration_min };
    }
    return null;
  }, [activeVideo, isCustom, activeTaskIndex, blocks, customTaskInput]);

  const [timeLeft, setTimeLeft] = useState(currentTask ? currentTask.duration_min * 60 : 30 * 60);
  const [initialDuration, setInitialDuration] = useState(currentTask ? currentTask.duration_min * 60 : 30 * 60);
  const [isActive, setIsActive] = useState(false);
  const [breaches, setBreaches] = useState(0);
  const [youtubeLink, setYoutubeLink] = useState(activeVideo?.url || "");
  const [embeddedVideo, setEmbeddedVideo] = useState(activeVideo?.id || null);
  const playerRef = useRef(null);
  const finishingRef = useRef(false);

  // Reset timer when task changes
  useEffect(() => {
    if (currentTask) {
      setTimeLeft(currentTask.duration_min * 60);
      setInitialDuration(currentTask.duration_min * 60);
    }
  }, [currentTask?.title, currentTask?.duration_min]);

  useEffect(() => {
    if (activeVideo) {
      setYoutubeLink(activeVideo.url || "");
      setEmbeddedVideo(activeVideo.id || null);
    }
  }, [activeVideo]);

  const getYoutubeId = (url) => {
    if (!url) return null;
    // Supports: Standard, Shorts, Live, Embed, Mobile, Short-URL
    const regExp = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})(?:[?&].*)?$/;
    const match = url.trim().match(regExp);
    return match ? match[1] : null;
  };

  useEffect(() => {
    if (embeddedVideo) {
      const loadPlayer = () => {
        if (window.YT && window.YT.Player) {
          if (playerRef.current) {
            try { playerRef.current.destroy(); } catch (e) {}
          }
          playerRef.current = new window.YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: embeddedVideo,
            playerVars: {
              'autoplay': 1,
              'controls': 1,
              'rel': 0,
              'modestbranding': 1
            },
            events: {
              'onReady': (event) => {
                const duration = event.target.getDuration();
                if (duration > 0) {
                  setTimeLeft(Math.floor(duration));
                  setInitialDuration(Math.floor(duration));
                }
              }
            }
          });
        }
      };

      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        window.onYouTubeIframeAPIReady = loadPlayer;
      } else {
        setTimeout(loadPlayer, 100);
      }
    }
    return () => { if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} } };
  }, [embeddedVideo]);

  useEffect(() => {
    let interval = null;
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        setIsActive(false); 
        setBreaches(prev => prev + 1);
        updateDoc(userRef, { disciplineScore: increment(-2) }).catch((error) => {
          console.error("Focus discipline penalty update failed:", error);
          alert("The discipline penalty could not be saved. Check your connection.");
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      completeSession();
    }
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, timeLeft, userRef]);

  const toggleTimer = () => {
    if (!currentTask) return;
    
    if (!isActive && youtubeLink.trim()) {
      const id = getYoutubeId(youtubeLink);
      if (id) {
        setEmbeddedVideo(id);
      } else {
        alert("Invalid YouTube Link. Please paste a valid URL.");
        return;
      }
    }
    setIsActive(!isActive);
  };

  const completeSession = async () => {
    if (!currentTask || finishingRef.current) return;
    finishingRef.current = true;

    try {
      const spentSeconds = initialDuration - timeLeft;
      const spentMinutes = Math.max(1, Math.floor(spentSeconds / 60));

      let finalVideoId = embeddedVideo;
      if (!finalVideoId && youtubeLink) {
          finalVideoId = getYoutubeId(youtubeLink);
      }

      const userUpdates = {
        totalHoursStudied: increment(spentMinutes / 60)
      };
    
      if (timeLeft > 60) {
        userUpdates.disciplineScore = increment(-5);
        alert("âš ï¸ DISCIPLINE PENALTY: Session abandoned early! (-5 Points)");
      } else if (breaches === 0) {
        userUpdates.disciplineScore = increment(1);
      }

      const batch = writeBatch(db);
      batch.update(userRef, userUpdates);

      if (todaySchedule) {
        const scheduleUpdates = { totalMinutesDone: increment(spentMinutes) };
      
        if (!currentTask.isAdHoc && activeTaskIndex !== null) {
          const newBlocks = [...blocks];
          const block = newBlocks[activeTaskIndex];
        
          const previousDone = block.completed_min || 0;
          const newDone = previousDone + spentMinutes;
          block.completed_min = newDone;

          if (newDone >= block.duration_min) {
            block.status = 'completed';
          }
          scheduleUpdates.blocks = newBlocks;
        }
        batch.update(scheduleRef, scheduleUpdates);
      }
      const sessionRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'));
      batch.set(sessionRef, {
        task: currentTask.title,
        duration: spentMinutes,
        breaches,
        timestamp: new Date().toISOString(),
        type: currentTask.type,
        videoId: finalVideoId || null,
        videoUrl: youtubeLink || null
      });
      await batch.commit();
      if (setActiveVideo) setActiveVideo(null);
      setView('dashboard');
    } catch (error) {
      finishingRef.current = false;
      console.error("Focus session save failed:", error);
      alert(`Could not save your focus session: ${error.message}`);
    }
  };

  // If no schedule and not custom mode, force custom mode
  if ((!todaySchedule || blocks.length === 0) && !activeVideo && !isCustom) {
    setIsCustom(true);
  }

  /* 
     REMOVED: The "No Active Mission" block. 
     REASON: User wants option to enter plan in focus mode.
  */

  if (!currentTask && !activeVideo && !isCustom) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 bg-black">
        <AlertTriangle className="w-16 h-16 text-yellow-500" />
        <h2 className="text-xl font-bold text-white">No Active Mission</h2>
        <p className="text-slate-400">Please generate a daily plan in the Mission Control tab first.</p>
        <button onClick={() => setView('dashboard')} className="text-emerald-500 underline">Return to Base</button>
      </div>
    );
  }

  if (!currentTask && !activeVideo) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <CheckCircle className="w-16 h-16 text-emerald-500" />
        <h2 className="text-2xl font-bold text-white">All Tasks Complete</h2>
        <button 
          onClick={handleGeneratePlan}
          disabled={generating}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 mx-auto"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : "GENERATE NEW PLAN"}
        </button>
        <button onClick={() => setView('dashboard')} className="text-emerald-500 underline">Return to Base</button>
      </div>
    );
  }

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      <button 
        onClick={() => {
          if (setActiveVideo) setActiveVideo(null);
          setView('dashboard');
        }}
        className="fixed top-5 left-5 z-50 text-slate-500 hover:text-white p-2 bg-slate-900/50 rounded-full backdrop-blur-sm transition-all hover:bg-slate-800"
        aria-label="Exit Focus Mode"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      {breaches > 0 && (
        <div className="bg-red-900/20 border-b border-red-900/50 p-2 text-center mt-12">
          <p className="text-red-500 text-xs font-bold animate-pulse">
            âš ï¸ DISCIPLINE BREACH DETECTED: {breaches} | SCORE PENALIZED
          </p>
        </div>
      )}

      {/* CUSTOM TASK INPUT OVERLAY */}
      {isCustom && !customConfirmed && !isActive && !activeVideo && (
        <div className="absolute inset-0 z-30 bg-slate-950/90 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-500" />
              Set Custom Focus
            </h3>
            <div>
              <label className="text-xs text-slate-500 uppercase font-bold">Task Name</label>
              <input 
                type="text" 
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white mt-1 focus:border-emerald-500 outline-none"
                placeholder="e.g. Math Practice, Reading..."
                value={customTaskInput.title}
                onChange={e => setCustomTaskInput({...customTaskInput, title: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase font-bold">Duration (Minutes)</label>
              <input 
                type="number" 
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white mt-1 focus:border-emerald-500 outline-none"
                value={customTaskInput.duration}
                onChange={e => setCustomTaskInput({...customTaskInput, duration: parseInt(e.target.value) || 30})}
              />
            </div>
            <button 
              onClick={() => setCustomConfirmed(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg"
            >
              START SESSION
            </button>
            
            <button 
              onClick={() => { setIsCustom(false); handleGeneratePlan(); }}
              disabled={generating}
              className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold py-3 rounded-lg border border-slate-700 flex items-center justify-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              GENERATE AI PLAN
            </button>

            {todaySchedule && (
              <button onClick={() => { setIsCustom(false); setActiveTaskIndex(null); setView('dashboard'); }} className="w-full text-slate-500 text-sm hover:text-white">
                Cancel & Return to Schedule
              </button>
            )}
          </div>
        </div>
      )}

      <div className="min-h-screen flex flex-col items-center justify-center p-4 py-20 relative">
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 bg-emerald-500/5 rounded-full animate-ping" />
          </div>
        )}

        <div className="text-center space-y-2 mb-12 relative z-10">
          <span className="inline-block px-3 py-1 bg-slate-900 rounded-full text-slate-400 text-xs font-mono border border-slate-800">
            {isCustom ? "CUSTOM SESSION" : "SCHEDULED MISSION"}
          </span>
          <h2 className="text-2xl font-bold text-white max-w-xs mx-auto leading-tight">
            {currentTask?.title}
          </h2>
          <p className="text-slate-500 text-sm">{currentTask?.type}</p>
          
          {!isActive && !isCustom && !activeVideo && (
            <button onClick={() => { setIsCustom(true); setCustomConfirmed(false); }} className="text-xs text-emerald-500 underline mt-2">
              Switch to Custom Task
            </button>
          )}
        </div>

        {embeddedVideo ? (
          <div className="w-full max-w-4xl flex flex-col items-center z-20">
            <div className="w-full aspect-video max-h-[50vh] bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl ring-1 ring-emerald-500/50 mb-4">
              <div id="youtube-player"></div>
            </div>
            <div className="text-3xl font-black font-mono text-emerald-500 tabular-nums bg-slate-900/80 px-4 py-2 rounded-lg backdrop-blur">
              {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </div>
          </div>
        ) : (
          <div className="relative z-10 mb-12">
            <div className="text-6xl sm:text-8xl font-black font-mono tracking-tighter text-white tabular-nums">
              {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </div>
          </div>
        )}

        {!isActive && !activeVideo && !embeddedVideo && (
          <div className="mb-8 w-full max-w-xs relative z-20">
            <div className="relative group">
              <Youtube className="absolute left-3 top-3 w-4 h-4 text-slate-500 group-focus-within:text-red-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Paste YouTube Link to Lock Focus"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-red-500 outline-none transition-colors placeholder:text-slate-600"
                value={youtubeLink}
                onChange={(e) => setYoutubeLink(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-2 text-center">
              Paste a link to watch ONLY that video. <br/>Switching tabs will penalize score.
            </p>
          </div>
        )}

        {!isActive && activeVideo && (
          <div className="mb-8 text-center relative z-20 bg-emerald-950/30 border border-emerald-900/50 px-6 py-3 rounded-xl">
            <p className="text-emerald-400 text-sm font-bold flex items-center gap-2 justify-center"><CheckCircle className="w-4 h-4" /> Video Loaded</p>
            <p className="text-[10px] text-slate-500 mt-1">Press Zap to Start Rewatching</p>
          </div>
        )}

        <div className="flex gap-4 z-10">
          <button 
            onClick={toggleTimer}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isActive 
                ? 'bg-yellow-600 hover:bg-yellow-500 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50'
            }`}
            aria-label={isActive ? "Pause Focus Timer" : "Start Focus Timer"}
          >
            {isActive ? <Lock className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
          </button>
        </div>

        {!isActive && currentTask && timeLeft !== (currentTask.duration_min * 60) && (
          <button 
            onClick={completeSession}
            className="mt-8 text-xs text-slate-400 hover:text-white border border-slate-800 hover:border-emerald-500 px-6 py-2 rounded-full transition-all flex items-center gap-2 group"
          >
            <CheckCircle className="w-4 h-4 text-slate-600 group-hover:text-emerald-500" />
            Finish & Save Session
          </button>
        )}
        
        <p className="mt-8 text-slate-600 text-xs max-w-[200px] text-center">
          {isActive ? "Do not leave this screen. The AI is watching your focus." : "Timer Paused. Discipline mode active."}
        </p>
      </div>
    </div>
  );
};

// --- VIEW: PRACTICE MODE ---
const PracticeMode = ({ user, setView }) => {
  const [question, setQuestion] = useState(null);
  const previousQuestionsRef = useRef([]);
  const questionSequenceRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [userSelection, setUserSelection] = useState({ index: null, status: '' }); // status: 'correct', 'incorrect'
  const [showAnswer, setShowAnswer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [timerId, setTimerId] = useState(null);
  const [explanationLang, setExplanationLang] = useState('en'); // 'en' or 'hi'

  const fetchQuestion = async () => {
    setLoading(true);
    setQuestion(null);
    setUserSelection({ index: null, status: '' });
    setShowAnswer(false);
    if (timerId) clearInterval(timerId);

    const historyKey = `practice_question_history_${user.uid}`;
    if (previousQuestionsRef.current.length === 0) {
      try {
        const savedQuestions = safeJSONParse(localStorage.getItem(historyKey));
        if (Array.isArray(savedQuestions)) {
          previousQuestionsRef.current = savedQuestions.filter(item => typeof item === 'string').slice(-10);
        }
      } catch (error) {
        console.error("Could not load previous practice questions:", error);
      }
    }

    const topics = [
      "subject-verb agreement",
      "articles and determiners",
      "prepositions",
      "tenses and verb forms",
      "pronouns",
      "conjunctions",
      "adjectives and adverbs",
      "parallelism and sentence structure",
      "modifiers",
      "conditional sentences"
    ];
    const topic = topics[questionSequenceRef.current % topics.length];
    questionSequenceRef.current += 1;
    const previousQuestions = previousQuestionsRef.current;
    const variationId = crypto.randomUUID();

    const systemPrompt = `You are an expert English Grammar teacher for the SSC CGL exam, specializing in Previous Year Questions (PYQs).
    Your task is to generate a single "Error Detection" question that is either an actual PYQ from an SSC exam (like CGL, CHSL, CPO) or is created in the exact style and difficulty of a real PYQ.
    Focus this question on ${topic}. Make it substantially different in wording and grammar rule from the recent questions supplied by the user. Never repeat any of those questions.
    The sentence must be split into three parts. The fourth option is always "No Error".
    You must return a JSON object with the following structure:
    {
      "sentence": "The full sentence with parts separated by slashes, like 'Part 1 / Part 2 / Part 3.'",
      "parts": ["Part 1 of the sentence", "Part 2", "Part 3"],
      "errorIndex": 1, // The index (0-2) of the part containing the error. If no error, this should be 3.
      "explanation_en": "A clear English explanation of the grammatical error and the correction, mentioning the grammatical rule involved.",
      "explanation_hi": "The same explanation, but translated into clear, natural-sounding Hindi."
    }
    IMPORTANT: Return ONLY the raw JSON object. Do not wrap it in markdown or any other text.
    If there is no error in the sentence, the "errorIndex" must be 3.
    `;

    try {
      const recentQuestions = previousQuestions.length > 0
        ? ` Avoid questions similar to these recent sentences: ${JSON.stringify(previousQuestions)}.`
        : "";
      const rawText = await generateAIResponse(
        `Generate one new SSC CGL error-detection practice question with Hindi explanation. Request variation: ${variationId}.${recentQuestions}`,
        systemPrompt
      );
      const q = safeJSONParse(rawText);
      if (q
        && typeof q.sentence === 'string'
        && Array.isArray(q.parts)
        && q.parts.length === 3
        && q.parts.every(part => typeof part === 'string')
        && Number.isInteger(q.errorIndex)
        && q.errorIndex >= 0
        && q.errorIndex <= 3
        && typeof q.explanation_en === 'string'
        && typeof q.explanation_hi === 'string') {
        previousQuestionsRef.current = [...previousQuestions, q.sentence].slice(-10);
        try {
          localStorage.setItem(historyKey, JSON.stringify(previousQuestionsRef.current));
        } catch (error) {
          console.error("Could not save practice question history:", error);
        }
        setQuestion(q);
        setTimeLeft(10); // Reset timer
      } else {
        console.error("AI returned invalid question format", rawText);
        alert("AI returned an invalid question format. Please try again.");
      }
    } catch (e) {
      console.error("Error fetching question:", e);
      alert("An error occurred while fetching the question.");
    } finally {
      setLoading(false);
    }
  };

  // Effect to start the timer when a new question is loaded
  useEffect(() => {
    if (question && !showAnswer && userSelection.index === null) {
      const id = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(id);
            setShowAnswer(true); // Time's up, show the answer
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setTimerId(id);

      return () => clearInterval(id);
    }
  }, [question, showAnswer, userSelection.index]);

  const handlePartSelect = (index) => {
    if (showAnswer || userSelection.index !== null) return; // Don't allow changes after selection or reveal

    clearInterval(timerId); // Stop the timer

    if (index === question.errorIndex) {
      setUserSelection({ index, status: 'correct' });
      // Automatically fetch next question after a short delay
      setTimeout(fetchQuestion, 1500);
    } else {
      setUserSelection({ index, status: 'incorrect' });
      setShowAnswer(true); // Show the correct answer because the user was wrong
    }
  };

  const getPartClassName = (index) => {
    let base = "w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 text-slate-300 ";

    if (!showAnswer && userSelection.index === null) {
      return base + "bg-slate-900 border-slate-800 hover:border-slate-600";
    }

    const isCorrectAnswer = index === question.errorIndex;
    const isSelected = index === userSelection.index;

    if (isCorrectAnswer) {
      return base + "bg-emerald-900/30 border-emerald-500 ring-1 ring-emerald-500";
    }
    if (isSelected && !isCorrectAnswer) {
      return base + "bg-red-900/30 border-red-500";
    }

    return base + "bg-slate-900 border-slate-800 opacity-60";
  };

  const speakExplanation = () => {
    if (!question) return;
    const text = explanationLang === 'en' ? question.explanation_en : question.explanation_hi;
    if (!text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = explanationLang === 'en' ? 'en-IN' : 'hi-IN';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FilePenLine className="w-5 h-5 text-emerald-500" />
          Error Detection Practice
        </h2>
      </div>

      {!question && !loading && (
        <div className="text-center py-16 space-y-4">
          <p className="text-slate-400">Press the button to start practicing error detection questions.</p>
          <button
            onClick={fetchQuestion}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg"
          >
            Start Practice
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-emerald-500 animate-pulse">Generating a tough question...</p>
        </div>
      )}

      {question && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500 font-mono">Identify the segment with the error:</p>
            <div className={`text-lg font-mono font-bold px-3 py-1 rounded ${timeLeft > 3 ? 'text-slate-400' : 'text-red-500 animate-pulse'}`}>
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-lg leading-relaxed text-slate-300">
            {question.sentence}
          </div>

          <div className="space-y-3 pt-2">
            {question.parts.map((part, index) => (
              <button key={index} onClick={() => handlePartSelect(index)} className={getPartClassName(index)}>
                <span className="font-mono text-xs text-slate-500">({String.fromCharCode(65 + index)})</span>
                <span>{part}</span>
              </button>
            ))}
            <button onClick={() => handlePartSelect(3)} className={getPartClassName(3)}>
              <span className="font-mono text-xs text-slate-500">(D)</span>
              <span>No Error</span>
            </button>
          </div>

          {showAnswer && (
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 relative overflow-hidden mt-6 animate-in fade-in">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                    Explanation
                  </p>
                  <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-800">
                    <button onClick={() => setExplanationLang('en')} className={`px-2 py-0.5 text-[10px] rounded-sm transition-colors ${explanationLang === 'en' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>EN</button>
                    <button onClick={() => setExplanationLang('hi')} className={`px-2 py-0.5 text-[10px] rounded-sm transition-colors ${explanationLang === 'hi' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>HI</button>
                  </div>
                </div>
                <button onClick={speakExplanation} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs">
                  <Volume2 size={14} />
                  <span>Listen</span>
                </button>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {explanationLang === 'en' ? question.explanation_en : question.explanation_hi}
              </p>
            </div>
          )}

          <div className="pt-4">
            <button
              onClick={fetchQuestion}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Next Question
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- VIEW: VOCABULARY BUILDER ---
const VocabularyView = ({ user, setView, setActiveTest }) => {
  const [currentVocab, setCurrentVocab] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('current'); // 'current' | 'history'

  useEffect(() => {
    const savedHistory = localStorage.getItem(`vocab_history_${user.uid}`);
    if (savedHistory) {
      try {
        const words = JSON.parse(savedHistory);
        if (!Array.isArray(words)) throw new Error("Saved vocabulary history is not a list.");
        setHistory(words);
      } catch (error) {
        console.error("Could not read saved vocabulary history:", error);
        alert("Saved vocabulary history could not be read. You can continue with a new word list.");
        setHistory([]);
      }
    }
  }, [user]);

  const fetchNewWords = async () => {
    setLoading(true);
    const systemPrompt = `You are an expert English teacher for SSC CGL exams.
    Generate 20 important, high-frequency vocabulary words.
    Format: Strictly a JSON Array of objects.
    Each object must have:
    - "word": The word (String)
    - "hindi": Hindi meaning (String)
    - "type": Part of speech (String)
    - "meaning": Short English definition (String)
    Example: [{"word": "Diligent", "hindi": "à¤®à¥‡à¤¹à¤¨à¤¤à¥€", "type": "Adj", "meaning": "Having or showing care and conscientiousness in one's work or duties."}]`;

    try {
      const rawText = await generateAIResponse("Give me 20 new words.", systemPrompt);
      const jsonMatch = rawText.match(/\[.*\]/s);
      const newWords = jsonMatch && safeJSONParse(jsonMatch[0]);
      if (!Array.isArray(newWords) || newWords.length === 0 || newWords.some(word => !word.word || !word.hindi || !word.meaning)) {
        throw new Error("AI returned an invalid vocabulary list. Please try again.");
      }
      setCurrentVocab(newWords);
      const updatedHistory = [...newWords, ...history];
      const uniqueHistory = updatedHistory.filter((word, index, words) =>
        words.findIndex(item => item.word.toLowerCase() === word.word.toLowerCase()) === index
      );
      setHistory(uniqueHistory);
      localStorage.setItem(`vocab_history_${user.uid}`, JSON.stringify(uniqueHistory));
    } catch (error) {
      console.error("Vocab Error:", error);
      alert(`Could not fetch vocabulary: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  const startHistoryTest = async () => {
    if (history.length === 0) return;
    setLoading(true);
    
    const wordList = history.map(h => h.word).join(", ");
    const qCount = history.length;

    const systemPrompt = `You are an SSC CGL Exam Setter.
    Create a Mock Test JSON based on these vocabulary words.
    Generate exactly ${qCount} questions (1 question for each word provided).
    Questions should test Synonyms, Antonyms, or Meanings.
    
    Format: Strictly a JSON Object with a "questions" array.
    Each question object:
    - id (number)
    - question_en (String)
    - options_en (Array of 4 strings)
    - correctIndex (0-3)
    - explanation_en (String)
    
    Return ONLY valid JSON.`;

    try {
      const rawText = await generateAIResponse(`Words: ${wordList}`, systemPrompt);
      const jsonMatch = rawText.match(/\{.*\}/s);
      const data = jsonMatch && safeJSONParse(jsonMatch[0]);
      if (!Array.isArray(data?.questions) || data.questions.length === 0 || !data.questions.every(isValidTestQuestion)) {
        throw new Error("AI returned an invalid revision test. Please try again.");
      }
      setActiveTest({
        title: `Vocab Revision: ${qCount} Words`,
        questions: data.questions,
        duration: Math.max(300, qCount * 60)
      });
      setView('test');
    } catch (e) {
      console.error(e);
      alert(`Could not generate the vocabulary test: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Languages className="w-5 h-5 text-violet-500" />
          Vocab Builder
        </h2>
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
          <button onClick={() => setViewMode('current')} className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'current' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>Daily</button>
          <button onClick={() => setViewMode('history')} className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'history' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>History</button>
        </div>
      </div>

      {viewMode === 'current' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center">
            <p className="text-slate-400 text-sm mb-4">Learn 20 new words daily to crack SSC CGL.</p>
            <button 
              onClick={fetchNewWords}
              disabled={loading}
              className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 mx-auto transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {currentVocab.length > 0 ? "Fetch More Words" : "Start Learning"}
            </button>
          </div>

          <div className="space-y-3">
            {currentVocab.map((item, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{item.word}</h3>
                    <button 
                      onClick={() => speak(item.word)}
                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-full transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded uppercase">{item.type}</span>
                </div>
                <p className="text-violet-400 font-bold text-sm mt-1">{item.hindi}</p>
                <p className="text-slate-400 text-xs mt-2 italic">"{item.meaning}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'history' && (
        <div className="space-y-3">
          {history.length > 0 && (
            <button 
              onClick={startHistoryTest}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg mb-4 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileQuestion className="w-4 h-4" />}
              Take Test on All {history.length} Words
            </button>
          )}
          {history.length === 0 ? (
            <div className="text-center text-slate-500 py-10">No history yet.</div>
          ) : (
            history.map((item, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col">
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{item.word}</span>
                    <button 
                      onClick={() => speak(item.word)}
                      className="p-1 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded-full transition-colors"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-violet-400 text-sm">{item.hindi}</span>
                </div>
                <span className="text-slate-500 text-xs mt-1">{item.meaning}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// --- VIEW: ANALYSIS ---
const AnalysisView = ({ user, userData, setView, setActiveVideo }) => {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), 
      orderBy('timestamp', 'desc'), 
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Session history sync error", error);
      alert("Could not load session history. Check your Firebase connection and permissions.");
    });
    return () => unsub();
  }, [user]);

  const runDeepAnalysis = async () => {
    setLoading(true);
    try {
      const contextData = {
        currentDiscipline: userData?.disciplineScore,
        targetHours: 7,
        weakAreas: userData?.weakSubjects,
        recentSessions: history.map(({ task, duration, breaches, type }) => ({ task, duration, breaches, type })),
      };
      const systemPrompt = `You are "The Sergeant", a strict AI analyst. Analyze this study data: ${JSON.stringify(contextData)}. Give practical, specific feedback. Be direct but encouraging.`;
      setAnalysis(await generateAIResponse("Analyze my performance.", systemPrompt));
    } catch (error) {
      console.error("Performance analysis failed:", error);
      alert(`Could not analyze your performance: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRewatch = (session) => {
    setActiveVideo({ id: session.videoId, url: session.videoUrl, title: session.task });
    setView('focus');
  };

  const handleDelete = async (sessionId) => {
    if (window.confirm("Are you sure you want to delete this history record?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', sessionId));
      } catch (error) {
        console.error("Session history deletion failed:", error);
        alert("Could not delete this session. Check your connection and permissions.");
      }
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Brain className="w-5 h-5 text-emerald-500" />
        Performance Analysis
      </h2>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {!analysis ? (
           <div className="text-center space-y-4">
             <BarChart2 className="w-12 h-12 text-slate-700 mx-auto" />
             <p className="text-slate-400 text-sm">AI Coach is ready to analyze your logs.</p>
             <button 
              onClick={runDeepAnalysis}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold text-sm"
             >
               {loading ? "ANALYZING..." : "RUN ANALYSIS"}
             </button>
           </div>
        ) : (
          <div className="space-y-4">
            <div className="prose prose-invert prose-sm">
              <p className="whitespace-pre-wrap leading-relaxed text-slate-300">{analysis}</p>
            </div>
            <button onClick={() => setAnalysis("")} className="text-xs text-slate-500 underline">Clear</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Discipline" value={`${userData?.disciplineScore}%`} sub="Target: 95%" color="emerald" />
        <StatCard label="Total Hrs" value={`${Math.round((userData?.totalHoursStudied || 0) * 10) / 10}`} sub="Lifetime" color="blue" />
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-800">
        <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-3 h-3" /> Session History
        </h3>
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-slate-500 text-xs italic">No sessions recorded yet.</p>
          ) : (
            history.map((session, idx) => (
              <div key={session.id || idx} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between group hover:border-slate-700 transition-colors">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm font-bold text-slate-200 truncate max-w-[200px]">{session.task}</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-2">
                    {new Date(session.timestamp).toLocaleDateString()} â€¢ {session.duration} mins
                    {session.videoId && <span className="text-emerald-500 flex items-center gap-1 bg-emerald-950/30 px-1.5 rounded"><Youtube className="w-3 h-3" /> Watched</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(session.videoId || session.videoUrl) && (
                    <div className="flex items-center gap-2">
                      <img 
                        src={session.videoId ? `https://img.youtube.com/vi/${session.videoId}/mqdefault.jpg` : "https://via.placeholder.com/120x68/000000/FFFFFF?text=No+Thumb"} 
                        alt={`Thumbnail for ${session.task}`} 
                        className="w-16 h-9 object-cover rounded border border-slate-800 opacity-80 hover:opacity-100 cursor-pointer"
                        onClick={() => handleRewatch(session)}
                      />
                    </div>
                  )}
                  <button 
                    onClick={() => handleDelete(session.id)} 
                    className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-950/30 rounded-full transition-colors"
                    title="Delete Record"
                    aria-label="Delete Session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, color }) => (
  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
    <p className="text-slate-500 text-[10px] uppercase font-bold">{label}</p>
    <p className={`text-xl font-bold ${color === 'emerald' ? 'text-emerald-500' : 'text-blue-500'} mt-1`}>{value}</p>
    <p className="text-slate-600 text-[10px] mt-1">{sub}</p>
  </div>
);

const NavBtn = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    className={`flex flex-col items-center gap-1 p-2 w-16 rounded-xl transition-all ${
      active ? 'text-emerald-400 bg-emerald-950/50' : 'text-slate-500 hover:text-slate-300'
    }`}
  >
    <Icon className={`w-5 h-5 ${active ? 'fill-current' : ''}`} />
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);
