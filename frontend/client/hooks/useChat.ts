import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@clerk/clerk-react';
import { API_CONFIG, API_ENDPOINTS } from '@/lib/api';
import { apiCall } from '@/lib/api';

interface Message {
    _id?: string;
    senderId: string;
    senderEmail: string;
    senderName: string;
    senderRole: string;
    message: string;
    messageType: string;
    timestamp: Date | string;
    isRead: boolean;
}

interface Chat {
    _id: string;
    plantId: any;
    farmerId: any;
    userId: any;
    plantName: string;
    messages: Message[];
    lastMessageAt: Date | string;
    unreadCount: {
        farmer: number;
        user: number;
    };
    participants: Array<{
        userId: string;
        email: string;
        name: string;
        role: string;
    }>;
}

interface UseChatOptions {
    chatId: string | null;
    isAdmin?: boolean;
}

export function useChat({ chatId, isAdmin = false }: UseChatOptions) {
    const { getToken } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize Socket.io connection
    useEffect(() => {
        if (!chatId || isAdmin) return;

        const initSocket = async () => {
            try {
                const token = await getToken({ template: 'ayurmap_backend' });

                socketRef.current = io(API_CONFIG.BASE_URL, {
                    auth: { token },
                    transports: ['websocket', 'polling'],
                });

                socketRef.current.on('connect', () => {
                    console.log('✅ Socket.io connected');
                    setIsConnected(true);
                    setIsPolling(false);

                    // Clear any polling
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }

                    // Join the chat room
                    if (chatId) {
                        socketRef.current?.emit('join-chat', chatId);
                    }
                });

                socketRef.current.on('disconnect', () => {
                    console.log('❌ Socket.io disconnected');
                    setIsConnected(false);

                    // Fallback to polling
                    startPolling();
                });

                socketRef.current.on('receive-message', (data: any) => {
                    const newMessage: Message = data.message;
                    setMessages((prev) => [...prev, newMessage]);
                });

                socketRef.current.on('typing-start', () => {
                    setIsTyping(true);
                });

                socketRef.current.on('typing-stop', () => {
                    setIsTyping(false);
                });

                // Handle connection errors
                socketRef.current.on('connect_error', (error) => {
                    console.error('Socket.io connection error:', error);
                    setIsConnected(false);
                    startPolling(); // Fallback to polling on connection error
                });
            } catch (error) {
                console.error('Socket.io initialization error:', error);
                startPolling(); // Start polling if socket initialization fails
            }
        };

        initSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [chatId, isAdmin, getToken]);

    // Polling fallback
    const startPolling = useCallback(() => {
        if (pollingIntervalRef.current || !chatId) return;

        console.log('🔄 Starting polling fallback');
        setIsPolling(true);

        const fetchMessages = async () => {
            try {
                const token = await getToken({ template: 'ayurmap_backend' });
                const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_DETAILS}/${chatId}`;

                const response = await apiCall(url, { method: 'GET' }, token);

                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        setMessages(data.data.messages || []);
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        };

        // Initial fetch
        fetchMessages();

        // Set up interval
        pollingIntervalRef.current = setInterval(fetchMessages, 3000);
    }, [chatId, getToken]);

    // Send message
    const sendMessage = async (messageText: string) => {
        if (!chatId || !messageText.trim()) return;

        try {
            const token = await getToken({ template: 'ayurmap_backend' });
            const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_MESSAGES}/${chatId}/messages`;

            const response = await apiCall(
                url,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        message: messageText,
                        messageType: 'text',
                    }),
                },
                token
            );

            if (response.ok) {
                const data = await response.json();

                // If Socket.io is connected, emit through it
                if (socketRef.current && isConnected) {
                    socketRef.current.emit('send-message', {
                        chatId,
                        message: data.data.message,
                        sender: {
                            id: data.data.message.senderId,
                            name: data.data.message.senderName,
                            role: data.data.message.senderRole,
                        },
                    });
                }

                // Add to local state
                setMessages((prev) => [...prev, data.data.message]);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    };

    // Load messages
    const loadMessages = async () => {
        if (!chatId) {
            setMessages([]);
            return;
        }

        try {
            const token = await getToken({ template: 'ayurmap_backend' });
            const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_DETAILS}/${chatId}`;

            const response = await apiCall(url, { method: 'GET' }, token);

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    setMessages(data.data.messages || []);
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    };

    // Typing indicators
    const startTyping = () => {
        if (socketRef.current && chatId) {
            socketRef.current.emit('typing-start', { chatId });
        }
    };

    const stopTyping = () => {
        if (socketRef.current && chatId) {
            socketRef.current.emit('typing-stop', { chatId });
        }
    };

    return {
        messages,
        isConnected,
        isTyping,
        isPolling,
        sendMessage,
        loadMessages,
        startTyping,
        stopTyping,
    };
}

export default useChat;

