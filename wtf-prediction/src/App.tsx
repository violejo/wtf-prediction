import { useState } from "react";

type Tab = "home" | "predict" | "profile";
type Pick = "home" | "draw" | "away";

interface Game {
  gameId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  kickoff: string;
  status: "upcoming" | "live" | "finished";
  resolved: boolean;
}

interface UserProfile {
  userId: string;
  wtf: number;
  rank: number;
  rankType: "display" | "real";
  referralCode: string;
  referralEarnings: number;
  canSpinToday: boolean;
}

const API = "https://withered-snow-677a.alinikoonahad.workers.dev/";
const USER_ID = "test-user-1";
const SPIN_PRIZES = [50, 150, 300, 500, 1000];

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [games, setGames] = useState<Game[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [predictions, setPredictions] = useState<Record<string, Pick>>({});
  const [loading, setLoading] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinError, setSpinError] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadGames() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/games`);
      const data = await res.json();
      setGames(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadProfile() {
    setLoading(true);
    try {
      await fetch(`${API}/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID }),
      });
      const res = await fetch(`${API}/api/profile?userId=${USER_ID}`);
      const data = await res.json();
      setProfile(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function submitPrediction(gameId: string, pick: Pick) {
    try {
      const res = await fetch(`${API}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, gameId, pick }),
      });
      const data = await res.json();
      if (data.success) setPredictions((prev) => ({ ...prev, [gameId]: pick }));
    } catch (e) { console.error(e); }
  }

  async function doSpin() {
    if (isSpinning) return;
    setIsSpinning(true);
    setSpinResult(null);
    setSpinError("");
    try {
      const res = await fetch(`${API}/api/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID }),
      });
      const data = await res.json();
      if (data.error === "already_spun_today") {
        setSpinError("You already spun today! Come back tomorrow.");
      } else if (data.success) {
        setSpinResult(data.reward);
        await loadProfile();
      }
    } catch (e) { console.error(e); }
    setIsSpinning(false);
  }

  function copyReferral() {
    if (!profile) return;
    navigator.clipboard.writeText(
      `https://warpcast.com/~/mini-apps/launch?url=https://wtf-prediction.pages.dev?ref=${profile.referralCode}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleTabSwitch(t: Tab) {
    setTab(t);
    setSpinResult(null);
    setSpinError("");
    if (t === "home" && games.length === 0) loadGames();
    if (t === "profile") loadProfile();
  }

  function formatKickoff(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function renderHome() {
    if (loading) return <p style={s.center}>Loading matches...</p>;
    if (games.length === 0)
      return (
        <div style={s.center}>
          <p style={{ color: "#aaa", marginBottom: 16 }}>No matches found</p>
          <button style={s.btn} onClick={loadGames}>Reload</button>
        </div>
      );
    return (
      <div style={s.list}>
        {games.map((g) => (
          <div key={g.gameId} style={s.card}>
            <div style={s.matchRow}>
              <div style={s.teamLeft}>
                <span style={s.flag}>{g.homeFlag}</span>
                <span style={s.teamName}>{g.homeTeam}</span>
              </div>
              <div style={s.vsBlock}>
                <span style={s.vs}>VS</span>
                {g.status === "live" && <span style={s.liveBadge}>● LIVE</span>}
                {g.status === "finished" && <span style={s.endBadge}>FT</span>}
              </div>
              <div style={s.teamRight}>
                <span style={s.teamName}>{g.awayTeam}</span>
                <span style={s.flag}>{g.awayFlag}</span>
              </div>
            </div>
            <p style={s.kickoff}>🕐 {formatKickoff(g.kickoff)}</p>
          </div>
        ))}
      </div>
    );
  }

  function renderPredict() {
    if (loading) return <p style={s.center}>Loading...</p>;
    if (games.length === 0)
      return (
        <div style={s.center}>
          <p style={{ color: "#aaa", marginBottom: 16 }}>Load matches first</p>
          <button style={s.btn} onClick={loadGames}>Load Matches</button>
        </div>
      );
    return (
      <div style={s.list}>
        {games.map((g) => {
          const myPick = predictions[g.gameId];
          const disabled = !!myPick || g.status === "finished";
          return (
            <div key={g.gameId} style={s.card}>
              <div style={s.matchRow}>
                <div style={s.teamLeft}>
                  <span style={s.flag}>{g.homeFlag}</span>
                  <span style={s.teamName}>{g.homeTeam}</span>
                </div>
                <span style={s.vs}>VS</span>
                <div style={s.teamRight}>
                  <span style={s.teamName}>{g.awayTeam}</span>
                  <span style={s.flag}>{g.awayFlag}</span>
                </div>
              </div>
              {myPick ? (
                <p style={s.picked}>
                  ✅ Predicted:{" "}
                  {myPick === "home" ? g.homeTeam : myPick === "away" ? g.awayTeam : "Draw"}
                </p>
              ) : (
                <div style={s.pickRow}>
                  <button style={s.pickBtn} disabled={disabled}
                    onClick={() => submitPrediction(g.gameId, "home")}>
                    {g.homeFlag} {g.homeTeam}
                  </button>
                  <button style={s.pickBtn} disabled={disabled}
                    onClick={() => submitPrediction(g.gameId, "draw")}>
                    🤝 Draw
                  </button>
                  <button style={s.pickBtn} disabled={disabled}
                    onClick={() => submitPrediction(g.gameId, "away")}>
                    {g.awayFlag} {g.awayTeam}
                  </button>
                </div>
              )}
              {!myPick && !disabled && (
                <p style={s.rewardHint}>✨ Correct prediction = 2,500 WTF</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderProfile() {
    if (loading) return <p style={s.center}>Loading...</p>;
    if (!profile)
      return (
        <div style={s.center}>
          <button style={s.btn} onClick={loadProfile}>Load Profile</button>
        </div>
      );
    return (
      <div style={s.profileWrap}>
        {/* Stats */}
        <div style={s.statsRow}>
          <div style={s.statBox}>
            <p style={s.statNum}>{profile.wtf.toLocaleString()}</p>
            <p style={s.statLabel}>💰 WTF Points</p>
          </div>
          <div style={s.statBox}>
            <p style={s.statNum}>#{profile.rank.toLocaleString()}</p>
            <p style={s.statLabel}>🏆 Rank</p>
          </div>
        </div>

        {/* Daily Spin */}
        <div style={s.box}>
          <p style={s.boxTitle}>🎰 Daily Spin</p>
          <p style={s.boxSub}>Prizes: {SPIN_PRIZES.map((p) => `${p} WTF`).join(" • ")}</p>
          {spinError && <p style={s.errText}>{spinError}</p>}
          {spinResult && (
            <p style={s.successText}>🎉 You won {spinResult.toLocaleString()} WTF!</p>
          )}
          <button
            style={{ ...s.spinBtn, opacity: !profile.canSpinToday || isSpinning ? 0.5 : 1 }}
            disabled={!profile.canSpinToday || isSpinning}
            onClick={doSpin}
          >
            {isSpinning ? "Spinning..." : profile.canSpinToday ? "🎰 Spin Now!" : "⏰ Come back tomorrow"}
          </button>
        </div>

        {/* Referral */}
        <div style={s.box}>
          <p style={s.boxTitle}>🔗 Referral</p>
          <p style={s.boxSub}>Earn 10% of daily points from every friend you invite</p>
          <div style={s.refCode}>{profile.referralCode}</div>
          {profile.referralEarnings > 0 && (
            <p style={s.boxSub}>💸 Earned from referrals: {profile.referralEarnings.toLocaleString()} WTF</p>
          )}
          <button style={s.btn} onClick={copyReferral}>
            {copied ? "✅ Copied!" : "📋 Copy Invite Link"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <span style={s.headerTitle}>⚽ WTF Prediction</span>
        <span style={s.headerSub}>World Cup 2026</span>
      </div>
      <div style={s.content}>
        {tab === "home" && renderHome()}
        {tab === "predict" && renderPredict()}
        {tab === "profile" && renderProfile()}
      </div>
      <div style={s.nav}>
        {(["home", "predict", "profile"] as Tab[]).map((t) => (
          <button
            key={t}
            style={{ ...s.navBtn, ...(tab === t ? s.navActive : {}) }}
            onClick={() => handleTabSwitch(t)}
          >
            {t === "home" ? "🏠" : t === "predict" ? "🎯" : "👤"}
            <br />
            <span style={s.navLabel}>
              {t === "home" ? "Home" : t === "predict" ? "Predict" : "Profile"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "Inter, Arial, sans-serif",
    background: "#0f0f1a",
    color: "#fff",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    maxWidth: 480,
    margin: "0 auto",
  },
  header: {
    background: "linear-gradient(135deg, #1a1a2e, #16213e)",
    padding: "16px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #ffffff15",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#f0c040" },
  headerSub: { fontSize: 12, color: "#aaa" },
  content: { flex: 1, overflowY: "auto", padding: "12px 16px 80px" },
  nav: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 480,
    background: "#1a1a2e", borderTop: "1px solid #ffffff15",
    display: "flex", justifyContent: "space-around", padding: "8px 0",
  },
  navBtn: {
    background: "none", border: "none", color: "#888",
    fontSize: 22, cursor: "pointer", padding: "4px 20px",
    borderRadius: 8, textAlign: "center",
  },
  navActive: { color: "#f0c040" },
  navLabel: { fontSize: 11 },
  center: { textAlign: "center", marginTop: 40, color: "#aaa" },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "#1a1a2e", borderRadius: 12,
    padding: "14px 16px", border: "1px solid #ffffff10",
  },
  matchRow: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 8,
  },
  teamLeft: { display: "flex", alignItems: "center", gap: 6, flex: 1 },
  teamRight: { display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" },
  flag: { fontSize: 28 },
  teamName: { fontSize: 13, fontWeight: "bold", color: "#eee" },
  vsBlock: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  vs: { color: "#666", fontSize: 12, fontWeight: "bold" },
  kickoff: { color: "#888", fontSize: 11, marginTop: 8, textAlign: "center" },
  liveBadge: {
    background: "#ff4444", color: "#fff",
    fontSize: 10, padding: "2px 6px", borderRadius: 4,
  },
  endBadge: {
    background: "#333", color: "#aaa",
    fontSize: 10, padding: "2px 6px", borderRadius: 4,
  },
  pickRow: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  pickBtn: {
    flex: 1, background: "#16213e",
    border: "1px solid #ffffff20", color: "#fff",
    borderRadius: 8, padding: "8px 4px",
    fontSize: 11, cursor: "pointer", minWidth: 80,
  },
  picked: { color: "#4caf50", fontSize: 12, marginTop: 8, textAlign: "center" },
  rewardHint: { color: "#f0c04066", fontSize: 11, marginTop: 6, textAlign: "center" },
  profileWrap: { display: "flex", flexDirection: "column", gap: 16 },
  statsRow: { display: "flex", gap: 12 },
  statBox: {
    flex: 1, background: "#1a1a2e", borderRadius: 12,
    padding: 16, textAlign: "center", border: "1px solid #ffffff10",
  },
  statNum: { fontSize: 24, fontWeight: "bold", color: "#f0c040", margin: 0 },
  statLabel: { fontSize: 12, color: "#888", margin: "4px 0 0" },
  box: {
    background: "#1a1a2e", borderRadius: 12,
    padding: 16, border: "1px solid #ffffff10", textAlign: "center",
  },
  boxTitle: { fontSize: 16, fontWeight: "bold", margin: "0 0 6px" },
  boxSub: { fontSize: 11, color: "#888", margin: "0 0 12px" },
  spinBtn: {
    background: "linear-gradient(135deg, #f0c040, #e08c00)",
    border: "none", color: "#000", fontWeight: "bold",
    fontSize: 16, padding: "12px 32px",
    borderRadius: 10, cursor: "pointer", width: "100%",
  },
  errText: { color: "#ff6b6b", fontSize: 12, marginBottom: 8 },
  successText: { color: "#4caf50", fontSize: 14, marginBottom: 8, fontWeight: "bold" },
  refCode: {
    background: "#0f0f1a", border: "1px dashed #f0c040",
    color: "#f0c040", fontFamily: "monospace",
    fontSize: 20, letterSpacing: 4,
    padding: "10px 0", borderRadius: 8, margin: "8px 0 12px",
  },
  btn: {
    background: "#16213e", border: "1px solid #ffffff20",
    color: "#fff", padding: "10px 20px",
    borderRadius: 8, cursor: "pointer", fontSize: 13,
  },
};
