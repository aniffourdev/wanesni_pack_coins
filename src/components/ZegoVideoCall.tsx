"use client"
import React, { useEffect, useRef, useState } from "react";
import { ZegoExpressEngine } from "zego-express-engine-webrtc";
import { Buffer } from "buffer";

const APP_ID = 1043089575;
const SERVER = "wss://webliveroom1043089575-api.zegocloud.com/ws";

// TEMPORARY: Use dashboard token for testing
const HARDCODED_USER_ID = "03031bf9-f707-4380-8d3d-6a119982f66f";
const HARDCODED_TOKEN = `04AAAAGh9BNcADlh6Kosls4IBi6ReIwDNaevCklg1C9UUdJgekyBqTW9dw5Ig1UPebUzKVi o9J8a5+RxRpKOJsy1x3Gt97rRD/365j8XjctuJkadw0F7JCZJ66bmsksPzI+iqXVrDEu1QuZR RoozPFeBqodN1WmE9VZdUEpEdGMsLb4z9wBsyalwPmtD0NyMjDVp+NaWxfDMNRcBptrQ7dtCB FcQjS5LkOcZHW1sF5iiPmk1uQ2ApUCwXqez+MtcFiWDN2SK+Miwc6EnKe5J9IVBUSLr54t4cNd BypV46uFsS3GwE=`.replace(/\s+/g, ''); // Remove whitespace
const HARDCODED_ROOM_ID = "testroom";

export default function ZegoVideoCall({ userID, userName, roomID }: { userID: string, userName: string, roomID: string }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const zgRef = useRef<ZegoExpressEngine | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TEMPORARY: Set the hardcoded token for testing
    setToken(HARDCODED_TOKEN);
  }, []);

  useEffect(() => {
    if (!token || !HARDCODED_USER_ID || !HARDCODED_ROOM_ID || error) return;

    const zg = new ZegoExpressEngine(APP_ID, SERVER);
    zgRef.current = zg;

    async function start() {
      try {
        if (token === null) {
          throw new Error("Token is null");
        }
        console.log("loginRoom params:", { roomID: HARDCODED_ROOM_ID, token, userID: HARDCODED_USER_ID, userName });
        if (!HARDCODED_USER_ID || typeof HARDCODED_USER_ID !== "string" || HARDCODED_USER_ID.trim() === "") {
          setError("userID is missing or invalid: " + String(HARDCODED_USER_ID));
          return;
        }
        await zg.loginRoom(HARDCODED_ROOM_ID, token, { userID: HARDCODED_USER_ID, userName: "salim" });
        console.log("Successfully logged in to room:", HARDCODED_ROOM_ID); // Debug log

        const localStream = await zg.createStream({ camera: { video: true, audio: true } });
        if (localVideoRef.current) {
          await zg.startPublishingStream("local-stream", localStream);
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play();
        }

        zg.on("roomStreamUpdate", async (roomID, updateType, streamList) => {
          if (updateType === "ADD") {
            for (const stream of streamList) {
              try {
                console.log("Adding stream:", stream.streamID); // Debug log
                const remoteStream = await zg.startPlayingStream(stream.streamID);
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = remoteStream;
                  remoteVideoRef.current.play();
                }
              } catch (err) {
                console.error("Error playing stream:", err); // Debug log
              }
            }
          }
        });
      } catch (err) {
        console.error("Error in ZegoExpressEngine:", err); // Debug log
        console.error("Error details:", JSON.stringify(err, null, 2));
        setError("Failed to join room: " + ((err as any)?.message || String(err)));
      }
    }

    start();

    return () => {
      zgRef.current?.destroyEngine();
    };
  }, [token, userID, userName, roomID, error]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Zego RTC Video Call</h1>
      <h4>Local video</h4>
      <video ref={localVideoRef} style={{ width: 400, height: 300, border: "1px solid #dfdfdf" }} autoPlay playsInline />
      <h4>Remote video</h4>
      <video ref={remoteVideoRef} style={{ width: 400, height: 300, border: "1px solid #dfdfdf" }} autoPlay playsInline />
    </div>
  );
}
