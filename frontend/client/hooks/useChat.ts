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
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load messages function
    const loadMessages = useCallback(async () => {
        if (!chatId) {
            setMessages([]);
            return;
        }

        try {
            const token = await getToken({ template: 'ayurmap_backend' });
            const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_DETAILS}/${chatId}`;

            console.log('📥 Loading messages for chat:', chatId);

            const response = await apiCall(url, { method: 'GET' }, token);

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    console.log('✅ Loaded messages:', data.data.messages?.length || 0);
                    setMessages(data.data.messages || []);
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }, [chatId, getToken]);

    // Polling for real-time updates
    const startPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        console.log('🔄 Starting polling for chat:', chatId);
        setIsPolling(true);

        const fetchMessages = async () => {
            try {
                const token = await getToken({ template: 'ayurmap_backend' });
                const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_DETAILS}/${chatId}`;

                const response = await apiCall(url, { method: 'GET' }, token);

                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        const newMessages = data.data.messages || [];
                        // Always update to get latest messages
                        setMessages(newMessages);
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        };

        // Initial fetch
        fetchMessages();

        // Set up interval - check every 2 seconds
        pollingIntervalRef.current = setInterval(fetchMessages, 2000);
    }, [chatId, getToken]);

    // Load messages on mount
    useEffect(() => {
        if (chatId) {
            loadMessages();
        }
    }, [chatId, loadMessages]);

    // Always use polling for real-time updates
    useEffect(() => {
        if (!chatId || isAdmin) return;

        // Start polling immediately
        console.log('🔄 Starting polling for chat:', chatId);
        startPolling();

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [chatId, isAdmin, startPolling]);

    // Send message
    const sendMessage = async (messageText: string) => {
        if (!chatId || !messageText.trim()) return;

        try {
            const token = await getToken({ template: 'ayurmap_backend' });
            const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_MESSAGES}/${chatId}/messages`;

            console.log('📤 Sending message:', messageText);

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
                console.log('✅ Message sent successfully:', data);

                // Add message locally for immediate feedback
                // Backend will emit via Socket.io to other participants
                const newMessage = data.data.message;
                setMessages((prev) => {
                    // Prevent duplicates
                    const exists = prev.some(m => m._id === newMessage._id);
                    if (exists) return prev;
                    return [...prev, newMessage];
                });
            }
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
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

