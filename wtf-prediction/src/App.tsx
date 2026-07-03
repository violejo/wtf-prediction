import { useState, useEffect, useRef } from "react";
import SpinWheel from "./SpinWheel";
import type { SpinWheelRef } from "./SpinWheel";

type Tab = "home" | "predict" | "profile";
type Pick = "home" | "away";

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

interface Profile {
  userId: string;
  wtf: number;
  rank: number;
  rankType: string;
  referralCode: string;
  referralEarnings: number;
  canSpinToday: boolean;
}

const API = "https://withered-snow-677a.alinikoonahad.workers.dev";

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
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
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
    GROUP_STAGE: "Group Stage",
    ROUND_OF_32: "Round of 32",
    ROUND_OF_16: "Round of 16",
    QUARTER_FINALS: "Quarter-Finals",
    SEMI_FINALS: "Semi-Finals",
    THIRD_PLACE: "Third Place",
    FINAL: "Final",
  };
  return map[stage] || stage;
}

export default function App() {
  const UID = useRef(getUserId());
  const wheelRef = useRef<SpinWheelRef>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [games, setGames] = useState<Game[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preds, setPreds] = useState<Record<string, Pick>>({});
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinErr, setSpinErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(secsToUTCMidnight());

  useEffect(() => {
    const t = setInterval(() => setCountdown(secsToUTCMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { loadGames(); loadPreds(); }, []);

  async function loadGames() {
    setLoadingGames(true);
    try {
      const r = await fetch(`${API}/api/games`);
      const d = await r.json();
      setGames(Array.isArray(d) ? d : []);
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
      } else {
        setSpinning(false);
      }
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
    if (t === "home") { loadGames(); loadPreds(); }
    if (t === "predict") { if (games.length === 0) loadGames(); loadPreds(); }
    if (t === "profile") loadProfile();
  }

  const liveGames = games.filter((g) => g.status === "live" && g.teamsKnown);
  const upcomingGames = games.filter((g) => g.status === "upcoming" && g.teamsKnown && !hasStarted(g.kickoff));
  const finishedGames = games.filter((g) => g.status === "finished" && g.teamsKnown).slice(-4).reverse();
  const predictable = [...liveGames, ...upcomingGames].filter((g) => !hasStarted(g.kickoff));
  const next4 = upcomingGames.slice(0, 4);
  const future = upcomingGames.slice(4);

  function GameCard({ g, showPicks }: { g: Game; showPicks: boolean }) {
    const myPick = preds[g.gameId];
    const isLoading = submitting === g.gameId;
    const started = hasStarted(g.kickoff);
    const disabled = !!myPick || started || !!submitting;

    return (
      <div style={sx.card}>
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
          isLoading ? (
            <p style={sx.loading}>⏳ Submitting...</p>
          ) : myPick ? (
            <p style={sx.picked}>
              ✅ {myPick === "home" ? g.homeTeam : g.awayTeam}
            </p>
          ) : !started ? (
            <>
              <div style={sx.picks}>
                <button style={sx.pickBtn} disabled={disabled}
                  onClick={() => submitPick(g.gameId, "home")}>
                  {g.homeFlag} {g.homeTeam}
                </button>
                {!g.isKnockout && (
                  <button style={{ ...sx.pickBtn, ...sx.drawBtn }} disabled={disabled}
                    onClick={() => submitPick(g.gameId, "away")}>
                    🤝 Draw
                  </button>
                )}
                <button style={sx.pickBtn} disabled={disabled}
                  onClick={() => submitPick(g.gameId, "away")}>
                  {g.awayFlag} {g.awayTeam}
                </button>
              </div>
              <p style={sx.hint}>✨ Correct = 2,500 WTF</p>
            </>
          ) : (
            <p style={{ ...sx.hint, color: "#888" }}>⏸ Match started — predictions closed</p>
          )
        )}
      </div>
    );
  }

  function renderHome() {
    if (loadingGames) return <p style={sx.center}>Loading matches...</p>;
    if (games.length === 0) return (
      <div style={sx.center}>
        <p style={{ color: "#aaa", marginBottom: 16 }}>No matches available</p>
        <button style={sx.btn} onClick={loadGames}>Reload</button>
      </div>
    );
    return (
      <div style={sx.list}>
        {liveGames.length > 0 && <>
          <p style={sx.section}>🔴 In Progress</p>
          {liveGames.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}
        </>}
        {next4.length > 0 && <>
          <p style={sx.section}>⏰ Coming Up</p>
          {next4.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}
        </>}
        {future.length > 0 && <>
          <p style={sx.section}>📅 Upcoming</p>
          {future.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}
        </>}
        {finishedGames.length > 0 && <>
          <p style={sx.section}>✅ Recent Results</p>
          {finishedGames.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}
        </>}
      </div>
    );
  }

  function renderPredict() {
    if (loadingGames) return <p style={sx.center}>Loading...</p>;
    if (predictable.length === 0) return (
      <p style={sx.center}>No matches open for prediction right now.</p>
    );
    return (
      <div style={sx.list}>
        {predictable.map((g) => <GameCard key={g.gameId} g={g} showPicks={true} />)}
      </div>
    );
  }

  function renderProfile() {
    if (loadingProfile) return <p style={sx.center}>Loading...</p>;
    if (!profile) return (
      <div style={sx.center}>
        <button style={sx.btn} onClick={loadProfile}>Load Profile</button>
      </div>
    );
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

        <div style={sx.box}>
          <p style={sx.boxT}>🎰 Daily Spin</p>
          <SpinWheel ref={wheelRef} onDone={() => {}} />
          {spinErr && <p style={sx.err}>{spinErr}</p>}
          {spinResult && <p style={sx.ok}>🎉 You won {spinResult.toLocaleString()} WTF!</p>}
          <button
            style={{ ...sx.spinBtn, opacity: !profile.canSpinToday || spinning ? 0.5 : 1 }}
            disabled={!profile.canSpinToday || spinning}
            onClick={doSpin}
          >
            {spinning ? "Spinning..." : profile.canSpinToday ? "🎰 Spin Now!" : "⏰ Come back tomorrow"}
          </button>
          {!profile.canSpinToday && (
            <p style={sx.timer}>
              Next spin: <span style={{ color: "#f0c040", fontWeight: "bold" }}>{fmtCountdown(countdown)}</span> UTC
            </p>
          )}
        </div>

        <div style={sx.box}>
          <p style={sx.boxT}>🔗 Referral</p>
          <p style={sx.boxS}>Earn 10% of daily points from everyone you invite</p>
          <div style={sx.refCode}>{profile.referralCode}</div>
          {profile.referralEarnings > 0 && (
            <p style={{ ...sx.boxS, color: "#4caf50", marginBottom: 12 }}>
              💸 Earned: {profile.referralEarnings.toLocaleString()} WTF
            </p>
          )}
          <button style={sx.btn} onClick={copyLink}>
            {copied ? "✅ Copied!" : "📋 Copy Invite Link"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={sx.root}>
      <div style={sx.header}>
        <span style={sx.hTitle}>⚽ WTF Prediction</span>
        <span style={sx.hSub}>World Cup 2026</span>
      </div>
      <div style={sx.content}>
        {tab === "home" && renderHome()}
        {tab === "predict" && renderPredict()}
        {tab === "profile" && renderProfile()}
      </div>
      <div style={sx.nav}>
        {(["home", "predict", "profile"] as Tab[]).map((t) => (
          <button key={t} style={{ ...sx.navBtn, ...(tab === t ? sx.navOn : {}) }} onClick={() => switchTab(t)}>
            {t === "home" ? "🏠" : t === "predict" ? "🎯" : "👤"}
            <br />
            <span style={sx.navL}>{t === "home" ? "Home" : t === "predict" ? "Predict" : "Profile"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const sx: Record<string, React.CSSProperties> = {
  root: { fontFamily: "Inter,Arial,sans-serif", background: "#0f0f1a", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto" },
  header: { background: "linear-gradient(135deg,#1a1a2e,#16213e)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ffffff15" },
  hTitle: { fontSize: 18, fontWeight: "bold", color: "#f0c040" },
  hSub: { fontSize: 12, color: "#aaa" },
  content: { flex: 1, overflowY: "auto", padding: "12px 16px 80px" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#1a1a2e", borderTop: "1px solid #ffffff15", display: "flex", justifyContent: "space-around", padding: "8px 0" },
  navBtn: { background: "none", border: "none", color: "#888", fontSize: 22, cursor: "pointer", padding: "4px 20px", borderRadius: 8, textAlign: "center" },
  navOn: { color: "#f0c040" },
  navL: { fontSize: 11 },
  center: { textAlign: "center", marginTop: 40, color: "#aaa" },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  section: { color: "#f0c040", fontSize: 13, fontWeight: "bold", margin: "8px 0 4px" },
  card: { background: "#1a1a2e", borderRadius: 12, padding: "14px 16px", border: "1px solid #ffffff10" },
  stageTag: { fontSize: 10, color: "#f0c04088", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
  matchRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  teamL: { display: "flex", alignItems: "center", gap: 6, flex: 1 },
  teamR: { display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" },
  flag: { fontSize: 26 },
  tname: { fontSize: 12, fontWeight: "bold", color: "#eee" },
  vsBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  vs: { color: "#666", fontSize: 11, fontWeight: "bold" },
  time: { color: "#888", fontSize: 11, marginTop: 8, textAlign: "center" },
  live: { background: "#ff4444", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4 },
  ft: { background: "#333", color: "#aaa", fontSize: 10, padding: "2px 6px", borderRadius: 4 },
  picks: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  pickBtn: { flex: 1, background: "#16213e", border: "1px solid #ffffff20", color: "#fff", borderRadius: 8, padding: "8px 4px", fontSize: 11, cursor: "pointer", minWidth: 80 },
  drawBtn: { background: "#1a2a1e", border: "1px solid #4caf5033" },
  picked: { color: "#4caf50", fontSize: 12, marginTop: 8, textAlign: "center" },
  loading: { color: "#f0c040", fontSize: 12, marginTop: 8, textAlign: "center" },
  hint: { color: "#f0c04066", fontSize: 11, marginTop: 6, textAlign: "center" },
  profileWrap: { display: "flex", flexDirection: "column", gap: 16 },
  statsRow: { display: "flex", gap: 12 },
  stat: { flex: 1, background: "#1a1a2e", borderRadius: 12, padding: 16, textAlign: "center", border: "1px solid #ffffff10" },
  statN: { fontSize: 24, fontWeight: "bold", color: "#f0c040", margin: 0 },
  statL: { fontSize: 12, color: "#888", margin: "4px 0 0" },
  box: { background: "#1a1a2e", borderRadius: 12, padding: 16, border: "1px solid #ffffff10", textAlign: "center" },
  boxT: { fontSize: 16, fontWeight: "bold", margin: "0 0 8px" },
  boxS: { fontSize: 11, color: "#888", margin: "0 0 12px" },
  spinBtn: { background: "linear-gradient(135deg,#f0c040,#e08c00)", border: "none", color: "#000", fontWeight: "bold", fontSize: 16, padding: "12px 32px", borderRadius: 10, cursor: "pointer", width: "100%", marginTop: 12 },
  err: { color: "#ff6b6b", fontSize: 12, margin: "8px 0" },
  ok: { color: "#4caf50", fontSize: 14, margin: "8px 0", fontWeight: "bold" },
  timer: { fontSize: 12, color: "#888", marginTop: 8 },
  refCode: { background: "#0f0f1a", border: "1px dashed #f0c040", color: "#f0c040", fontFamily: "monospace", fontSize: 20, letterSpacing: 4, padding: "10px 0", borderRadius: 8, margin: "8px 0 12px" },
  btn: { background: "#16213e", border: "1px solid #ffffff20", color: "#fff", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
};
