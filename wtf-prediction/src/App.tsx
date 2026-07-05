import { useState, useEffect, useRef } from "react";
import SpinWheel from "./SpinWheel";
import BracketView from "./BracketView";
import type { SpinWheelRef } from "./SpinWheel";
// ۱. ایمپورت کردن SDK بومی فارکستر
import { sdk } from "@farcaster/frame-sdk";

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
  walletAddress: string | null;
  wtf: number;
  rank: number;
  rankType: string;
  referralCode: string;
  referralEarnings: number;
  canSpinToday: boolean;
  predHistory: PredEntry[];
}

const API = "https://withered-snow-677a.alinikoonahad.workers.dev";

const NEON_CYAN = "#00f5ff";
const NEON_PURPLE = "#bf00ff";
const NEON_GREEN = "#00ff9f";
const NEON_PINK = "#ff006e";
const BG_DARK = "#050510";
const BG_CARD = "#0a0a1a";
const BG_CARD2 = "#0d0d20";

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
    LAST_16: "Round of 16", ROUND_OF_16: "Round of 16",
    QUARTER_FINALS: "Quarter-Finals", SEMI_FINALS: "Semi-Finals",
    THIRD_PLACE: "Third Place", FINAL: "Final",
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

  // استیت‌های جدید فارکستر
  const [isFrame, setIsFrame] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);

  // ۲. اینیشیالایز کردن بومی SDK فارکستر و خواندن هویت کاربر
  useEffect(() => {
    const initFarcaster = async () => {
      try {
        const context = await sdk.context;
        if (context && context.user) {
          setFarcasterUser(context.user);
          setIsFrame(true);
          // تنظیم شناسه کاربر بر اساس FID فارکستر به جای حافظه محلی متفرقه
          UID.current = String(context.user.fid);
          
          // آپدیت مجدد پیش‌بینی‌ها پس از ست شدن اکانت واقعی
          loadPreds();
          if (tab === "profile") loadProfile();
        }
      } catch (e) {
        console.log("خارج از کلاینت فارکستر اجرا شده است.");
      } finally {
        // اعلام آمادگی فریم برای رندر به کلاینت وارپ‌کست
        sdk.actions.ready();
      }
    };
    initFarcaster();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCountdown(secsToUTCMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadGames();
    loadPreds();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const colors = [NEON_CYAN, NEON_PURPLE, NEON_GREEN, NEON_PINK];
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
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
        setTimeout(() => setAnimatedCards((prev) => new Set([...prev, g.gameId])), i * 60);
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

  async function handleBracketPick(stage: string, gameId: string, teamName: string) {
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
    submitPick(gameId, Math.random() < 0.5 ? "home" : "away");
  }

  async function doSpin() {
    if (spinning || !profile?.canSpinToday) return;
    setRunningSpin();
  }

  async function setRunningSpin() {
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
    } catch {
      setSpinning(false);
    }
  }

  // ۳. متد بومی اتصال به والت داخلی فارکستر (Warpcast Wallet Provider)
  async function connectFarcasterWallet() {
    if (connectingWallet) return;
    setConnectingWallet(true);
    try {
      const provider = sdk.wallet.ethProvider;
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      
      if (accounts && accounts.length > 0) {
        const wallet = accounts[0];
        
        // ارسال آدرس ولت متصل شده به ورکر جهت ثبت نهایی در دیتابیس پروفایل کاربر
        await fetch(`${API}/api/user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: UID.current, walletAddress: wallet }),
        });
        
        await loadProfile();
      }
    } catch (err) {
      console.error("اتصال به کیف پول وارپ‌کست ناموفق بود:", err);
    } finally {
      setConnectingWallet(false);
    }
  }

  // ۴. ساختن لینک هوشمند اینتنت رفرال اختصاصی برای انتشار مستقیم در کست فید
  function shareOnFarcaster() {
    if (!profile) return;
    const refUrl = `https://wtf-prediction.pages.dev?ref=${profile.referralCode}`;
    const text = "🎯 I'm predicting World Cup matches and earning WTF points! Join my bracket now: \n\n";
    const warpcastIntent = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(refUrl)}`;
    
    if (isFrame) {
      sdk.actions.openUrl(warpcastIntent);
    } else {
      window.open(warpcastIntent, "_blank");
    }
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
          isLoading ? (
            <p style={sx.loading}>⏳ Submitting...</p>
          ) : myPick ? (
            <p style={sx.picked}>✅ {pickLabel(myPick, g.homeTeam, g.awayTeam)}</p>
          ) : !started ? (
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
          ) : (
            <p style={{ ...sx.hint, color: "#444" }}>⏸ Predictions closed</p>
          )
        )}
      </div>
    );
  }

  function renderHome() {
    if (loadingGames) return <p style={sx.center}>Loading matches...</p>;
    if (games.length === 0) {
      return (
        <div style={sx.center}>
          <p style={{ color: "#444", marginBottom: 16 }}>No matches available</p>
          <button style={sx.btn} onClick={loadGames}>Reload</button>
        </div>
      );
    }
    return (
      <div style={sx.list}>
        {liveGames.length > 0 && (
          <>
            <p style={sx.section}>🔴 IN PROGRESS</p>
            {liveGames.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}
          </>
        )}
        {next4.length > 0 && (
          <>
            <p style={sx.section}>⚡ COMING UP</p>
            {next4.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}
          </>
        )}
        {future.length > 0 && (
          <>
            <p style={sx.section}>📅 UPCOMING</p>
            {future.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}
          </>
        )}
        {finishedGames.length > 0 && (
          <>
            <p style={sx.section}>✅ RECENT RESULTS</p>
            {finishedGames.map((g) => <GameCard key={g.gameId} g={g} showPicks={false} />)}
          </>
        )}
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
    return <BracketView games={games} bracket={bracket} onPick={handleBracketPick} />;
  }

  // اضافه شدن المان بومی والت و دکمه اشتراک‌گذاری فارکستر
  function renderProfile() {
    if (loadingProfile) return <p style={sx.center}>Loading Profile...</p>;
    if (!profile) {
      return (
        <div style={sx.center}>
          <button style={sx.btn} onClick={loadProfile}>Load Profile</button>
        </div>
      );
    }
    const correct = profile.predHistory.filter((p) => p.outcome === "correct").length;
    const total = profile.predHistory.filter((p) => p.outcome !== "pending").length;
    return (
      <div style={sx.profileWrap}>
        {/* نمایش نام کاربری فارکستر در صورت وجود */}
        {farcasterUser && (
          <div style={sx.userBadge}>
            <span>👤 Farcaster: <b>@{farcasterUser.username}</b></span>
          </div>
        )}

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

        {/* بخش متصل کردن والت داخلی وارپ‌کست */}
        <div style={sx.box}>
          <p style={sx.boxT}>🛡️ Web3 Account Wallet</p>
          {profile.walletAddress ? (
            <p style={{ ...sx.ok, fontSize: 12, fontFamily: "monospace" }}>
              🔗 Connected: {profile.walletAddress.slice(0, 6)}...{profile.walletAddress.slice(-4)}
            </p>
          ) : (
            <button style={sx.walletBtn} onClick={connectFarcasterWallet}>
              {connectingWallet ? "Connecting..." : "🔌 Connect Warpcast Wallet"}
            </button>
          )}
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
          <button
            style={{ ...sx.spinBtn, opacity: !profile.canSpinToday || spinning ? 0.4 : 1 }}
            disabled={!profile.canSpinToday || spinning}
            onClick={doSpin}
          >
            {spinning ? "Spinning..." : profile.canSpinToday ? "🎰 Spin Now!" : "⏰ Come back tomorrow"}
          </button>
          {!profile.canSpinToday && (
            <p style={sx.timer}>
              Next spin: <span style={{ color: NEON_CYAN, fontWeight: "bold", fontFamily: "monospace" }}>{fmtCountdown(countdown)}</span> UTC
            </p>
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
                  <div key={p.gameId} style={{ ...sx.predRow, borderLeft: `3px solid ${p.outcome === "correct" ? NEON_GREEN : p.outcome === "wrong" ? NEON_PINK : "#333"}` }}>
                    <div style={sx.predTeams}>
                      <span>{p.homeFlag} {p.homeTeam}</span>
                      <span style={{ color: "#333", fontSize: 10 }}>VS</span>
                      <span>{p.awayTeam} {p.awayFlag}</span>
                    </div>
                    <div style={sx.predMeta}>
                      <span style={{ color: "#666", fontSize: 11 }}>
                        Pick: <span style={{ color: NEON_CYAN }}>{pickLabel(p.pick, p.homeTeam, p.awayTeam)}</span>
                      </span>
                      {p.outcome === "correct" && <span style={{ color: NEON_GREEN, fontSize: 11 }}>✅ +2,500</span>}
                      {p.outcome === "wrong" && <span style={{ color: NEON_PINK, fontSize: 11 }}>❌ Wrong</span>}
                      {p.outcome === "pending" && <span style={{ color: "#444", fontSize: 11 }}>⏳ Pending</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={sx.box}>
          <p style={sx.boxT}>🔗 Referral Program</p>
          <p style={sx.boxS}>Earn 10% of daily points from everyone you invite</p>
          <div style={sx.refCode}>{profile.referralCode}</div>
          {profile.referralEarnings > 0 && (
            <p style={{ ...sx.boxS, color: NEON_GREEN, marginBottom: 12 }}>
              💸 Earned: {profile.referralEarnings.toLocaleString()} WTF
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
            <button style={sx.farcasterBtn} onClick={shareOnFarcaster}>📢 Share on Farcaster Feed</button>
            <button style={sx.btn} onClick={copyLink}>{copied ? "✅ Copied!" : "📋 Copy Link Instead"}</button>
          </div>
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

const sx: Record<string, React.CSSProperties> = {
  root: { fontFamily: "'Inter','Courier New',monospace", background: BG_DARK, color: "#e0e0ff", minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto" },
  headerWrap: { position: "relative", height: 72, overflow: "hidden", flexShrink: 0 },
  canvas: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  header: { position: "relative", zIndex: 2, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${NEON_CYAN}33` },
  hTitle: { fontSize: 17, fontWeight: "bold", color: NEON_CYAN, textShadow: `0 0 12px ${NEON_CYAN}`, letterSpacing: 1 },
  hBadge: { display: "block", fontSize: 9, color: NEON_PURPLE, letterSpacing: 3, marginTop: 2, textShadow: `0 0 8px ${NEON_PURPLE}` },
  hGlow: { width: 8, height: 8, borderRadius: "50%", background: NEON_GREEN, boxShadow: `0 0 10px ${NEON_GREEN}` },
  content: { flex: 1, overflowY: "auto", padding: "12px 16px 90px" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#08081899", backdropFilter: "blur(12px)", borderTop: `1px solid ${NEON_CYAN}22`, display: "flex", justifyContent: "space-around", padding: "8px 0" },
  navBtn: { background: "none", border: "none", color: "#444", fontSize: 20, cursor: "pointer", padding: "4px 12px", borderRadius: 8, textAlign: "center" },
  navOn: { color: NEON_CYAN, textShadow: `0 0 10px ${NEON_CYAN}` },
  navL: { fontSize: 10, display: "block", marginTop: 2 },
  center: { textAlign: "center", marginTop: 60, color: "#444", fontFamily: "monospace" },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  section: { color: NEON_CYAN, fontSize: 11, fontWeight: "bold", margin: "10px 0 6px", letterSpacing: 2, textShadow: `0 0 8px ${NEON_CYAN}` },
  card: { background: BG_CARD, borderRadius: 14, padding: "14px 16px", border: `1px solid ${NEON_CYAN}18`, boxShadow: `0 0 20px ${NEON_CYAN}06` },
  stageTag: { fontSize: 9, color: NEON_PURPLE + "66", marginBottom: 6, textTransform: "uppercase", letterSpacing: 2 },
  matchRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  teamL: { display: "flex", alignItems: "center", gap: 6, flex: 1 },
  teamR: { display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" },
  flag: { fontSize: 26 },
  tname: { fontSize: 12, fontWeight: "bold", color: "#b0b0d0" },
  vsBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  vs: { color: "#333", fontSize: 10, fontWeight: "bold", letterSpacing: 2 },
  time: { color: "#444", fontSize: 10, marginTop: 8, textAlign: "center", fontFamily: "monospace" },
  live: { background: NEON_PINK, color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: "bold", boxShadow: `0 0 8px ${NEON_PINK}` },
  ft: { background: "#111", color: "#444", fontSize: 9, padding: "2px 6px", borderRadius: 4 },
  picks: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  pickBtn: { flex: 1, background: BG_CARD2, border: `1px solid ${NEON_CYAN}18`, color: "#888", borderRadius: 8, padding: "9px 4px", fontSize: 11, cursor: "pointer", minWidth: 80 },
  drawBtn: { border: `1px solid ${NEON_GREEN}22`, color: NEON_GREEN + "77" },
  surpriseBtn: { border: `1px solid ${NEON_PURPLE}44`, color: NEON_PURPLE, boxShadow: `0 0 8px ${NEON_PURPLE}22` },
  picked: { color: NEON_GREEN, fontSize: 12, marginTop: 8, textAlign: "center", textShadow: `0 0 8px ${NEON_GREEN}` },
  loading: { color: NEON_CYAN, fontSize: 12, marginTop: 8, textAlign: "center" },
  hint: { color: "#333", fontSize: 10, marginTop: 6, textAlign: "center" },
  profileWrap: { display: "flex", flexDirection: "column", gap: 16 },
  statsRow: { display: "flex", gap: 12 },
  stat: { flex: 1, background: BG_CARD, borderRadius: 12, padding: 16, textAlign: "center", border: `1px solid ${NEON_CYAN}18` },
  statN: { fontSize: 24, fontWeight: "bold", color: NEON_CYAN, margin: 0, textShadow: `0 0 14px ${NEON_CYAN}`, fontFamily: "monospace" },
  statL: { fontSize: 11, color: "#444", margin: "4px 0 0" },
  accuracyBox: { background: BG_CARD, borderRadius: 10, padding: "10px 16px", border: `1px solid ${NEON_GREEN}22`, textAlign: "center" },
  accuracyText: { fontSize: 14, color: NEON_GREEN, fontWeight: "bold", textShadow: `0 0 8px ${NEON_GREEN}` },
  box: { background: BG_CARD, borderRadius: 14, padding: 16, border: `1px solid ${NEON_CYAN}10`, textAlign: "center" },
  boxT: { fontSize: 15, fontWeight: "bold", margin: "0 0 10px", color: "#c0c0e0" },
  boxS: { fontSize: 11, color: "#444", margin: "0 0 12px" },
  toggleBtn: { background: "none", border: `1px solid #ffffff0a`, color: "#555", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, width: "100%" },
  predRow: { background: BG_DARK, borderRadius: 8, padding: "10px 12px", textAlign: "left", display: "flex", flexDirection: "column", gap: 4 },
  predTeams: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#888" },
  predMeta: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  spinBtn: { background: `linear-gradient(135deg, ${NEON_CYAN}, ${NEON_PURPLE})`, border: "none", color: "#000", fontWeight: "bold", fontSize: 15, padding: "12px 32px", borderRadius: 10, cursor: "pointer", width: "100%", marginTop: 12, boxShadow: `0 0 20px ${NEON_CYAN}33` },
  walletBtn: { background: "none", border: `1px solid ${NEON_GREEN}`, color: NEON_GREEN, fontWeight: "bold", fontSize: 13, padding: "10px 20px", borderRadius: 8, cursor: "pointer", width: "100%" },
  farcasterBtn: { background: "#7c3aed", border: "none", color: "#fff", fontWeight: "bold", fontSize: 14, padding: "12px 20px", borderRadius: 8, cursor: "pointer", width: "100%", boxShadow: `0 0 12px #7c3aed44` },
  userBadge: { background: BG_CARD, border: `1px solid ${NEON_PURPLE}33`, color: "#b0b0d0", fontSize: 13, padding: "8px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 },
  err: { color: NEON_PINK, fontSize: 12, margin: "8px 0" },
  ok: { color: NEON_GREEN, fontSize: 14, margin: "8px 0", fontWeight: "bold", textShadow: `0 0 8px ${NEON_GREEN}` },
  timer: { fontSize: 12, color: "#444", marginTop: 8 },
  refCode: { background: BG_DARK, border: `1px dashed ${NEON_CYAN}44`, color: NEON_CYAN, fontFamily: "monospace", fontSize: 18, letterSpacing: 4, padding: "10px 0", borderRadius: 8, margin: "8px 0 12px", textShadow: `0 0 8px ${NEON_CYAN}` },
  btn: { background: BG_CARD2, border: `1px solid ${NEON_CYAN}22`, color: "#777", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13, width: "100%" },
};
