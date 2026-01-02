import React, { useState, useEffect, useRef, useMemo } from 'react';
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);
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
const generateAIResponse = async (prompt, systemInstruction) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        }),
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "System Error: AI Unreachable.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Connection failed. Manual planning required.";
  }
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

  // Firestore Refs
  const userRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
  const scheduleRef = doc(db, 'artifacts', appId, 'users', user.uid, 'schedules', new Date().toISOString().split('T')[0]);

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
        setDoc(userRef, initData);
      }
    }, (err) => console.error("User sync error", err));

    const unsubSchedule = onSnapshot(scheduleRef, (docSnap) => {
      if (docSnap.exists()) {
        setTodaySchedule(docSnap.data());
      } else {
        setTodaySchedule(null);
      }
      setLoading(false);
    }, (err) => console.error("Schedule sync error", err));

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
      if (jsonMatch) {
        const plan = safeJSONParse(jsonMatch[0]); 
        if (plan) {
            await setDoc(scheduleRef, {
            date: new Date().toISOString(),
            blocks: plan.map(p => ({...p, status: 'pending'})),
            totalMinutesDone: 0,
            targetMinutes: plan.reduce((acc, curr) => acc + curr.duration_min, 0)
            });
        } else {
            alert("AI returned invalid JSON. Please try again.");
        }
      } else {
        alert("AI Planning Failed. Try again.");
      }
    } catch (e) {
      console.error(e);
      alert("Planning Error. Check console.");
    }
    setGenerating(false);
  };

  const renderView = () => {
    switch(view) {
      case 'dashboard': return <HomeView user={user} userData={userData} todaySchedule={todaySchedule} setView={setView} scheduleRef={scheduleRef} setActiveTaskIndex={setActiveTaskIndex} handleGeneratePlan={handleGeneratePlan} generating={generating} />;
      case 'library': return <LibraryView user={user} setView={setView} setActiveTest={setActiveTest} />;
      case 'focus': return <FocusMode user={user} scheduleRef={scheduleRef} todaySchedule={todaySchedule} setView={setView} userData={userData} userRef={userRef} activeVideo={activeVideo} setActiveVideo={setActiveVideo} activeTaskIndex={activeTaskIndex} setActiveTaskIndex={setActiveTaskIndex} handleGeneratePlan={handleGeneratePlan} generating={generating} />;
      case 'test': return <TestMode user={user} activeTest={activeTest} setView={setView} userRef={userRef} />;
      case 'analysis': return <AnalysisView user={user} userData={userData} setView={setView} setActiveVideo={setActiveVideo} />;
      case 'vocabulary': return <VocabularyView user={user} setView={setView} setActiveTest={setActiveTest} />;
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
  const fileInputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'materials'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMaterials(snap.docs.map(d => ({id: d.id, ...d.data()})));
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewMaterial({
        ...newMaterial,
        title: file.name,
        // We store a marker for AI to know it's a file simulation
        content: `[FILE_UPLOADED_BY_USER: ${file.name}]\n[NOTE: This is a placeholder for a local file. Generate a test based on the TITLE and implied Topic.]`,
        type: 'pdf'
      });
    }
  };

  const handleCreateTest = async (material) => {
    setGeneratingTest(material.id);
    setAiStatus("Scanning Document...");
    
    // Simulate reading time
    await new Promise(r => setTimeout(r, 1500));
    setAiStatus("Analyzing Key Concepts...");
    await new Promise(r => setTimeout(r, 1500));
    setAiStatus("Generating Question Bank...");

    const isSimulation = material.content.includes("[FILE_UPLOADED_BY_USER");
    
    // Smart Prompting for File Simulation
    let contextPrompt = "";
    if (isSimulation) {
      contextPrompt = `The user uploaded a file named "${material.title}". Since I cannot read local files directly, assume the content matches the title. Generate a relevant, tough SSC CGL level mock test based on the topic implied by the filename "${material.title}".`;
    } else {
      contextPrompt = `Analyze the ENTIRE text provided below and create a comprehensive mock test. Do not limit questions to the beginning. Ensure questions cover the start, middle, and end of the content.\n\nTitle: ${material.title}\n\nFull Content:\n${material.content.substring(0, 20000)}`;
    }
    
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
        
        if (testData && testData.questions) {
          const formattedTest = {
            title: `Mock Test: ${material.title}`,
            questions: testData.questions || [],
            duration: 10 * 60, 
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
      alert("AI Error during test generation.");
    }
    setGeneratingTest(null);
    setAiStatus("");
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
                <span className="text-emerald-500/50">AI Will Analyze Topic from Filename</span>
              </p>
              
              {!newMaterial.title ? (
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
              disabled={isSaving}
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

  useEffect(() => {
    if (isSubmitted) return;

    let interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitted) {
        setBreaches(prev => prev + 1);
        updateDoc(userRef, { disciplineScore: increment(-5) });
        alert("WARNING: Test Discipline Breach! -5 Score.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSubmitted, userRef]);

  if (!activeTest) return <div className="p-8">Error loading test.</div>;

  const currentQ = activeTest.questions[currentQIndex];

  const handleOptionSelect = (optIndex) => {
    if (isSubmitted) return;
    setResponses(prev => ({ ...prev, [currentQIndex]: optIndex }));
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    let rawScore = 0;
    activeTest.questions.forEach((q, idx) => {
      if (responses[idx] === q.correctIndex) rawScore++;
    });
    setScore(rawScore);
    
    const sessionRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'test_results'));
    setDoc(sessionRef, {
      testTitle: activeTest.title,
      score: rawScore,
      total: activeTest.questions.length,
      breaches: breaches,
      timestamp: new Date().toISOString()
    });
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
              {language === 'en' ? 'English' : 'हिंदी'}
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
                  {currentQ.question}
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
        updateDoc(userRef, { disciplineScore: increment(-2) });
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
    if (!currentTask) return;
    
    // Calculate actual time spent (in case of early finish)
    // Use initialDuration to ensure accurate tracking for dynamic video lengths
    const spentSeconds = initialDuration - timeLeft;
    const spentMinutes = Math.max(1, Math.floor(spentSeconds / 60));

    // SAFETY CHECK: Ensure video ID is captured even if state was slightly off
    let finalVideoId = embeddedVideo;
    if (!finalVideoId && youtubeLink) {
        finalVideoId = getYoutubeId(youtubeLink);
    }

    // 1. Update User Global Stats (Total Hours & Discipline)
    const userUpdates = {
      totalHoursStudied: increment(spentMinutes / 60)
    };
    
    // PENALTY CHECK: If user quits with significant time left (> 1 min)
    if (timeLeft > 60) {
      userUpdates.disciplineScore = increment(-5); // Penalty for early exit
      alert("⚠️ DISCIPLINE PENALTY: Session abandoned early! (-5 Points)");
    } else if (breaches === 0) {
      userUpdates.disciplineScore = increment(1);
    }
    await updateDoc(userRef, userUpdates);

    // 2. Update Daily Schedule (if exists)
    if (todaySchedule) {
      const scheduleUpdates = { totalMinutesDone: increment(spentMinutes) };
      
      // Only update block status if it's a Scheduled Task (not Custom/AdHoc)
      if (!currentTask.isAdHoc && activeTaskIndex !== null) {
        const newBlocks = [...blocks];
        const block = newBlocks[activeTaskIndex];
        
        // Accumulate time
        const previousDone = block.completed_min || 0;
        const newDone = previousDone + spentMinutes;
        block.completed_min = newDone;

        // Only mark completed if actual time spent >= target duration
        if (newDone >= block.duration_min) {
          block.status = 'completed';
        }
        
        scheduleUpdates.blocks = newBlocks;
      }
      await updateDoc(scheduleRef, scheduleUpdates);
    }
    const sessionRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'));
    await setDoc(sessionRef, {
      task: currentTask.title,
      duration: spentMinutes,
      breaches: breaches,
      timestamp: new Date().toISOString(),
      type: currentTask.type,
      videoId: finalVideoId || null,
      videoUrl: youtubeLink || null 
    });
    if (setActiveVideo) setActiveVideo(null);
    setView('dashboard');
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
            ⚠️ DISCIPLINE BREACH DETECTED: {breaches} | SCORE PENALIZED
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

// --- VIEW: VOCABULARY BUILDER ---
const VocabularyView = ({ user, setView, setActiveTest }) => {
  const [currentVocab, setCurrentVocab] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('current'); // 'current' | 'history'

  useEffect(() => {
    const savedHistory = localStorage.getItem(`vocab_history_${user.uid}`);
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
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
    Example: [{"word": "Diligent", "hindi": "मेहनती", "type": "Adj", "meaning": "Having or showing care and conscientiousness in one's work or duties."}]`;

    try {
      const rawText = await generateAIResponse("Give me 20 new words.", systemPrompt);
      const jsonMatch = rawText.match(/\[.*\]/s);
      if (jsonMatch) {
        const newWords = safeJSONParse(jsonMatch[0]);
        if (newWords && Array.isArray(newWords)) {
          setCurrentVocab(newWords);
          
          // Update History
          const updatedHistory = [...newWords, ...history];
          // Remove duplicates based on 'word'
          const uniqueHistory = updatedHistory.filter((v,i,a)=>a.findIndex(t=>(t.word.toLowerCase() === v.word.toLowerCase()))===i);
          
          setHistory(uniqueHistory);
          localStorage.setItem(`vocab_history_${user.uid}`, JSON.stringify(uniqueHistory));
        }
      }
    } catch (error) {
      console.error("Vocab Error:", error);
      alert("Failed to fetch words. Try again.");
    }
    setLoading(false);
  };

  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
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
      if (jsonMatch) {
        const data = safeJSONParse(jsonMatch[0]);
        if (data && data.questions) {
          setActiveTest({
            title: `Vocab Revision: ${qCount} Words`,
            questions: data.questions,
            duration: Math.max(300, qCount * 60) // 1 min per question or min 5 mins
          });
          setView('test');
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate test.");
    }
    setLoading(false);
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
    });
    return () => unsub();
  }, [user]);

  const runDeepAnalysis = async () => {
    setLoading(true);
    const contextData = {
      currentDiscipline: userData?.disciplineScore,
      targetHours: 7,
      weakAreas: userData?.weakSubjects,
    };
    const systemPrompt = `You are "The Sergeant", a strict AI analyst. Analyze: ${JSON.stringify(contextData)}. Be brutal but encouraging.`;
    const result = await generateAIResponse("Analyze my performance.", systemPrompt);
    setAnalysis(result);
    setLoading(false);
  };

  const handleRewatch = (session) => {
    setActiveVideo({ id: session.videoId, url: session.videoUrl, title: session.task });
    setView('focus');
  };

  const handleDelete = async (sessionId) => {
    if (window.confirm("Are you sure you want to delete this history record?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', sessionId));
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
                    {new Date(session.timestamp).toLocaleDateString()} • {session.duration} mins
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
    <p className={`text-xl font-bold text-${color}-500 mt-1`}>{value}</p>
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