import { useState, useEffect, useRef } from "react";
import SpinWheel from "./SpinWheel";
import type { SpinWheelRef } from "./SpinWheel";

type Tab = "home" | "predict" | "bracket" | "profile";
type Pick = "home" | "draw" | "away";

interface Game {
  gameId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  kickoff: string;
  status: "upcoming" | "live" | "finished";
  stage: string;
  isKnockout: boolean;
  teamsKnown: boolean;
  resolved: boolean;
  result?: string;
}

interface PredEntry {
  gameId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  kickoff: string;
  pick: string;
  result: string | null;
  outcome: "correct" | "wrong" | "pending";
}

interface Profile {
  userId: string;
  wtf: number;
  rank: number;
  rankType: string;
  referralCode: string;
  referralEarnings: number;
  canSpinToday: boolean;
  predHistory: PredEntry[];
}

const API = "https://withered-snow-677a.alinikoonahad.workers.dev";

const KNOCKOUT_STAGES = [
  { key: "ROUND_OF_16", label: "Round of 16", points: 500 },
  { key: "QUARTER_FINALS", label: "Quarter-Finals", points: 500 },
  { key: "SEMI_FINALS", label: "Semi-Finals", points: 500 },
  { key: "FINAL", label: "Final", points: 500 },
];

function getUserId(): string {
  let id = localStorage.getItem("wtf_uid");
  if (!id) {
    id = "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem("wtf_uid", id);
  }
  return id;
}

function secsToUTCMidnight(): number {
  const now = new Date();
  const mid = new Date();
  mid.setUTCHours(24, 0, 0, 0);
  return Math.floor((mid.getTime() - now.getTime()) / 1000);
}

function fmtCountdown(s: number): string {
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0")).join(":");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "UTC", timeZoneName: "short",
  });
}

function hasStarted(kickoff: string): boolean {
  return new Date(kickoff) <= new Date();
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "Group Stage", ROUND_OF_32: "Round of 32",
    ROUND_OF_16: "Round of 16", QUARTER_FINALS: "Quarter-Finals",
    SEMI_FINALS: "Semi-Finals", THIRD_PLACE: "Third Place", FINAL: "Final",
  };
  return map[stage] || stage;
}

function pickLabel(pick: string, home: string, away: string): string {
  if (pick === "home") return home;
  if (pick === "away") return away;
  return "Draw";
}

export default function App() {
  const UID = useRef(getUserId());
  const wheelRef = useRef<SpinWheelRef>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [games, setGames] = useState<Game[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preds, setPreds] = useState<Record<string, Pick>>({});
  const [bracket, setBracket] = useState<Record<string, Record<string, string>>>({});
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinErr, setSpinErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(secsToUTCMidnight());
  const [showPredHistory, setShowPredHistory] = useState(false);
  const [animatedCards, setAnimatedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setCountdown(secsToUTCMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { loadGames(); loadPreds(); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; color: string }[] = [];
    const colors = ["#00f5ff", "#bf00ff", "#ff006e", "#00ff9f"];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    let raf: number;
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  async function loadGames() {
    setLoadingGames(true);
    try {
      const r = await fetch(`${API}/api/games`);
      const d = await r.json();
      const list = Array.isArray(d) ? d : [];
      setGames(list);
      list.forEach((g: Game, i: number) => {
        setTimeout(() => {
          setAnimatedCards((prev) => new Set([...prev, g.gameId]));
        }, i * 60);
      });
    } catch {}
    setLoadingGames(false);
  }

  async function loadPreds() {
    try {
      const r = await fetch(`${API}/api/predictions?userId=${UID.current}`);
      const d = await r.json();
      if (d && typeof d === "object" && !d.error) setPreds(d);
    } catch {}
  }

  async function loadBracket() {
    try {
      const r = await fetch(`${API}/api/bracket?userId=${UID.current}`);
      const d = await r.json();
      if (d && typeof d === "object" && !d.error) setBracket(d);
    } catch {}
  }

  async function loadProfile() {
    setLoadingProfile(true);
    try {
      await fetch(`${API}/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: UID.current }),
      });
      const r = await fetch(`${API}/api/profile?userId=${UID.current}`);
      const d = await r.json();
      if (!d.error) setProfile(d);
    } catch {}
    setLoadingProfile(false);
  }

  async function submitPick(gameId: string, pick: Pick) {
    if (submitting) return;
    setSubmitting(gameId);
    try {
      const r = await fetch(`${API}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: UID.current, gameId, pick }),
      });
      const d = await r.json();
      if (d.success || d.error === "already_predicted") {
        setPreds((p) => ({ ...p, [gameId]: pick }));
      }
    } catch {}
    setSubmitting(null);
  }

  async function submitBracketPick(stage: string, gameId: string, teamName: string) {
    try {
      await fetch(`${API}/api/bracket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: UID.current, stage, gameId, pick: teamName }),
      });
      setBracket((prev) => ({
        ...prev,
        [stage]: { ...(prev[stage] || {}), [gameId]: teamName },
      }));
    } catch {}
  }

  function surprisePick(gameId: string) {
    const pick: Pick = Math.random() < 0.5 ? "home" : "away";
    submitPick(gameId, pick);
  }

  async function doSpin() {
    if (spinning || !profile?.canSpinToday) return;
    setSpinning(true);
    setSpinResult(null);
    setSpinErr("");
    try {
      const r = await fetch(`${API}/api/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: UID.current }),
      });
      const d = await r.json();
      if (d.error === "already_spun_today") {
        setSpinErr("Already spun today. Resets at 00:00 UTC.");
        setSpinning(false);
        return;
      }
      if (d.success) {
        wheelRef.current?.spin(d.rewardIndex);
        setTimeout(async () => {
          setSpinResult(d.reward);
          await loadProfile();
          setSpinning(false);
        }, 3400);
      } else { setSpinning(false); }
    } catch { setSpinning(false); }
  }

  function copyLink() {
    if (!profile) return;
    navigator.clipboard.writeText(`https://wtf-prediction.pages.dev?ref=${profile.referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function switchTab(t: Tab) {
    setTab(t);
    setSpinResult(null);
    setSpinErr("");
    setShowPredHistory(false);
    if (t === "home") { loadGames(); loadPreds(); }
    if (t === "predict") { if (games.length === 0) loadGames(); loadPreds(); }
    if (t === "bracket") { if (games.length === 0) loadGames(); loadBracket(); }
    if (t === "profile") loadProfile();
  }

  const liveGames = games.filter((g) => g.status === "live" && g.teamsKnown);
  const upcomingGames = games.filter((g) => g.status === "upcoming" && g.teamsKnown && !hasStarted(g.kickoff));
  const finishedGames = games.filter((g) => g.status === "finished" && g.teamsKnown).slice(-4).reverse();
  const predictable = upcomingGames.filter((g) => !hasStarted(g.kickoff));
  const next4 = upcomingGames.slice(0, 4);
  const future = upcomingGames.slice(4);

  function GameCard({ g, showPicks }: { g: Game; showPicks: boolean }) {
    const myPick = preds[g.gameId];
    const isLoading = submitting === g.gameId;
    const started = hasStarted(g.kickoff);
    const disabled = !!myPick || started || !!submitting;
    const visible = animatedCards.has(g.gameId);

    return (
      <div style={{ ...sx.card, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.4s ease, transform 0.4s ease" }}>
        <div style={sx.stageTag}>{stageLabel(g.stage)}</div>
        <div style={sx.matchRow}>
          <div style={sx.teamL}>
            <span style={sx.flag}>{g.homeFlag}</span>
            <span style={sx.tname}>{g.homeTeam}</span>
          </div>
          <div style={sx.vsBox}>
            <span style={sx.vs}>VS</span>
            {g.status === "live" && <span style={sx.live}>● LIVE</span>}
            {g.status === "finished" && <span style={sx.ft}>FT</span>}
          </div>
          <div style={sx.teamR}>
            <span style={sx.tname}>{g.awayTeam}</span>
            <span style={sx.flag}>{g.awayFlag}</span>
          </div>
        </div>
        <p style={sx.time}>🕐 {fmtDate(g.kickoff)}</p>
        {showPicks && (
          isLoading ? <p style={sx.loading}>⏳ Submitting...</p>
          : myPick ? <p style={sx.picked}>✅ {pickLabel(myPick, g.homeTeam, g.awayTeam)}</p>
          : !started ? (
            <>
              <div style={sx.picks}>
                <button style={sx.pickBtn} disabled={disabled} onClick={() => submitPick(g.gameId, "home")}>
                  {g.homeFlag} {g.homeTeam}
                </button>
                {g.isKnockout ? (
                  <button style={{ ...sx.pickBtn, ...sx.surpriseBtn }} disabled={disabled} onClick={() => surprisePick(g.gameId)}>
                    🎲 Surprise
                  </button>
                ) : (
                  <button style={{ ...sx.pickBtn, ...sx.drawBtn }} disabled={disabled} onClick={() => submitPick(g.gameId, "draw")}>
                    🤝 Draw
                  </button>
                )}
                <button style={sx.pickBtn} disabled={disabled} onClick={() => submitPick(g.gameId, "away")}>
                  {g.awayFlag} {g.awayTeam}
                </button>
              </div>
              <p style={sx.hint}>✨ Correct = 2,500 WTF</p>
            </>
          ) : <p style={{ ...sx.hint, color: "#555" }}>⏸ Predictions closed</p>
        )}
      </div>
    );
  }

  function BracketStage({ stageKey, label, stageGames }: { stageKey: string; label: string; stageGames: Game[] }) {
    const stagePicks = bracket[stageKey] || {};
    if (stageGames.length === 0) return null;
    return (
      <div style={sx.bracketStage}>
        <p style={sx.bracketStageTitle}>{label}</p>
        {stageGames.map((g) => {
          const pick = stagePicks[g.gameId];
          const started = hasStarted(g.kickoff);
          const bothKnown = g.teamsKnown;
          if (!bothKnown) return null;
          return (
            <div key={g.gameId} style={sx.bracketCard}>
              <p style={sx.bracketTime}>{fmtDate(g.kickoff)}</p>
              <div style={sx.bracketTeams}>
                <button
                  style={{
                    ...sx.bracketTeamBtn,
                    ...(pick === g.homeTeam ? sx.bracketSelected : {}),
                    opacity: started && pick !== g.homeTeam ? 0.4 : 1,
                  }}
                  disabled={started}
                  onClick={() => submitBracketPick(stageKey, g.gameId, g.homeTeam)}
                >
                  <span style={sx.bracketFlag}>{g.homeFlag}</span>
                  <span style={sx.bracketTeamName}>{g.homeTeam}</span>
                  {pick === g.homeTeam && <span style={sx.neonDot}>◆</span>}
                </button>
                <span style={sx.bracketVs}>VS</span>
                <button
                  style={{
                    ...sx.bracketTeamBtn,
                    ...(pick === g.awayTeam ? sx.bracketSelected : {}),
                    opacity: started && pick !== g.awayTeam ? 0.4 : 1,
                  }}
                  disabled={started}
                  onClick={() => submitBracketPick(stageKey, g.gameId, g.awayTeam)}
                >
                  {pick === g.awayTeam && <span style={sx.neonDot}>◆</span>}
                  <span style={sx.bracketTeamName}>{g.awayTeam}</span>
                  <span style={sx.bracketFlag}>{g.awayFlag}</span>
                </button>
              </div>
              {!pick && !started && <p style={{ ...sx.hint, marginTop: 6 }}>✨ Pick winner = 500 WTF if correct</p>}
              {pick && <p style={sx.bracketPicked}>🎯 Your pick: {pick}</p>}
              {started && !pick && <p style={{ ...sx.hint, color: "#555", marginTop: 6 }}>⏸ Locked</p>}
            </div>
          );
        })}
      </div>
    );
  }

  function renderHome() {
    if (loadingGames) return <p style={sx.center}>Loading matches...</p>;
    if (games.length === 0) return (
      <div style={sx.center}>
        <p style={{ color: "#555", marginBottom: 16 }}>No matches available</p>
        <button style={sx.btn} onClick={loadGames}>Reload</button>
      </div>
    );
    return (
      <div style={sx.list}>
        {liveGames.length > 0 && <><p style={sx.section}>🔴 In Progress</p>{liveGames.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}</>}
        {next4.length > 0 && <><p style={sx.section}>⚡ Coming Up</p>{next4.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}</>}
        {future.length > 0 && <><p style={sx.section}>📅 Upcoming</p>{future.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}</>}
        {finishedGames.length > 0 && <><p style={sx.section}>✅ Recent Results</p>{finishedGames.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}</>}
      </div>
    );
  }

  function renderPredict() {
    if (loadingGames) return <p style={sx.center}>Loading...</p>;
    if (predictable.length === 0) return <p style={sx.center}>No matches open for prediction right now.</p>;
    return <div style={sx.list}>{predictable.map((g) => <GameCard key={g.gameId} g={g} showPicks={true} />)}</div>;
  }

  function renderBracket() {
    if (loadingGames) return <p style={sx.center}>Loading bracket...</p>;
    const knockoutGames = games.filter((g) => g.isKnockout && g.teamsKnown);
    if (knockoutGames.length === 0) return <p style={sx.center}>Knockout bracket not available yet.</p>;

    return (
      <div>
        <div style={sx.bracketHeader}>
          <p style={sx.bracketTitle}>🏆 Champion Prediction</p>
          <p style={sx.bracketSub}>Pick the winner of each match to predict the champion. Earn 500 WTF for each correct pick!</p>
        </div>
        {KNOCKOUT_STAGES.map(({ key, label }) => {
          const stageGames = knockoutGames.filter((g) => g.stage === key);
          return <BracketStage key={key} stageKey={key} label={label} stageGames={stageGames} />;
        })}
      </div>
    );
  }

  function renderProfile() {
    if (loadingProfile) return <p style={sx.center}>Loading...</p>;
    if (!profile) return (
      <div style={sx.center}><button style={sx.btn} onClick={loadProfile}>Load Profile</button></div>
    );
    const correct = profile.predHistory.filter((p) => p.outcome === "correct").length;
    const total = profile.predHistory.filter((p) => p.outcome !== "pending").length;
    return (
      <div style={sx.profileWrap}>
        <div style={sx.statsRow}>
          <div style={sx.stat}>
            <p style={sx.statN}>{profile.wtf.toLocaleString()}</p>
            <p style={sx.statL}>💰 WTF Points</p>
          </div>
          <div style={sx.stat}>
            <p style={sx.statN}>#{profile.rank.toLocaleString()}</p>
            <p style={sx.statL}>🏆 Rank</p>
          </div>
        </div>
        {total > 0 && (
          <div style={sx.accuracyBox}>
            <span style={sx.accuracyText}>🎯 Accuracy: {correct}/{total} ({Math.round((correct / total) * 100)}%)</span>
          </div>
        )}
        <div style={sx.box}>
          <p style={sx.boxT}>🎰 Daily Spin</p>
          <SpinWheel ref={wheelRef} onDone={() => {}} />
          {spinErr && <p style={sx.err}>{spinErr}</p>}
          {spinResult && <p style={sx.ok}>🎉 You won {spinResult.toLocaleString()} WTF!</p>}
          <button style={{ ...sx.spinBtn, opacity: !profile.canSpinToday || spinning ? 0.4 : 1 }} disabled={!profile.canSpinToday || spinning} onClick={doSpin}>
            {spinning ? "Spinning..." : profile.canSpinToday ? "🎰 Spin Now!" : "⏰ Come back tomorrow"}
          </button>
          {!profile.canSpinToday && (
            <p style={sx.timer}>Next spin: <span style={{ color: "#00f5ff", fontWeight: "bold", fontFamily: "monospace" }}>{fmtCountdown(countdown)}</span> UTC</p>
          )}
        </div>
        {profile.predHistory.length > 0 && (
          <div style={sx.box}>
            <button style={sx.toggleBtn} onClick={() => setShowPredHistory(!showPredHistory)}>
              {showPredHistory ? "▲ Hide" : "▼ Show"} My Predictions ({profile.predHistory.length})
            </button>
            {showPredHistory && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {profile.predHistory.map((p) => (
                  <div key={p.gameId} style={{ ...sx.predRow, borderLeft: `3px solid ${p.outcome === "correct" ? "#00ff9f" : p.outcome === "wrong" ? "#ff006e" : "#333"}` }}>
                    <div style={sx.predTeams}>
                      <span>{p.homeFlag} {p.homeTeam}</span>
                      <span style={{ color: "#444", fontSize: 10 }}>VS</span>
                      <span>{p.awayTeam} {p.awayFlag}</span>
                    </div>
                    <div style={sx.predMeta}>
                      <span style={{ color: "#888", fontSize: 11 }}>Pick: <span style={{ color: "#00f5ff" }}>{pickLabel(p.pick, p.homeTeam, p.awayTeam)}</span></span>
                      {p.outcome === "correct" && <span style={{ color: "#00ff9f", fontSize: 11 }}>✅ +2,500</span>}
                      {p.outcome === "wrong" && <span style={{ color: "#ff006e", fontSize: 11 }}>❌ Wrong</span>}
                      {p.outcome === "pending" && <span style={{ color: "#555", fontSize: 11 }}>⏳ Pending</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={sx.box}>
          <p style={sx.boxT}>🔗 Referral</p>
          <p style={sx.boxS}>Earn 10% of daily points from everyone you invite</p>
          <div style={sx.refCode}>{profile.referralCode}</div>
          {profile.referralEarnings > 0 && (
            <p style={{ ...sx.boxS, color: "#00ff9f", marginBottom: 12 }}>💸 Earned: {profile.referralEarnings.toLocaleString()} WTF</p>
          )}
          <button style={sx.btn} onClick={copyLink}>{copied ? "✅ Copied!" : "📋 Copy Invite Link"}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={sx.root}>
      <div style={sx.headerWrap}>
        <canvas ref={canvasRef} style={sx.canvas} />
        <div style={sx.header}>
          <div>
            <span style={sx.hTitle}>⚽ WTF Prediction</span>
            <span style={sx.hBadge}>WORLD CUP 2026</span>
          </div>
          <div style={sx.hGlow} />
        </div>
      </div>
      <div style={sx.content}>
        {tab === "home" && renderHome()}
        {tab === "predict" && renderPredict()}
        {tab === "bracket" && renderBracket()}
        {tab === "profile" && renderProfile()}
      </div>
      <div style={sx.nav}>
        {([
          { key: "home", icon: "🏠", label: "Home" },
          { key: "predict", icon: "🎯", label: "Predict" },
          { key: "bracket", icon: "🏆", label: "Bracket" },
          { key: "profile", icon: "👤", label: "Profile" },
        ] as { key: Tab; icon: string; label: string }[]).map((t) => (
          <button key={t.key} style={{ ...sx.navBtn, ...(tab === t.key ? sx.navOn : {}) }} onClick={() => switchTab(t.key)}>
            {t.icon}<br />
            <span style={sx.navL}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const NEON_CYAN = "#00f5ff";
const NEON_PURPLE = "#bf00ff";
const NEON_GREEN = "#00ff9f";
const NEON_PINK = "#ff006e";
const BG_DARK = "#050510";
const BG_CARD = "#0a0a1a";
const BG_CARD2 = "#0d0d20";

const sx: Record<string, React.CSSProperties> = {
  root: { fontFamily: "'Inter','Courier New',monospace", background: BG_DARK, color: "#e0e0ff", minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", position: "relative" },
  headerWrap: { position: "relative", height: 72, overflow: "hidden" },
  canvas: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  header: { position: "relative", zIndex: 2, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${NEON_CYAN}33` },
  hTitle: { fontSize: 17, fontWeight: "bold", color: NEON_CYAN, textShadow: `0 0 12px ${NEON_CYAN}`, letterSpacing: 1 },
  hBadge: { display: "block", fontSize: 9, color: NEON_PURPLE, letterSpacing: 3, marginTop: 2, textShadow: `0 0 8px ${NEON_PURPLE}` },
  hGlow: { width: 8, height: 8, borderRadius: "50%", background: NEON_GREEN, boxShadow: `0 0 10px ${NEON_GREEN}`, animation: "pulse 2s infinite" },
  content: { flex: 1, overflowY: "auto", padding: "12px 16px 90px" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#08081888", backdropFilter: "blur(12px)", borderTop: `1px solid ${NEON_CYAN}22`, display: "flex", justifyContent: "space-around", padding: "8px 0" },
  navBtn: { background: "none", border: "none", color: "#444", fontSize: 20, cursor: "pointer", padding: "4px 12px", borderRadius: 8, textAlign: "center", transition: "color 0.2s" },
  navOn: { color: NEON_CYAN, textShadow: `0 0 10px ${NEON_CYAN}` },
  navL: { fontSize: 10, display: "block", marginTop: 2 },
  center: { textAlign: "center", marginTop: 60, color: "#444" },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  section: { color: NEON_CYAN, fontSize: 12, fontWeight: "bold", margin: "10px 0 6px", letterSpacing: 2, textTransform: "uppercase", textShadow: `0 0 8px ${NEON_CYAN}` },
  card: { background: BG_CARD, borderRadius: 14, padding: "14px 16px", border: `1px solid ${NEON_CYAN}18`, boxShadow: `0 0 20px ${NEON_CYAN}08, inset 0 1px 0 ${NEON_CYAN}10` },
  stageTag: { fontSize: 9, color: NEON_PURPLE + "88", marginBottom: 6, textTransform: "uppercase", letterSpacing: 2 },
  matchRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  teamL: { display: "flex", alignItems: "center", gap: 6, flex: 1 },
  teamR: { display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" },
  flag: { fontSize: 26 },
  tname: { fontSize: 12, fontWeight: "bold", color: "#c0c0e0" },
  vsBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  vs: { color: "#333", fontSize: 10, fontWeight: "bold", letterSpacing: 2 },
  time: { color: "#444", fontSize: 10, marginTop: 8, textAlign: "center", fontFamily: "monospace" },
  live: { background: NEON_PINK, color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: "bold", boxShadow: `0 0 8px ${NEON_PINK}` },
  ft: { background: "#111", color: "#555", fontSize: 9, padding: "2px 6px", borderRadius: 4 },
  picks: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  pickBtn: { flex: 1, background: BG_CARD2, border: `1px solid ${NEON_CYAN}22`, color: "#a0a0c0", borderRadius: 8, padding: "9px 4px", fontSize: 11, cursor: "pointer", minWidth: 80, transition: "all 0.2s" },
  drawBtn: { border: `1px solid ${NEON_GREEN}22`, color: NEON_GREEN + "88" },
  surpriseBtn: { border: `1px solid ${NEON_PURPLE}44`, color: NEON_PURPLE, boxShadow: `0 0 8px ${NEON_PURPLE}22` },
  picked: { color: NEON_GREEN, fontSize: 12, marginTop: 8, textAlign: "center", textShadow: `0 0 8px ${NEON_GREEN}` },
  loading: { color: NEON_CYAN, fontSize: 12, marginTop: 8, textAlign: "center" },
  hint: { color: "#333", fontSize: 10, marginTop: 6, textAlign: "center" },
  bracketHeader: { background: BG_CARD, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${NEON_PURPLE}33`, textAlign: "center" },
  bracketTitle: { color: NEON_PURPLE, fontSize: 16, fontWeight: "bold", margin: "0 0 6px", textShadow: `0 0 12px ${NEON_PURPLE}` },
  bracketSub: { color: "#555", fontSize: 11, margin: 0 },
  bracketStage: { marginBottom: 20 },
  bracketStageTitle: { color: NEON_CYAN, fontSize: 11, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", margin: "0 0 10px", textShadow: `0 0 8px ${NEON_CYAN}` },
  bracketCard: { background: BG_CARD, borderRadius: 12, padding: "12px 14px", marginBottom: 10, border: `1px solid ${NEON_PURPLE}18` },
  bracketTime: { color: "#444", fontSize: 10, fontFamily: "monospace", margin: "0 0 10px", textAlign: "center" },
  bracketTeams: { display: "flex", alignItems: "center", gap: 8 },
  bracketTeamBtn: { flex: 1, background: BG_CARD2, border: `1px solid #ffffff0a`, borderRadius: 10, padding: "10px 6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.25s", color: "#888" },
  bracketSelected: { background: `${NEON_PURPLE}15`, border: `1px solid ${NEON_PURPLE}`, boxShadow: `0 0 14px ${NEON_PURPLE}44`, color: "#e0e0ff" },
  bracketFlag: { fontSize: 22 },
  bracketTeamName: { fontSize: 11, fontWeight: "bold" },
  bracketVs: { color: "#333", fontSize: 10, fontWeight: "bold", letterSpacing: 2, flexShrink: 0 },
  bracketPicked: { color: NEON_PURPLE, fontSize: 11, marginTop: 8, textAlign: "center", textShadow: `0 0 8px ${NEON_PURPLE}` },
  neonDot: { color: NEON_PURPLE, fontSize: 8, textShadow: `0 0 6px ${NEON_PURPLE}` },
  profileWrap: { display: "flex", flexDirection: "column", gap: 16 },
  statsRow: { display: "flex", gap: 12 },
  stat: { flex: 1, background: BG_CARD, borderRadius: 12, padding: 16, textAlign: "center", border: `1px solid ${NEON_CYAN}18`, boxShadow: `0 0 20px ${NEON_CYAN}08` },
  statN: { fontSize: 24, fontWeight: "bold", color: NEON_CYAN, margin: 0, textShadow: `0 0 14px ${NEON_CYAN}`, fontFamily: "monospace" },
  statL: { fontSize: 11, color: "#444", margin: "4px 0 0" },
  accuracyBox: { background: BG_CARD, borderRadius: 10, padding: "10px 16px", border: `1px solid ${NEON_GREEN}22`, textAlign: "center" },
  accuracyText: { fontSize: 14, color: NEON_GREEN, fontWeight: "bold", textShadow: `0 0 8px ${NEON_GREEN}` },
  box: { background: BG_CARD, borderRadius: 14, padding: 16, border: `1px solid ${NEON_CYAN}12`, textAlign: "center" },
  boxT: { fontSize: 15, fontWeight: "bold", margin: "0 0 10px", color: "#c0c0e0" },
  boxS: { fontSize: 11, color: "#444", margin: "0 0 12px" },
  toggleBtn: { background: "none", border: `1px solid #ffffff0f`, color: "#555", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, width: "100%" },
  predRow: { background: BG_DARK, borderRadius: 8, padding: "10px 12px", textAlign: "left", display: "flex", flexDirection: "column", gap: 4 },
  predTeams: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#888" },
  predMeta: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  spinBtn: { background: `linear-gradient(135deg, ${NEON_CYAN}, ${NEON_PURPLE})`, border: "none", color: "#000", fontWeight: "bold", fontSize: 15, padding: "12px 32px", borderRadius: 10, cursor: "pointer", width: "100%", marginTop: 12, boxShadow: `0 0 20px ${NEON_CYAN}44` },
  err: { color: NEON_PINK, fontSize: 12, margin: "8px 0" },
  ok: { color: NEON_GREEN, fontSize: 14, margin: "8px 0", fontWeight: "bold", textShadow: `0 0 8px ${NEON_GREEN}` },
  timer: { fontSize: 12, color: "#444", marginTop: 8 },
  refCode: { background: BG_DARK, border: `1px dashed ${NEON_CYAN}44`, color: NEON_CYAN, fontFamily: "monospace", fontSize: 18, letterSpacing: 4, padding: "10px 0", borderRadius: 8, margin: "8px 0 12px", textShadow: `0 0 8px ${NEON_CYAN}` },
  btn: { background: BG_CARD2, border: `1px solid ${NEON_CYAN}22`, color: "#888", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
};
