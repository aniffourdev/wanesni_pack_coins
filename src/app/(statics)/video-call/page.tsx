"use client";
import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { UserService } from "@/lib/user";
import Cookies from "js-cookie";
import io from "socket.io-client";
import { createVideoCall } from "@/lib/directus";
import { useRouter, useSearchParams } from "next/navigation";

const ZegoRandomCall = dynamic(() => import("@/components/ZegoRandomCall"), { ssr: false });

export default function VideoCallPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ roomID: string } | null>(null);
  const [waitingForMatch, setWaitingForMatch] = useState(false);
  const router = useRouter();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlRoomID = searchParams ? searchParams.get("roomID") : null;
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [incomingCall, setIncomingCall] = useState<null | { from: string, callerName: string, roomID: string }>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // On mount, if ?roomID=... is present, auto-join that call
  useEffect(() => {
    if (urlRoomID && !activeCall) {
      setActiveCall({ roomID: urlRoomID });
    }
    // eslint-disable-next-line
  }, [urlRoomID]);

  // When joining a call, update the URL
  useEffect(() => {
    if (activeCall && activeCall.roomID) {
      const newUrl = `${window.location.pathname}?roomID=${activeCall.roomID}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [activeCall]);

  useEffect(() => {
    // Fetch current user
    UserService.getCurrentUser().then(setCurrentUser).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    // Fetch all users
    const fetchUsers = async () => {
      try {
        const accessToken = Cookies.get("access_token");
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://wanesni.com";
        const res = await fetch(`${apiUrl}/users`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await res.json();
        setUsers(data.data || []);
      } catch (err: any) {
        setError("Failed to fetch users");
      }
      setLoading(false);
    };
    fetchUsers();
  }, [currentUser]);

  useEffect(() => {
    // Setup socket connection for online users
    if (!currentUser) return;
    const getSocketUrl = () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        return "http://localhost:3001";
      }
      return "wss://socket.wanesni.com";
    };
    const socketUrl = getSocketUrl();
    const newSocket = io(socketUrl, {
      auth: {
        token: Cookies.get("access_token") || "",
      },
    });
    setSocket(newSocket);
    newSocket.emit("init", {
      type: "init",
      userId: currentUser.id,
      firstName: currentUser.first_name || currentUser.id,
    });
    newSocket.on("onlineUsers", (onlineUsersList: any[]) => {
      setOnlineUsers(onlineUsersList.filter(u => u.id !== currentUser.id));
    });
    // Listen for incoming call invites
    newSocket.on("video-call-invite", (data: { to: string, from: string, roomID: string, callerName: string }) => {
      if (data.to === currentUser.id) {
        // Only show notification if not already in a call
        if (!activeCall) {
          setIncomingCall({ from: data.from, callerName: data.callerName, roomID: data.roomID });
        }
      }
    });
    return () => {
      newSocket.disconnect();
    };
  }, [currentUser, activeCall]);

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio("/ringtone.mp3");
        ringtoneRef.current.loop = true;
      }
      if (ringtoneRef.current) {
        ringtoneRef.current.volume = 0;
        ringtoneRef.current.play().then(() => {
          if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
            ringtoneRef.current.volume = 1;
          }
        }).catch(() => {});
      }
      window.removeEventListener("click", unlockAudio);
    };
    window.addEventListener("click", unlockAudio);
    return () => window.removeEventListener("click", unlockAudio);
  }, []);

  // Play ringtone when incomingCall is set
  useEffect(() => {
    if (incomingCall && !activeCall) {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio("/ringtone.mp3");
        ringtoneRef.current.loop = true;
      }
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current.play().catch(() => {});
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
    // Cleanup on unmount
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    };
  }, [incomingCall, activeCall]);

  // Listen for call rejection and leave call automatically
  useEffect(() => {
    if (!socket) return;
    const onReject = (data: { to: string, from: string, roomID: string }) => {
      // If I'm the caller and my call was rejected, leave the call
      if (activeCall && data.roomID === activeCall.roomID) {
        setActiveCall(null);
        setError("Call was rejected by the other user.");
      }
    };
    socket.on("video-call-reject", onReject);
    return () => {
      socket.off("video-call-reject", onReject);
    };
  }, [socket, activeCall]);

  // Handle call button click
  const handleCallUser = async (callee: any) => {
    if (!currentUser || !socket) return;
    try {
      // 1. Create a new video call record and get the roomID
      const callRecord = await createVideoCall(currentUser.id, callee.id, "direct");
      const roomID = callRecord.zego_room_id;
      // 2. Send a socket notification to the callee
      socket.emit("video-call-invite", {
        to: callee.id,
        from: currentUser.id,
        roomID,
        callerName: currentUser.first_name || currentUser.id,
      });
      // 3. Join the call as the caller
      setActiveCall({ roomID });
    } catch (err: any) {
      setError("Failed to start call: " + (err.message || err.toString()));
    }
  };

  // Handle random call button click
  const handleRandomCall = () => {
    if (!socket || !currentUser) return;
    setWaitingForMatch(true);
    socket.emit("random-call-waiting", { userId: currentUser.id, name: currentUser.first_name || currentUser.id });
  };

  // Leave call handler
  const handleLeaveCall = () => {
    if (socket) {
      socket.emit("leave-random-call");
    }
    setActiveCall(null);
    setWaitingForMatch(false);
    // Optionally, remove roomID from URL
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Emit leave-random-call on tab close or navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket) {
        socket.emit("leave-random-call");
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [socket]);

  // Listen for random call match
  useEffect(() => {
    if (!socket) return;
    const onMatch = (data: { roomID: string }) => {
      setActiveCall({ roomID: data.roomID });
      setWaitingForMatch(false);
    };
    socket.on("random-call-match", onMatch);
    return () => {
      socket.off("random-call-match", onMatch);
    };
  }, [socket]);

  // Accept incoming call
  const handleAcceptCall = () => {
    if (incomingCall) {
      setActiveCall({ roomID: incomingCall.roomID });
      setIncomingCall(null);
    }
  };

  // Reject incoming call
  const handleRejectCall = () => {
    if (incomingCall && socket) {
      socket.emit("video-call-reject", {
        to: incomingCall.from,
        from: currentUser.id,
        roomID: incomingCall.roomID,
      });
      setIncomingCall(null);
    }
  };

  // Handle user click to open modal
  const handleUserClick = (user: any) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
  };

  // Handle Start Call from modal
  const handleStartCall = async () => {
    if (selectedUser) {
      await handleCallUser(selectedUser);
      setShowUserModal(false);
      setSelectedUser(null);
    }
  };

  // Handle Start Chat (placeholder)
  const handleStartChat = () => {
    // You can implement chat navigation here
    alert("Start Chat with " + (selectedUser?.first_name || selectedUser?.id));
    setShowUserModal(false);
    setSelectedUser(null);
  };

  if (loading) return <div>Loading users...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  if (activeCall) {
    // Join the video call room, pass userName as first_name + last_name
    const userName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : '';
    return (
      <>
        <button
          onClick={handleLeaveCall}
          className="fixed top-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow-lg"
        >
          Leave Call
        </button>
        <ZegoRandomCall key={activeCall.roomID} roomID={activeCall.roomID} userName={userName} />
      </>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-6">
      {/* Incoming Call Notification */}
      {incomingCall && !activeCall && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-pink-200 shadow-lg rounded-lg p-6 flex flex-col items-center animate-fade-in">
          <div className="font-bold text-lg text-pink-600 mb-2">Incoming Call</div>
          <div className="mb-4 text-gray-700">{incomingCall.callerName} is calling you...</div>
          <div className="flex gap-4">
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold"
              onClick={handleAcceptCall}
            >
              Accept
            </button>
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold"
              onClick={handleRejectCall}
            >
              Reject
            </button>
          </div>
        </div>
      )}
      <h2 className="text-center text-xl font-bold text-pink-600 mb-4">Random Video Call</h2>
      <div className="bg-white shadow rounded-lg overflow-hidden p-8 flex flex-col items-center">
        <button
          className="bg-pink-500 hover:bg-pink-600 cursor-pointer text-white px-6 py-3 rounded text-lg font-semibold disabled:opacity-50"
          onClick={handleRandomCall}
          disabled={waitingForMatch}
        >
          {waitingForMatch ? "Waiting for a match..." : "Random Call"}
        </button>
        {waitingForMatch && <div className="mt-4 text-gray-500">Looking for someone to connect...</div>}
      </div>
      {/* User List for Private Call */}
      <div className="bg-white shadow rounded-lg overflow-hidden p-6 mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Start Private Call</h3>
        <div className="grid grid-cols-1 gap-3">
          {users.filter(u => u.id !== currentUser?.id).map(user => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 border rounded hover:bg-pink-50 cursor-pointer"
              onClick={() => handleUserClick(user)}
            >
              <span className="font-medium text-gray-800">{user.first_name || user.id}</span>
              {onlineUsers.some(ou => ou.id === user.id) ? (
                <span className="ml-2 text-green-500 text-xs font-semibold">Online</span>
              ) : (
                <span className="ml-2 text-gray-400 text-xs">Offline</span>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Modal for Start Chat/Call */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-xs relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={handleCloseModal}
              aria-label="Close"
            >
              &times;
            </button>
            <h4 className="text-lg font-bold mb-4 text-center">{selectedUser.first_name || selectedUser.id}</h4>
            <div className="flex flex-col gap-4">
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-semibold"
                onClick={handleStartChat}
              >
                Start Chat
              </button>
              <button
                className="bg-pink-500 hover:bg-pink-600 text-white py-2 rounded font-semibold"
                onClick={handleStartCall}
              >
                Start Call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}