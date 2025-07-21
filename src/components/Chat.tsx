"use client";
// components/Chat.tsx
import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";
import Cookies from 'js-cookie';
import { FaGift } from 'react-icons/fa';
import { FaImage } from 'react-icons/fa';
import { FaRegCommentDots } from 'react-icons/fa';
import { FaMicrophone, FaStop } from 'react-icons/fa';
import { UserService } from "@/lib/user";

// Update socket initialization to include access token
type SocketOptions = {
  auth: {
    token: string;
  };
};

const accessToken = Cookies.get('access_token');

interface Message {
  id: string;
  user_created: { id: string; first_name?: string } | string;
  receiver_id: { id: string; first_name?: string } | string;
  message_type: string | string[];
  message: string;
  date_created: string;
  status: string;
  gift_id?: { gift_image?: string; name_gift?: string };
  media?: { id: string };
  media_url?: string; // Added for image messages
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; first_name?: string }[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; first_name?: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; first_name?: string } | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [gifts, setGifts] = useState<any[]>([]);
  const [selectedGift, setSelectedGift] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [userCoins, setUserCoins] = useState<number>(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [socketUrl, setSocketUrl] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  // Get socket URL on client side only
  useEffect(() => {
    const getSocketUrl = () => {
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        return 'http://localhost:3001';
      }
      return 'wss://socket.wanesni.com';
    };
    setSocketUrl(getSocketUrl());
  }, []);

  // Setup socket connection when userId is available
  useEffect(() => {
    if (!userId || users.length === 0 || !socketUrl) return;

    const newSocket = io(socketUrl, {
      auth: {
        token: accessToken || '',
      },
    });

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket");
      // Get current user info to send with init
      const currentUser = users.find(u => u.id === userId);
      console.log("Current user for init:", currentUser);
      newSocket.emit("init", {
        type: "init",
        userId,
        firstName: currentUser?.first_name || userId
      });
    });

    newSocket.on("message", (data: Message) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    // Listen for online users updates
    newSocket.on("onlineUsers", (onlineUsersList: { id: string; first_name?: string }[]) => {
      console.log("Online users received:", onlineUsersList);
      setOnlineUsers(onlineUsersList);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId, users, socketUrl]); // Add users and socketUrl to dependencies

  // Listen for typing events
  useEffect(() => {
    if (!socket) return;

    const handleTyping = (data: { from: string, to: string }) => {
      // Show typing if the current user is the intended recipient and the sender is the selected user
      if (userId === data.to && selectedUser && data.from === selectedUser.id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 1500);
      }
    };

    socket.on("typing", handleTyping);
    return () => {
      socket.off("typing", handleTyping);
    };
  }, [socket, selectedUser, userId]);

  // Fetch current user ID
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setUserLoading(true);
        setUserLoadError(null);
        const user = await UserService.getCurrentUser();
        setUserId(user.id);
        setUserCoins(user.coins || 0);
        console.log('Loaded user:', user);
      } catch (error: any) {
        setUserLoadError(error?.message || 'Failed to load user');
        setUserId(null);
      }
      setUserLoading(false);
    };
    fetchUser();

    // Only fetch messages if a user is selected
    const fetchMessages = async () => {
      if (!selectedUser) return;
      try {
        const filter = {
          _or: [
            { user_created: { _eq: userId }, receiver_id: { _eq: selectedUser.id } },
            { user_created: { _eq: selectedUser.id }, receiver_id: { _eq: userId } }
          ]
        };
        const response = await axios.get(
          `https://wanesni.com/items/chats`,
          {
            headers: {
              Authorization: accessToken ? `Bearer ${accessToken}` : '',
            },
            params: {
              filter: JSON.stringify(filter),
              sort: 'date_created',
              fields: '*,user_created.first_name,receiver_id.first_name,gift_id.gift_image,gift_id.name_gift,media.id',
            },
          }
        );
        setMessages(response.data.data);
      } catch (error) {
        console.error('Error fetching conversation:', error);
        setMessages([]);
      }
    };
    fetchMessages();

    // Fetch all users (for reference, but we'll use online users for display)
    const fetchUsers = async () => {
      try {
        if (!accessToken) {
          setUserLoadError("Not authenticated. Please log in.");
          setUsers([]);
          return;
        }
        const response = await axios.get("https://wanesni.com/users", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        setUsers(response.data.data);
      } catch (error: any) {
        if (error.response?.status === 403) {
          setUserLoadError("You do not have permission to view users. Please contact support if this is an error.");
        } else {
          setUserLoadError("Error fetching users.");
        }
        setUsers([]);
      }
    };
    fetchUsers();

    // Remove fetchConversation, handled by fetchMessages above
  }, [userId, selectedUser]);

  // Fetch gifts when modal is opened
  useEffect(() => {
    if (showGiftModal && gifts.length === 0) {
      const fetchGifts = async () => {
        try {
          const response = await axios.get('https://wanesni.com/items/gifts', {
            headers: {
              Authorization: accessToken ? `Bearer ${accessToken}` : '',
            },
            params: {
              limit: 500,
              'fields[]': [
                '333ba916.id',
                '333ba916.type',
                '333ba916.title',
                'coins_gift',
                '1dbfd18c',
                'name_gift',
                'id',
              ],
              'alias[333ba916]': 'gift_image',
              'alias[1dbfd18c]': 'gift_image',
              sort: 'id',
              page: 1,
            },
          });
          setGifts(response.data.data);
        } catch (error) {
          console.error('Error fetching gifts:', error);
        }
      };
      fetchGifts();
    }
  }, [showGiftModal, gifts.length]);

  // Handle image selection and preview
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Upload image to Directus when selectedImage changes
  useEffect(() => {
    const uploadImage = async () => {
      if (!selectedImage) return;
      const formData = new FormData();
      formData.append('file', selectedImage);
      try {
        const response = await axios.post('https://wanesni.com/files', formData, {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
            'Content-Type': 'multipart/form-data',
          },
        });
        const uploadedId = response.data.data.id;
        // PATCH to set folder after upload
        await axios.patch(
          `https://wanesni.com/files/${uploadedId}`,
          { folder: '7eb75910-553f-45a9-9758-70fab9a0fa7e' },
          {
            headers: {
              Authorization: accessToken ? `Bearer ${accessToken}` : '',
              'Content-Type': 'application/json',
            },
          }
        );
        setUploadedImageId(uploadedId);
      } catch (error) {
        setSendError('Failed to upload image');
        setSelectedImage(null);
        setImagePreview(null);
      }
    };
    if (selectedImage) uploadImage();
  }, [selectedImage]);

  // Audio recording functions
  const startRecording = async () => {
    try {
      // Simple microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true 
      });
      
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAudioChunks(chunks);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioChunks([]);
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      alert('Please allow microphone access when prompted and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (socket && selectedUser && userId) {
      socket.emit("typing", { to: selectedUser.id, from: userId });
    }
  };

  const sendMessage = async () => {
    setSendError(null);
    console.log('sendMessage called', { userId, selectedUser, messageInput, sending });
    if (!userId) {
      setSendError('User ID not loaded. Please refresh or check login.');
      return;
    }
    if (!selectedUser) {
      setSendError('No receiver selected');
      return;
    }
    // Message is only required if not sending image, audio, or gift
    if (!messageInput.trim() && !selectedGift && !uploadedImageId) {
      setSendError('Message is empty');
      return;
    }
    // Gift coin check
    if (selectedGift && userCoins < (selectedGift.coins_gift || 0)) {
      setSendError('You Should Recharge Your Coins Before Sent This Gift');
      return;
    }
    if (sending) return;
    setSending(true);
    try {
      const payload: any = {
        receiver_id: selectedUser.id,
        message_type: uploadedImageId ? ["media"] : selectedGift ? ["gift"] : ["text"],
        message: messageInput, // message is optional
        status: "sent"
      };
      if (selectedGift) {
        payload.gift_id = selectedGift.id;
      }
      if (uploadedImageId) {
        payload.media = uploadedImageId;
        payload.media_url = uploadedImageId; // Use file ID for Directus image field
      }
      console.log('Sending payload:', payload);
      const response = await axios.post(
        "https://wanesni.com/items/chats",
        payload,
        {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('Message sent, response:', response.data);
      setMessages((prev) => [...prev, {
        ...response.data.data,
        // If this is an image message, ensure media_url is present for immediate rendering
        ...(uploadedImageId ? { media_url: uploadedImageId } : {}),
      }]);
      if (socket) {
        // For gifts, include the full gift object in the socket payload
        let giftPayload = undefined;
        if (selectedGift) {
          giftPayload = {
            ...selectedGift
          };
        }
        socket.emit("message", {
          type: "message",
          to: selectedUser.id,
          message: messageInput, // message is optional
          message_type: uploadedImageId ? ["media"] : selectedGift ? ["gift"] : ["text"],
          gift: giftPayload,
          gift_id: selectedGift ? selectedGift.id : undefined,
          media: uploadedImageId ? uploadedImageId : undefined,
        });
      }
      setMessageInput("");
      setSelectedGift(null);
      setSelectedImage(null);
      setImagePreview(null);
      setUploadedImageId(null);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setSendError(error?.response?.data?.error || error.message || 'Unknown error');
    }
    setSending(false);
  };

  const sendAudioMessage = async () => {
    if (!audioBlob || !selectedUser || !userId) return;

    setSending(true);
    try {
      // Create FormData for audio file
      const formData = new FormData();
      const fileExtension = audioBlob.type.includes('webm') ? 'webm' : 'mp4';
      formData.append('file', audioBlob, `audio.${fileExtension}`);

      // Upload audio file
      const uploadResponse = await axios.post('https://wanesni.com/files', formData, {
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
          'Content-Type': 'multipart/form-data',
        },
      });

      const audioFileId = uploadResponse.data.data.id;
      // PATCH to set folder after upload
      await axios.patch(
        `https://wanesni.com/files/${audioFileId}`,
        { folder: '7eb75910-553f-45a9-9758-70fab9a0fa7e' },
        {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
            'Content-Type': 'application/json',
          },
        }
      );

      // Send audio message
      const payload = {
        receiver_id: selectedUser.id,
        message_type: ["audio"],
        message: "Audio message",
        status: "sent",
        media: audioFileId
      };

      const response = await axios.post(
        "https://wanesni.com/items/chats",
        payload,
        {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
            'Content-Type': 'application/json',
          },
        }
      );

      setMessages((prev) => [...prev, response.data.data]);

      // Emit socket message
      if (socket) {
        socket.emit("message", {
          type: "message",
          to: selectedUser.id,
          message: "Audio message",
          message_type: ["audio"],
          media: audioFileId,
        });
      }

      // Clear audio state
      setAudioBlob(null);
      setAudioUrl(null);
      setAudioChunks([]);
      setMediaRecorder(null);
    } catch (error: any) {
      console.error("Error sending audio:", error);
      setSendError(error?.response?.data?.error || error.message || 'Failed to send audio');
    }
    setSending(false);
  };

  // ... (imports and all state, effects, and logic remain untouched)

// Inside Chat Component JSX:
return (
  <div className="flex flex-col w-full max-w-md mx-auto h-screen bg-white shadow-md">
    {userLoading && <div className="p-4 text-center text-gray-500">Loading user...</div>}
    {userLoadError && <div className="p-4 text-center text-red-500">{userLoadError}</div>}
    {!userLoading && !userLoadError && (
      <>
        <div className="bg-pink-500 text-white p-4">
          <h1 className="text-center text-xl font-bold">Wanesni ChatAPP</h1>
        </div>
        <div className="p-2 border-b border-gray-200 py-5">
          <div className="mb-5 uppercase text-center">Select a user to chat with:</div>
          <div className="flex flex-wrap gap-2">
            {onlineUsers.filter(u => u.id && u.id !== userId).map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`px-3 py-1 cursor-pointer rounded-full ${selectedUser?.id === user.id ? 'bg-pink-500 text-white' : 'bg-gray-200'}`}
                disabled={userLoading || !!userLoadError}
              >
                {user.first_name || user.id}
              </button>
            ))}
          </div>
          {selectedUser && (
            <div className="mt-2 text-sm text-gray-600 text-center">
              Chatting with: <span className="font-bold">{selectedUser.first_name || selectedUser.id}</span>
            </div>
          )}
        </div>
        {!selectedUser && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">
            Start chatting now by selecting a user
          </div>
        )}
        {selectedUser && (
          <div className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-5">
  {messages.map((message, index) => {
    const senderId = typeof message.user_created === 'object' ? message.user_created.id : message.user_created;
    const isMe = senderId === userId;
    const isOther = selectedUser && senderId === selectedUser.id;
    const isGift = Array.isArray(message.message_type)
      ? message.message_type.includes('gift')
      : message.message_type === 'gift';
    const isAudio = Array.isArray(message.message_type)
      ? message.message_type.includes('audio')
      : message.message_type === 'audio';

    return (
      <li
        key={message.id || index}
        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
      >
        {!isMe && (
          <img
            className="inline-block size-9 rounded-full"
            src={`https://ui-avatars.com/api/?name=${
              typeof message.user_created === 'object'
                ? message.user_created.first_name || 'User'
                : 'User'
            }`}
            alt="Avatar"
          />
        )}
        <div
          className={`${
            isMe
              ? 'bg-pink-500 text-white rounded-2xl p-4 space-y-3 max-w-xs ml-2'
              : 'bg-gray-200 text-gray-800 rounded-2xl p-4 space-y-3 max-w-xs mr-2'
          }`}
        >
          {isGift && message.gift_id?.gift_image ? (
            <div className="flex flex-col items-center">
              <img
                src={`https://wanesni.com/assets/${message.gift_id.gift_image}`}
                alt={'Gift'}
                className="w-16 h-16 object-contain mb-1 rounded"
              />
              <span className="text-xs font-semibold text-pink-500">{message.gift_id.name_gift}</span>
              {message.message && <span className="text-xs mt-1 text-gray-800">{message.message}</span>}
            </div>
          ) : isAudio && message.media?.id ? (
            <audio controls className="w-40">
              <source src={`https://wanesni.com/assets/${message.media.id}`} type="audio/webm" />
              <source src={`https://wanesni.com/assets/${message.media.id}`} type="audio/mp3" />
              Your browser does not support the audio element.
            </audio>
          ) : message.media_url ? (
            <div className="flex flex-col items-center">
              <img
                src={`https://wanesni.com/assets/${message.media_url}`}
                alt="Media"
                className="rounded-lg object-cover w-52 h-auto max-h-64"
              />
              {message.message && <p className="text-sm text-gray-800 mt-2">{message.message}</p>}
            </div>
          ) : (
            <div>
              {message.message}
            </div>
          )}
        </div>
        {isMe && (
          <span className="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-gray-600">
            <span className="text-sm font-medium text-white">ME</span>
          </span>
        )}
      </li>
    );
  })}
  {isTyping && (
    <li className="flex items-end text-gray-500">
      <FaRegCommentDots className="mr-2 animate-bounce" />
      <span>{selectedUser?.first_name || 'User'} is typing...</span>
    </li>
  )}
</ul>

          </div>
        )}

        {/* The input section remains unchanged */}
        <div className="p-4 border-t border-gray-200 flex items-end gap-2">
          {/* Image upload */}
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={() => document.getElementById('chat-image-input')?.click()}
            title="Send Image"
          >
            <FaImage className="text-xl text-pink-500" />
          </button>
          <input
            id="chat-image-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />

          {/* Gift send */}
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={() => setShowGiftModal(true)}
            title="Send Gift"
          >
            <FaGift className="text-xl text-yellow-500" />
          </button>

          {/* Audio recording */}
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? "Stop Recording" : "Record Audio"}
          >
            {isRecording ? (
              <FaStop className="text-xl text-red-500 animate-pulse" />
            ) : (
              <FaMicrophone className="text-xl text-blue-500" />
            )}
          </button>

          {/* Message input */}
          <input
            type="text"
            className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
            placeholder="Type your message..."
            value={messageInput}
            onChange={handleInputChange}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={sending}
          />

          {/* Send button */}
          <button
            type="button"
            className="ml-2 px-4 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 disabled:opacity-50"
            onClick={sendMessage}
            disabled={sending || (!messageInput.trim() && !selectedGift && !uploadedImageId)}
            title="Send"
          >
            Send
          </button>
        </div>

        {/* Image preview modal */}
        {imagePreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 max-w-xs w-full flex flex-col items-center">
              <img src={imagePreview} alt="Preview" className="rounded-lg mb-4 max-h-64" />
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  onClick={() => setImagePreview(null)}
                >
                  OK
                </button>
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gift modal */}
        {showGiftModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-lg font-bold mb-4">Select a Gift</h2>
              <div className="grid grid-cols-3 gap-4 max-h-64 overflow-y-auto">
                {gifts.map(gift => (
                  <button
                    key={gift.id}
                    className={`flex flex-col items-center p-2 border rounded-lg hover:bg-pink-50 ${selectedGift?.id === gift.id ? 'border-pink-500' : 'border-gray-200'}`}
                    onClick={() => setSelectedGift(gift)}
                  >
                    <img src={`https://wanesni.com/assets/${gift.gift_image}`} alt={gift.name_gift} className="w-12 h-12 object-contain mb-1" />
                    <span className="text-xs font-semibold text-pink-500">{gift.name_gift}</span>
                    <span className="text-xs text-gray-600">{gift.coins_gift} coins</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  onClick={() => setShowGiftModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600"
                  onClick={() => setShowGiftModal(false)}
                  disabled={!selectedGift}
                >
                  Select
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )}
  </div>
);

};

export default Chat;
