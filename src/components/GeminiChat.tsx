import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Bot, User, Trash2, ArrowRight, Brain, Zap, MessageSquare } from "lucide-react";
import { Signal, BridgeConfig } from "../types";
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc } from "firebase/firestore";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  modelUsed?: string;
}

interface GeminiChatProps {
  config: BridgeConfig;
  signals: Signal[];
  userId: string | null;
}

export default function GeminiChat({ config, signals, userId }: GeminiChatProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    // Attempt local storage load
    const saved = localStorage.getItem(`gemini_chat_history_${userId || 'guest'}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [
      {
        role: "assistant",
        content: "Hi! I'm your Gowda Algo Trading Assistant. I can help you set up webhooks, format Pine Script alerts, optimize stop loss levels, or explain how our automated MT5 execution works. What would you like to build today?",
        timestamp: new Date().toISOString()
      }
    ];
  });
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"general" | "low-latency" | "high-thinking">("general");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist chat locally
  useEffect(() => {
    localStorage.setItem(`gemini_chat_history_${userId || 'guest'}`, JSON.stringify(messages));
    
    // Save to Firestore if user is authenticated
    if (userId && db) {
      const saveChatToFirestore = async () => {
        try {
          const userChatRef = doc(db, 'users', userId, 'chats', 'primary');
          await setDoc(userChatRef, {
            messages,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.warn("Failed to persist chat history to Firestore:", err);
        }
      };
      
      const debounceTimer = setTimeout(saveChatToFirestore, 1000);
      return () => clearTimeout(debounceTimer);
    }
  }, [messages, userId]);

  // Load chat from Firestore on user sign-in
  useEffect(() => {
    if (userId && db) {
      const loadChatFromFirestore = async () => {
        try {
          const userChatRef = doc(db, 'users', userId, 'chats', 'primary');
          const docSnap = await getDocs(query(collection(db, 'users', userId, 'chats'), limit(1)));
          if (!docSnap.empty) {
            const data = docSnap.docs[0].data();
            if (data && Array.isArray(data.messages)) {
              setMessages(data.messages);
            }
          }
        } catch (err) {
          console.warn("Failed to load chat history from Firestore:", err);
        }
      };
      loadChatFromFirestore();
    }
  }, [userId]);

  const handleSendMessage = async (textToSend?: string) => {
    const finalInput = (textToSend || input).trim();
    if (!finalInput || isLoading) return;

    if (!textToSend) {
      setInput("");
    }

    const userMsg: Message = {
      role: "user",
      content: finalInput,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalInput,
          history: updatedMessages.slice(-10), // Send last 10 messages for context
          mode: mode,
          bridgeState: {
            config,
            signalsCount: signals.length,
            recentSignals: signals.slice(0, 3)
          }
        })
      });

      let isOk = response.ok;
      let errorMsg = `HTTP error! status: ${response.status}`;
      let data;
      
      const text = await response.text().catch(() => "");
      try {
        if (text) {
          data = JSON.parse(text);
          if (!isOk && data.error) {
             errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
          }
        }
      } catch (e) {
        if (!isOk) {
          errorMsg = text || errorMsg;
        } else {
          throw new Error(`Invalid JSON response: ${text.substring(0, 50)}...`);
        }
      }

      if (!isOk) {
        throw new Error(errorMsg);
      }
      
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data?.reply || "I encountered an error generating a response.",
          timestamp: new Date().toISOString(),
          modelUsed: data?.modelUsed
        }
      ]);
    } catch (err: any) {
      console.error("Chat Error:", err);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `Failed to connect to the Gemini backend. ${err.message || 'Make sure your app server and GEMINI_API_KEY are configured properly.'}`,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your conversation history?")) {
      const initialMsg: Message = {
        role: "assistant",
        content: "Chat history cleared. I'm ready for new questions!",
        timestamp: new Date().toISOString()
      };
      setMessages([initialMsg]);
    }
  };

  const quickQuestions = [
    { label: "Connect TradingView alert", text: "Guide me step-by-step on how to configure a TradingView alert to trigger trades on MT5." },
    { label: "XAUUSD Pine Script", text: "Provide a complete TradingView Pine Script (v5) indicator template for Gold (XAUUSD) that sends buy and sell alert webhooks." },
    { label: "Explain Dynamic Risk Sizing", text: "How does the DynamicRisk lot sizing mode work? Explain the math based on my current settings." },
  ];

  return (
    <div className="flex flex-col h-[550px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-white/90 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg shadow-md shadow-blue-600/20">
            <Sparkles className="w-4 h-4 text-slate-900 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              Gemini Trading Copilot
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Step-by-step pine script, webhook & MT5 setup</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setMode("low-latency")}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition ${
              mode === "low-latency"
                ? "bg-blue-600/10 text-blue-600 border border-blue-600/20"
                : "text-slate-400 hover:text-slate-800"
            }`}
            title="Fast low-latency responses using gemini-3.1-flash-lite"
          >
            <Zap className="w-3 h-3" />
            <span>Fast</span>
          </button>
          
          <button
            onClick={() => setMode("general")}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition ${
              mode === "general"
                ? "bg-slate-50 text-blue-600 border border-slate-300"
                : "text-slate-400 hover:text-slate-800"
            }`}
            title="Balanced responses using gemini-3.5-flash"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Balanced</span>
          </button>

          <button
            onClick={() => setMode("high-thinking")}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition ${
              mode === "high-thinking"
                ? "bg-blue-600/10 text-blue-600 border border-blue-600/20"
                : "text-slate-400 hover:text-slate-800"
            }`}
            title="Deep thinking model for complex scripts using gemini-3.1-pro-preview"
          >
            <Brain className="w-3 h-3 animate-pulse" />
            <span>Think</span>
          </button>
        </div>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 max-w-[85%] ${
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === "user"
                  ? "bg-blue-700/20 border border-blue-600/30 text-blue-600"
                  : "bg-slate-50 border border-slate-300 text-blue-700"
              }`}
            >
              {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div className="space-y-1">
              <div
                className={`p-3 rounded-xl text-xs leading-relaxed font-sans ${
                  msg.role === "user"
                    ? "bg-blue-700 text-slate-900 rounded-tr-none"
                    : "bg-slate-50/80 text-slate-100 border border-slate-300/50 rounded-tl-none whitespace-pre-line"
                }`}
              >
                {msg.content}
              </div>
              <div className="flex items-center gap-2 justify-between px-1">
                <span className="text-[9px] text-slate-400 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.modelUsed && (
                  <span className="text-[9px] text-blue-600 bg-blue-600/5 px-1.5 py-0.5 rounded border border-blue-600/10 font-mono">
                    {msg.modelUsed}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 max-w-[80%]">
            <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-300 flex items-center justify-center animate-pulse text-blue-700">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 bg-slate-50/60 border border-slate-300/55 rounded-xl rounded-tl-none flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Actions */}
      {messages.length === 1 && (
        <div className="px-4 py-2 bg-white/30 border-t border-slate-200/40">
          <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wider">Quick Prompts</p>
          <div className="flex flex-col gap-1.5">
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(q.text);
                  handleSendMessage(q.text);
                }}
                className="flex items-center justify-between text-left px-3 py-2 bg-white/60 border border-slate-200/80 rounded-lg text-xs text-blue-700 hover:bg-slate-50 hover:border-blue-600/20 hover:text-slate-900 transition group"
              >
                <span>{q.label}</span>
                <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input controls */}
      <div className="p-3 bg-white border-t border-slate-200 flex flex-col gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition shrink-0"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "high-thinking" 
                ? "Asking Deep Thinking AI (Pro)..." 
                : mode === "low-latency"
                  ? "Asking Low-Latency AI (Lite)..."
                  : "Type a question or script request..."
            }
            disabled={isLoading}
            className="flex-1 bg-slate-50 text-slate-900 text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400"
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition disabled:bg-slate-50 disabled:text-slate-400"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
