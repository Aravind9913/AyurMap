import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import useChat from '@/hooks/useChat';
import { API_CONFIG, API_ENDPOINTS } from '@/lib/api';
import { apiCall } from '@/lib/api';

interface Chat {
    _id: string;
    plantId: any;
    farmerId?: any;
    userId?: any;
    plantName: string;
    messages: any[];
}

interface ChatWindowProps {
    chat: Chat | null;
    role: 'farmer' | 'consumer' | 'admin';
    onBack?: () => void;
}

export default function ChatWindow({ chat, role, onBack }: ChatWindowProps) {
    const { user } = useUser();
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const { messages, sendMessage, isConnected, isTyping, isPolling } = useChat({
        chatId: chat?._id || null,
        isAdmin: role === 'admin',
    });

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (messagesContainerRef.current) {
                scrollToBottom();
            }
        }, 100);
        return () => clearTimeout(timeout);
    }, [chat]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!messageText.trim() || !chat || role === 'admin') return;

        try {
            setIsSending(true);
            await sendMessage(messageText);
            setMessageText('');
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const isMyMessage = (message: any) => {
        const myEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
        return message.senderEmail === myEmail;
    };

    const getOtherParticipant = () => {
        if (role === 'farmer') {
            return chat?.userId;
        } else if (role === 'consumer') {
            return chat?.farmerId;
        }
        return null;
    };

    const formatTime = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    if (!chat) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-gray-500 text-lg">Select a chat to start messaging</p>
                </div>
            </div>
        );
    }

    const otherParticipant = getOtherParticipant();

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                        >
                            ←
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        {otherParticipant?.firstName ? (
                            <span className="text-emerald-700 font-semibold">
                                {otherParticipant.firstName[0]}{otherParticipant.lastName?.[0]}
                            </span>
                        ) : (
                            <span className="text-emerald-700">👤</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                            {otherParticipant?.firstName} {otherParticipant?.lastName}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            {isPolling && <span className="text-amber-600">Polling...</span>}
                            {isConnected && <span className="text-emerald-600">● Online</span>}
                            {!isConnected && !isPolling && <span className="text-gray-400">Offline</span>}
                        </div>
                    </div>
                </div>
                {chat.plantId && (
                    <div className="mt-2 text-sm text-gray-600">
                        Chat about: <span className="font-medium">{chat.plantName}</span>
                    </div>
                )}
            </div>

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50"
            >
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                        <p>No messages yet</p>
                        <p className="text-sm mt-2">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((message, index) => {
                        const isMine = isMyMessage(message);
                        const showAvatar = index === 0 || messages[index - 1].senderEmail !== message.senderEmail;

                        return (
                            <div
                                key={message._id || index}
                                className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {!isMine && showAvatar && (
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                        <span className="text-emerald-700 text-xs font-semibold">
                                            {message.senderName?.charAt(0) || 'U'}
                                        </span>
                                    </div>
                                )}
                                {!isMine && !showAvatar && <div className="w-8" />}

                                <div
                                    className={`max-w-[70%] rounded-lg px-4 py-2 ${isMine
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-gray-900 border border-gray-200'
                                        }`}
                                >
                                    {!isMine && (
                                        <div className="text-xs font-semibold mb-1 opacity-80">
                                            {message.senderName}
                                        </div>
                                    )}
                                    <div className="text-sm whitespace-pre-wrap break-words">{message.message}</div>
                                    <div
                                        className={`text-xs mt-1 ${isMine ? 'text-emerald-100' : 'text-gray-500'
                                            }`}
                                    >
                                        {formatTime(message.timestamp)}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                {isTyping && (
                    <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-700 text-xs font-semibold">
                                {otherParticipant?.firstName?.charAt(0) || 'U'}
                            </span>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {role !== 'admin' && (
                <div className="p-4 border-t border-gray-200 bg-white">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Type a message..."
                            disabled={isSending}
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!messageText.trim() || isSending}
                            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSending ? 'Sending...' : 'Send'}
                        </button>
                    </form>
                </div>
            )}

            {role === 'admin' && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="text-sm text-gray-500 text-center">
                        Admin view only - Cannot send messages
                    </div>
                </div>
            )}
        </div>
    );
}

