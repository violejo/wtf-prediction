import { useState, useEffect, useRef } from "react";

interface Game {
  gameId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  kickoff: string;
  status: string;
  stage: string;
  isKnockout: boolean;
  teamsKnown: boolean;
}

interface BracketViewProps {
  games: Game[];
  bracket: Record<string, Record<string, string>>;
  onPick: (stage: string, gameId: string, teamName: string, teamFlag: string) => void;
}

const STAGES = [
  { key: "LAST_16", short: "R16" },
  { key: "ROUND_OF_16", short: "R16" },
  { key: "QUARTER_FINALS", short: "QF" },
  { key: "SEMI_FINALS", short: "SF" },
  { key: "FINAL", short: "F" },
];

const NEON = "#bf00ff";
const CYAN = "#00f5ff";
const GREEN = "#00ff9f";
const BG = "#0a0a1a";
const CARD = "#0d0d20";

function hasStarted(kickoff: string) {
  return new Date(kickoff) <= new Date();
}

export default function BracketView({ games, bracket, onPick }: BracketViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const stageGames = (stageKey: string) =>
    games.filter((g) => g.stage === stageKey && g.teamsKnown);

  const allStagesWithGames = STAGES.filter(
    (s) => stageGames(s.key).length > 0
  ).filter((s, i, arr) => {
    // dedupe R16 (LAST_16 and ROUND_OF_16 are same stage)
    if (s.key === "ROUND_OF_16") {
      return !arr.find((x, j) => x.key === "LAST_16" && j < i && stageGames("LAST_16").length > 0);
    }
    return true;
  });

  const r16Key = stageGames("LAST_16").length > 0 ? "LAST_16" : "ROUND_OF_16";

  const stages = [
    { key: r16Key, label: "Round of 16" },
    { key: "QUARTER_FINALS", label: "Quarter-Finals" },
    { key: "SEMI_FINALS", label: "Semi-Finals" },
    { key: "FINAL", label: "Final" },
  ].filter((s) => stageGames(s.key).length > 0);

  function TeamButton({ game, team, flag, stage }: {
    game: Game; team: string; flag: string; stage: string;
  }) {
    const picked = bracket[stage]?.[game.gameId] === team;
    const started = hasStarted(game.kickoff);
    const otherPicked = bracket[stage]?.[game.gameId] && !picked;

    return (
      <button
        onClick={() => !started && onPick(stage, game.gameId, team, flag)}
        style={{
          background: picked ? `${NEON}22` : CARD,
          border: `2px solid ${picked ? NEON : "#ffffff0a"}`,
          borderRadius: 12,
          padding: "10px 8px",
          cursor: started ? "default" : "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          width: "100%",
          transition: "all 0.25s",
          boxShadow: picked ? `0 0 16px ${NEON}55, inset 0 0 12px ${NEON}11` : "none",
          opacity: otherPicked ? 0.3 : 1,
          position: "relative",
        }}
      >
        <span style={{ fontSize: 36 }}>{flag}</span>
        <span style={{
          fontSize: 10,
          fontWeight: "bold",
          color: picked ? "#e0e0ff" : "#666",
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: 70,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {team}
        </span>
        {picked && (
          <span style={{
            position: "absolute",
            top: -6,
            right: -6,
            background: NEON,
            borderRadius: "50%",
            width: 14,
            height: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            color: "#000",
            fontWeight: "bold",
            boxShadow: `0 0 8px ${NEON}`,
          }}>✓</span>
        )}
      </button>
    );
  }

  function StageColumn({ stage, label }: { stage: string; label: string }) {
    const gs = stageGames(stage);
    const colWidth = stage === "FINAL" ? 200 : 160;

    return (
      <div style={{ display: "flex", flexDirection: "column", minWidth: colWidth, maxWidth: colWidth }}>
        <div style={{
          textAlign: "center",
          padding: "8px 4px",
          marginBottom: 8,
          borderBottom: `1px solid ${CYAN}22`,
        }}>
          <span style={{ fontSize: 10, color: CYAN, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", textShadow: `0 0 8px ${CYAN}` }}>
            {label}
          </span>
        </div>

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: stage === "FINAL" ? 0 : stage === "SEMI_FINALS" ? 48 : stage === "QUARTER_FINALS" ? 24 : 12,
          flex: 1,
          justifyContent: "space-around",
        }}>
          {gs.map((g) => {
            const started = hasStarted(g.kickoff);
            const pick = bracket[stage]?.[g.gameId];
            return (
              <div key={g.gameId} style={{
                background: BG,
                borderRadius: 14,
                padding: 10,
                border: `1px solid ${pick ? NEON + "33" : "#ffffff08"}`,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <TeamButton game={g} team={g.homeTeam} flag={g.homeFlag} stage={stage} />
                  <TeamButton game={g} team={g.awayTeam} flag={g.awayFlag} stage={stage} />
                </div>
                <div style={{ textAlign: "center" }}>
                  {started && !pick && (
                    <span style={{ fontSize: 9, color: "#444" }}>⏸ Locked</span>
                  )}
                  {!started && !pick && (
                    <span style={{ fontSize: 9, color: "#333" }}>Pick the winner</span>
                  )}
                  {pick && (
                    <span style={{ fontSize: 9, color: NEON, textShadow: `0 0 6px ${NEON}` }}>
                      🎯 {pick}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div style={{ textAlign: "center", marginTop: 60, color: "#444", fontFamily: "monospace" }}>
        Knockout bracket not available yet.
      </div>
    );
  }

  const finalStage = stages.find((s) => s.key === "FINAL");
  const finalGame = finalStage ? stageGames("FINAL")[0] : null;
  const champion = finalGame ? bracket["FINAL"]?.[finalGame.gameId] : null;
  const championFlag = finalGame
    ? champion === finalGame.homeTeam ? finalGame.homeFlag
    : champion === finalGame.awayTeam ? finalGame.awayFlag : null
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Champion Banner */}
      <div style={{
        background: champion ? `${NEON}18` : BG,
        border: `1px solid ${champion ? NEON : "#ffffff08"}`,
        borderRadius: 16,
        padding: "14px 16px",
        marginBottom: 16,
        textAlign: "center",
        boxShadow: champion ? `0 0 24px ${NEON}33` : "none",
        transition: "all 0.4s",
      }}>
        {champion ? (
          <>
            <div style={{ fontSize: 48 }}>{championFlag}</div>
            <p style={{ color: NEON, fontWeight: "bold", fontSize: 16, margin: "4px 0 0", textShadow: `0 0 12px ${NEON}`, fontFamily: "monospace" }}>
              🏆 {champion}
            </p>
            <p style={{ color: "#555", fontSize: 10, margin: "2px 0 0" }}>Your predicted champion</p>
          </>
        ) : (
          <>
            <p style={{ color: "#333", fontSize: 28, margin: 0 }}>🏆</p>
            <p style={{ color: "#444", fontSize: 12, margin: "4px 0 0", fontFamily: "monospace" }}>Pick winners to reveal your champion</p>
          </>
        )}
      </div>

      {/* Bracket Scroll Area */}
      <div
        ref={scrollRef}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: 12,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{
          display: "flex",
          gap: 12,
          minWidth: "fit-content",
          padding: "0 4px",
          alignItems: "flex-start",
        }}>
          {stages.map((s) => (
            <StageColumn key={s.key} stage={s.key} label={s.label} />
          ))}
        </div>
      </div>

      <p style={{ color: "#333", fontSize: 10, textAlign: "center", marginTop: 8, fontFamily: "monospace" }}>
        ← scroll to see all stages →
      </p>
    </div>
  );
}
