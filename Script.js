/**
 * InterviewAI — AI Mock Interviewer
 * © 2025 Navesh R. All rights reserved.
 *
 * Powered by Claude API (Anthropic)
 * Features: Voice + Text input, Technical + HR questions, Score & Feedback
 */

// ── CONFIG ───────────────────────────────────────────────────────────────────
const MODEL       = "claude-sonnet-4-6";
const TOTAL_Q     = 8;

// ── STATE ────────────────────────────────────────────────────────────────────
let API_KEY       = "";
let selectedRole  = "Data Science";
let selectedType  = "both";
let currentQ      = 0;
let questions     = [];
let answers       = [];
let feedbacks     = [];
let isListening   = false;
let recognition   = null;
let isWaiting     = false;

// ── DOM ──────────────────────────────────────────────────────────────────────
const homeScreen      = document.getElementById("homeScreen");
const interviewScreen = document.getElementById("interviewScreen");
const resultsScreen   = document.getElementById("resultsScreen");
const startBtn        = document.getElementById("startBtn");
const endBtn          = document.getElementById("endBtn");
const restartBtn      = document.getElementById("restartBtn");
const newRoleBtn      = document.getElementById("newRoleBtn");
const apiKeyInput     = document.getElementById("apiKeyInput");
const answerInput     = document.getElementById("answerInput");
const submitBtn       = document.getElementById("submitBtn");
const micBtn          = document.getElementById("micBtn");
const chatArea        = document.getElementById("chatArea");
const thinkingMsg     = document.getElementById("thinkingMsg");
const voiceStatus     = document.getElementById("voiceStatus");
const progressFill    = document.getElementById("progressFill");
const qNum            = document.getElementById("qNum");
const headerRole      = document.getElementById("headerRole");
const aiAvatar        = document.getElementById("aiAvatar");
const scoreArc        = document.getElementById("scoreArc");
const scoreNum        = document.getElementById("scoreNum");
const scoreLabel      = document.getElementById("scoreLabel");
const scoreDesc       = document.getElementById("scoreDesc");
const resultsGrid     = document.getElementById("resultsGrid");
const overallFeedback = document.getElementById("overallFeedback");

// ── ROLE / TYPE BUTTONS ───────────────────────────────────────────────────────
document.querySelectorAll(".role-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedRole = btn.dataset.role;
  });
});

document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedType = btn.dataset.type;
  });
});

// ── START INTERVIEW ───────────────────────────────────────────────────────────
startBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) { alert("Please enter your Anthropic API key!"); return; }
  API_KEY = key;

  // Reset state
  currentQ = 0; questions = []; answers = []; feedbacks = [];
  chatArea.innerHTML = "";
  chatArea.appendChild(thinkingMsg);

  // Switch screen
  showScreen("interview");
  headerRole.textContent = `${selectedRole} Interview`;
  updateProgress();

  // Generate questions
  thinkingMsg.style.display = "flex";
  try {
    questions = await generateQuestions();
    thinkingMsg.style.display = "none";
    askQuestion(0);
  } catch (e) {
    thinkingMsg.style.display = "none";
    addAIMessage("Sorry, I couldn't connect to the AI. Please check your API key and try again.");
  }
});

// ── GENERATE QUESTIONS ────────────────────────────────────────────────────────
async function generateQuestions() {
  let typePrompt = "";
  if (selectedType === "technical") typePrompt = "All questions should be technical.";
  else if (selectedType === "hr") typePrompt = "All questions should be HR/behavioral.";
  else typePrompt = "Mix 5 technical and 3 HR/behavioral questions.";

  const prompt = `Generate exactly ${TOTAL_Q} interview questions for a ${selectedRole} role.
${typePrompt}
Questions should be realistic, varied in difficulty, and specific to ${selectedRole}.

Respond ONLY with a JSON array of strings. No markdown, no backticks, no explanation:
["question 1","question 2","question 3","question 4","question 5","question 6","question 7","question 8"]`;

  const res = await callClaude(prompt, 600);
  const clean = res.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Invalid response");
  return JSON.parse(clean.substring(start, end + 1));
}

// ── ASK QUESTION ─────────────────────────────────────────────────────────────
function askQuestion(index) {
  if (index >= questions.length) { endInterview(); return; }
  currentQ = index;
  qNum.textContent = index + 1;
  updateProgress();

  const q = questions[index];
  const tag = getQuestionTag(index);

  addAIMessage(`<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${tag.bg};color:${tag.color};margin-bottom:8px">${tag.label}</span><br>${q}`);
  aiAvatar.classList.add("talking");
  setTimeout(() => aiAvatar.classList.remove("talking"), 1500);

  submitBtn.disabled = false;
  answerInput.disabled = false;
  answerInput.value = "";
  answerInput.focus();
}

function getQuestionTag(index) {
  if (selectedType === "hr") return { label: "HR", bg: "#60A5FA18", color: "#60A5FA" };
  if (selectedType === "technical") return { label: "TECHNICAL", bg: "#6EE7B718", color: "#6EE7B7" };
  // Both: first 5 technical, last 3 HR
  if (index < 5) return { label: "TECHNICAL", bg: "#6EE7B718", color: "#6EE7B7" };
  return { label: "HR", bg: "#60A5FA18", color: "#60A5FA" };
}

// ── SUBMIT ANSWER ─────────────────────────────────────────────────────────────
submitBtn.addEventListener("click", submitAnswer);

answerInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnswer(); }
});

async function submitAnswer() {
  const answer = answerInput.value.trim();
  if (!answer || isWaiting) return;

  addUserMessage(answer);
  answers.push(answer);
  answerInput.value = "";
  answerInput.style.height = "auto";
  submitBtn.disabled = true;
  answerInput.disabled = true;
  isWaiting = true;

  // Show thinking
  thinkingMsg.style.display = "flex";

  try {
    const feedback = await evaluateAnswer(questions[currentQ], answer);
    feedbacks.push(feedback);
    thinkingMsg.style.display = "none";

    // Show feedback
    addFeedbackBubble(feedback);

    // Next question after delay
    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        askQuestion(currentQ + 1);
      } else {
        endInterview();
      }
      isWaiting = false;
    }, 1800);

  } catch (e) {
    thinkingMsg.style.display = "none";
    feedbacks.push({ score: 5, feedback: "Could not evaluate. Moving on.", tip: "" });
    setTimeout(() => {
      if (currentQ + 1 < questions.length) askQuestion(currentQ + 1);
      else endInterview();
      isWaiting = false;
    }, 1000);
  }
}

// ── EVALUATE ANSWER ───────────────────────────────────────────────────────────
async function evaluateAnswer(question, answer) {
  const prompt = `You are an expert ${selectedRole} interviewer. Evaluate this answer briefly.

Question: ${question}
Answer: ${answer}

Respond ONLY with JSON (no markdown, no backticks):
{"score":7,"feedback":"2 sentence evaluation","tip":"1 sentence improvement tip"}

Score 1-10. Be honest and constructive.`;

  const res = await callClaude(prompt, 300);
  let clean = res.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);

  try {
    return JSON.parse(clean);
  } catch {
    return { score: 6, feedback: "Good attempt. Keep practicing.", tip: "Be more specific with examples." };
  }
}

// ── END INTERVIEW ─────────────────────────────────────────────────────────────
endBtn.addEventListener("click", () => {
  if (confirm("End interview early?")) endInterview();
});

async function endInterview() {
  showScreen("results");

  const avg = feedbacks.length
    ? Math.round(feedbacks.reduce((a, b) => a + b.score, 0) / feedbacks.length)
    : 0;

  // Animate score
  animateScore(avg);

  // Score label
  if (avg >= 8) { scoreLabel.textContent = "Excellent Performance! 🎉"; scoreDesc.textContent = "You're well-prepared for this role."; }
  else if (avg >= 6) { scoreLabel.textContent = "Good Performance! 👍"; scoreDesc.textContent = "A few areas to polish before the big day."; }
  else { scoreLabel.textContent = "Keep Practicing! 💪"; scoreDesc.textContent = "Review the feedback and try again."; }

  // Results cards
  resultsGrid.innerHTML = "";
  questions.forEach((q, i) => {
    const fb = feedbacks[i];
    if (!fb) return;
    const scoreClass = fb.score >= 8 ? "good" : fb.score >= 6 ? "mid" : "low";
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="rc-top">
        <p class="rc-q"><strong>Q${i + 1}:</strong> ${q}</p>
        <span class="rc-score ${scoreClass}">${fb.score}/10</span>
      </div>
      <p class="rc-fb">${fb.feedback}${fb.tip ? ` <em style="color:#6EE7B7">💡 ${fb.tip}</em>` : ""}</p>
    `;
    resultsGrid.appendChild(card);
  });

  // Overall AI feedback
  if (feedbacks.length > 0) {
    overallFeedback.innerHTML = `<h3>🤖 Overall Assessment</h3><p style="color:var(--muted);font-size:13px">Generating final feedback…</p>`;
    try {
      const overall = await getOverallFeedback(avg);
      overallFeedback.innerHTML = `<h3>🤖 Overall Assessment</h3><p>${overall}</p>`;
    } catch {
      overallFeedback.innerHTML = `<h3>🤖 Overall Assessment</h3><p>You scored ${avg}/10 overall. Keep practicing to improve your interview skills!</p>`;
    }
  }
}

async function getOverallFeedback(avg) {
  const summary = feedbacks.map((f, i) => `Q${i+1}: ${f.score}/10 - ${f.feedback}`).join("\n");
  const prompt = `Based on this ${selectedRole} interview performance (avg ${avg}/10), give 2-3 sentence overall feedback and top advice. Be encouraging but honest.

Performance summary:
${summary}

Respond with plain text only, no JSON, no markdown.`;

  return await callClaude(prompt, 200);
}

// ── SCORE ANIMATION ───────────────────────────────────────────────────────────
function animateScore(target) {
  const circumference = 326.7;
  let current = 0;
  const step = target / 40;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    scoreNum.textContent = Math.round(current);
    const offset = circumference - (current / 10) * circumference;
    scoreArc.style.strokeDashoffset = offset;
    if (current >= target) clearInterval(timer);
  }, 30);
}

// ── VOICE INPUT ───────────────────────────────────────────────────────────────
micBtn.addEventListener("click", toggleVoice);

function toggleVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("Voice input not supported in this browser. Please use Chrome.");
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add("listening");
    voiceStatus.style.display = "flex";
  };

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript).join("");
    answerInput.value = transcript;
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove("listening");
    voiceStatus.style.display = "none";
  };

  recognition.onerror = () => {
    isListening = false;
    micBtn.classList.remove("listening");
    voiceStatus.style.display = "none";
  };

  recognition.start();
}

// ── RESTART / NEW ROLE ────────────────────────────────────────────────────────
restartBtn.addEventListener("click", () => {
  showScreen("interview");
  currentQ = 0; questions = []; answers = []; feedbacks = [];
  chatArea.innerHTML = "";
  chatArea.appendChild(thinkingMsg);
  updateProgress();
  thinkingMsg.style.display = "flex";
  generateQuestions().then(qs => {
    questions = qs;
    thinkingMsg.style.display = "none";
    askQuestion(0);
  }).catch(() => {
    thinkingMsg.style.display = "none";
    addAIMessage("Connection error. Please check your API key.");
  });
});

newRoleBtn.addEventListener("click", () => showScreen("home"));

// ── CLAUDE API ────────────────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 500) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "API error " + response.status);
  }

  const data = await response.json();
  return data.content?.map(b => b.text || "").join("") || "";
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function addAIMessage(html) {
  const msg = document.createElement("div");
  msg.className = "msg ai";
  msg.innerHTML = `
    <div class="msg-avatar">
      <svg viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="12" r="5" fill="#6EE7B7" opacity="0.9"/>
        <path d="M6 26c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#6EE7B7" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
        <circle cx="16" cy="16" r="2" fill="#6EE7B7"/>
      </svg>
    </div>
    <div class="msg-bubble">${html}</div>
  `;
  chatArea.insertBefore(msg, thinkingMsg);
  scrollChat();
}

function addUserMessage(text) {
  const msg = document.createElement("div");
  msg.className = "msg user";
  msg.innerHTML = `
    <div class="msg-avatar">N</div>
    <div class="msg-bubble">${escHtml(text)}</div>
  `;
  chatArea.insertBefore(msg, thinkingMsg);
  scrollChat();
}

function addFeedbackBubble(fb) {
  const scoreClass = fb.score >= 8 ? "var(--green)" : fb.score >= 6 ? "var(--amber)" : "var(--rose)";
  const div = document.createElement("div");
  div.className = "feedback-bubble";
  div.style.borderLeftColor = scoreClass;
  div.innerHTML = `
    <div class="fb-score" style="color:${scoreClass}">Score: ${fb.score}/10</div>
    <p>${fb.feedback}</p>
    ${fb.tip ? `<p style="margin-top:6px;color:var(--green)">💡 ${fb.tip}</p>` : ""}
  `;
  chatArea.insertBefore(div, thinkingMsg);
  scrollChat();
}

function scrollChat() { chatArea.scrollTop = chatArea.scrollHeight; }

function escHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function updateProgress() {
  const pct = (currentQ / TOTAL_Q) * 100;
  progressFill.style.width = pct + "%";
}

function showScreen(name) {
  homeScreen.classList.remove("active");
  interviewScreen.classList.remove("active");
  resultsScreen.classList.remove("active");
  if (name === "home") homeScreen.classList.add("active");
  else if (name === "interview") interviewScreen.classList.add("active");
  else if (name === "results") resultsScreen.classList.add("active");
}

// Auto-resize textarea
answerInput.addEventListener("input", () => {
  answerInput.style.height = "auto";
  answerInput.style.height = Math.min(answerInput.scrollHeight, 140) + "px";
});
