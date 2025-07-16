"use client";
// components/Chat.tsx
import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";
import Cookies from 'js-cookie';
import { FaGift } from 'react-icons/fa';
import { FaImage } from 'react-icons/fa';
import { FaRegCommentDots } from 'react-icons/fa';

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
}

const getSocketUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  return 'wss://socket.wanesni.com';
};

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; first_name?: string }[]>([]);
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

  // Setup socket connection when userId is available
  useEffect(() => {
    if (!userId) return;

    const newSocket = io(getSocketUrl(), {
      auth: {
        token: accessToken || '',
      },
    });

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket");
      newSocket.emit("init", { type: "init", userId });
    });

    newSocket.on("message", (data: Message) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId]);

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
    const fetchUserId = async () => {
      try {
        setUserLoading(true);
        setUserLoadError(null);
        const response = await axios.get("https://wanesni.com/users/me", {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
          },
        });
        console.log('/users/me response:', response.data);
        if (response.data && response.data.data && response.data.data.id) {
          setUserId(response.data.data.id);
          setUserCoins(response.data.data.coins || 0);
          console.log('Loaded userId:', response.data.data.id);
        } else {
          setUserLoadError('User ID not found in /users/me response: ' + JSON.stringify(response.data));
          setUserId(null);
        }
      } catch (error: any) {
        setUserLoadError(error?.response?.data?.error || error.message || 'Failed to load user');
        setUserId(null);
      }
      setUserLoading(false);
    };
    fetchUserId();

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

    // Fetch all users
    const fetchUsers = async () => {
      try {
        const response = await axios.get("https://wanesni.com/users", {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
          },
        });
        setUsers(response.data.data);
      } catch (error) {
        console.error("Error fetching users:", error);
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
        setUploadedImageId(response.data.data.id);
      } catch (error) {
        setSendError('Failed to upload image');
        setSelectedImage(null);
        setImagePreview(null);
      }
    };
    if (selectedImage) uploadImage();
  }, [selectedImage]);

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
        message: messageInput,
        status: "sent"
      };
      if (selectedGift) {
        payload.gift_id = selectedGift.id;
      }
      if (uploadedImageId) {
        payload.media = uploadedImageId;
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
      setMessages((prev) => [...prev, response.data.data]);
      if (socket) {
        socket.emit("message", {
          type: "message",
          to: selectedUser.id,
          message: messageInput,
          message_type: uploadedImageId ? ["media"] : selectedGift ? ["gift"] : ["text"],
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
              {users.filter(u => u.id && u.id !== userId).map((user) => (
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
              <div className="mt-2 text-sm text-gray-600 text-center">Chatting with: <span className="font-bold">{selectedUser.first_name || selectedUser.id}</span></div>
            )}
          </div>
          {!selectedUser && (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">
              Start chatting now by selecting a user
            </div>
          )}
          {selectedUser && (
            <div className="flex-1 p-4 overflow-y-auto">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-10">Start Texting "{selectedUser.first_name || selectedUser.id}" Now</div>
              )}
              {messages.map((message, index) => {
                const senderId = typeof message.user_created === 'object' ? message.user_created.id : message.user_created;
                const isMe = senderId === userId;
                const isOther = selectedUser && senderId === selectedUser.id;
                // Debug log
                console.log('Message debug:', {
                  senderId,
                  userId,
                  selectedUserId: selectedUser?.id,
                  isMe,
                  isOther,
                  message
                });
                const isGift = Array.isArray(message.message_type)
                  ? message.message_type.includes('gift')
                  : message.message_type === 'gift';
                return (
                  <div
                    key={message.id || index}
                    className={`flex mb-3 ${isOther ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-2xl shadow text-sm break-words 
                        ${isOther ? 'bg-pink-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-900 rounded-bl-none'}
                      `}
                      style={{ minWidth: '80px' }}
                    >
                      <div className="font-bold mb-1 text-xs opacity-70">
                        {typeof message.user_created === 'object'
                          ? message.user_created.first_name || message.user_created.id
                          : message.user_created}
                      </div>
                      {isGift && message.gift_id?.gift_image ? (
                        <div className="flex flex-col items-center">
                          <img
                            src={`https://wanesni.com/assets/${message.gift_id.gift_image}`}
                            alt={'Gift'}
                            className="w-16 h-16 object-contain mb-1 rounded"
                          />
                          <span className="text-xs font-semibold text-pink-200">{message.gift_id.name_gift}</span>
                          {message.message && <span className="text-xs mt-1">{message.message}</span>}
                        </div>
                      ) : message.media?.id ? (
                        <div className="flex flex-col items-center">
                          <img
                            src={`https://wanesni.com/assets/${message.media.id}`}
                            alt={'Media'}
                            className="w-32 h-32 object-contain mb-1 rounded"
                          />
                          {message.message && <span className="text-xs mt-1">{message.message}</span>}
                        </div>
                      ) : (
                        <div>{message.message}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="p-4 border-t border-gray-200 flex">
            {/* Gift Icon */}
            <button
              type="button"
              className="mr-2 flex items-center justify-center text-pink-500 hover:text-pink-700 focus:outline-none"
              onClick={() => setShowGiftModal(true)}
              style={{ fontSize: 24 }}
            >
              <FaGift />
            </button>
            {/* Image Icon */}
            <label className="mr-2 flex items-center justify-center text-pink-500 hover:text-pink-700 focus:outline-none cursor-pointer" style={{ fontSize: 24 }}>
              <FaImage />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            {imagePreview && (
              <div className="flex items-center ml-2 bg-pink-100 px-2 py-1 rounded-full text-pink-700 text-xs">
                <img src={imagePreview} alt="preview" className="w-8 h-8 object-contain rounded mr-1" />
                <button
                  type="button"
                  className="ml-1 text-pink-500 hover:text-pink-700"
                  onClick={() => { setSelectedImage(null); setImagePreview(null); setUploadedImageId(null); }}
                >
                  ×
                </button>
              </div>
            )}
            <input
              type="text"
              className="flex-1 border rounded-l px-3 py-2 focus:outline-none"
              placeholder="Type your message..."
              value={messageInput}
              onChange={handleInputChange}
              disabled={sending}
            />
            {isTyping && (
              <div className="flex items-center text-gray-500 mt-2">
                <FaRegCommentDots className="mr-2 animate-bounce" />
                <span>{selectedUser?.first_name || "User"} is typing...</span>
              </div>
            )}
            {selectedGift && (
              <div className="flex items-center ml-2 bg-pink-100 px-2 py-1 rounded-full text-pink-700 text-xs">
                <FaGift className="mr-1" />
                {selectedGift.name_gift}
                <button
                  type="button"
                  className="ml-1 text-pink-500 hover:text-pink-700"
                  onClick={() => setSelectedGift(null)}
                >
                  ×
                </button>
              </div>
            )}
            <button
              onClick={sendMessage}
              className={`bg-pink-500 text-white p-2 rounded-r-lg hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-500 ${sending || !selectedUser || !messageInput.trim() && !selectedGift || userLoading || userLoadError ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={sending || !selectedUser || (!messageInput.trim() && !selectedGift) || userLoading || !!userLoadError}
            >
              Send
            </button>
            {/* Gift Modal */}
            {showGiftModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-lg relative">
                  <button
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
                    onClick={() => setShowGiftModal(false)}
                  >
                    ×
                  </button>
                  <h2 className="text-lg font-bold mb-4 text-center">Select a Gift</h2>
                  <div className="grid grid-cols-3 gap-4 max-h-80 overflow-y-auto">
                    {gifts.map((gift) => (
                      <div
                        key={gift.id}
                        className="flex flex-col items-center cursor-pointer hover:bg-pink-100 p-2 rounded-lg border border-transparent hover:border-pink-300"
                        onClick={() => {
                          setSelectedGift(gift);
                          setShowGiftModal(false);
                        }}
                      >
                        {gift.gift_image && (
                          <img
                            src={`https://wanesni.com/assets/${gift.gift_image.id}`}
                            alt={gift.name_gift}
                            className="w-12 h-12 object-contain mb-1 rounded"
                          />
                        )}
                        <span className="text-xs font-semibold text-gray-700">{gift.name_gift}</span>
                        <span className="text-xs text-pink-500">{gift.coins_gift} coins</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Chat;
