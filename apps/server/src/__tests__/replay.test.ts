import { describe, it, expect } from "vitest";
import { Room } from "../room.js";
import { buildClientSnapshot } from "../snapshot.js";
import { decideDiscard, decideReaction } from "../aiPlayer.js";

describe("Match Replay Engine", () => {
  it("captures initial deal and step-by-step actions during a hand", () => {
    const room = new Room({ id: "test-replay-room", variant: "north" });
    const pids = ["p0", "p1", "p2", "p3"];
    pids.forEach((pid, i) => room.join(pid, `Player ${i}`));
    pids.forEach((pid) => room.setReady(pid));

    expect(room.status).toBe("playing");
    expect(room.matchReplay).toBeNull(); // not sealed yet while playing

    const snap = buildClientSnapshot(room, 0);
    expect(snap.matchReplay).toBeNull(); // hidden during active play
  });

  it("seals full match replay on round settlement", () => {
    const room = new Room({ id: "test-replay-complete", variant: "north" });
    const pids = ["p0", "p1", "p2", "p3"];
    pids.forEach((pid, i) => room.join(pid, `Player ${i}`));
    pids.forEach((pid) => room.setReady(pid));

    let opCounter = 0;
    let turnSafety = 0;
    while (room.status === "playing" && turnSafety++ < 400) {
      const state = room.state;
      if (!state) break;

      if (state.phase === "discard") {
        const turn = state.turn;
        const decision = decideDiscard(room, turn, "hard");
        if (decision) {
          room.handleCommand(`p${turn}`, {
            type: "discard",
            tileInstanceId: decision.tileInstanceId,
            operationId: `op-bench-${++opCounter}`,
          });
        }
      } else if (state.phase === "reaction") {
        let reacted = false;
        for (let seat = 0; seat < 4 && room.status === "playing" && room.state?.phase === "reaction"; seat++) {
          const decision = decideReaction(room, seat, "hard");
          if (decision && decision.action === "reaction") {
            const res = room.handleCommand(`p${seat}`, {
              type: "reaction",
              kind: decision.kind,
              kongType: decision.kongType,
              handTileIds: decision.handTileIds,
              pengMeldId: decision.pengMeldId,
              operationId: `op-bench-${++opCounter}`,
            });
            if (res.ok) {
              reacted = true;
              break;
            }
          }
        }
        if (!reacted && room.status === "playing" && room.state?.phase === "reaction") {
          for (let seat = 0; seat < 4; seat++) {
            if (room.status !== "playing" || room.state?.phase !== "reaction") break;
            room.handleCommand(`p${seat}`, {
              type: "pass",
              operationId: `op-bench-${++opCounter}`,
            });
          }
        }
      }
    }

    expect(room.status).toBe("ended");
    expect(room.matchReplay).not.toBeNull();
    const replay = room.matchReplay!;

    expect(replay.roomId).toBe("test-replay-complete");
    expect(replay.initial.hands.length).toBe(4);
    expect(replay.initial.hands[0]!.length).toBeGreaterThanOrEqual(16);
    expect(replay.steps.length).toBeGreaterThan(0);
    expect(replay.scores.length).toBe(4);

    const snap = buildClientSnapshot(room, 0);
    expect(snap.matchReplay).not.toBeNull();
    expect(snap.matchReplay?.id).toBe(replay.id);
  });
});
