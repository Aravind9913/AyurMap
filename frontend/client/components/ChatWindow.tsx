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

    const { messages, sendMessage, isConnected, isTyping, isPolling, otherPersonTyping, startTyping, stopTyping } = useChat({
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
        if (!messageText.trim() || !chat || role === 'admin' || !chat._id) return;

        try {
            setIsSending(true);
            await sendMessage(messageText);
            setMessageText('');
            await stopTyping(); // Stop typing indicator after sending
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    // Handle typing detection
    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value.length > 0 && !isSending) {
            startTyping();
        } else {
            stopTyping();
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
            <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-gray-50 via-emerald-50/30 to-gray-50">
                <div className="text-center max-w-md px-6">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center shadow-xl">
                        <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No conversation selected</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">Choose a conversation from the list to start messaging</p>
                </div>
            </div>
        );
    }

    const otherParticipant = getOtherParticipant();

    return (
        <div className="flex flex-col h-full bg-white w-full">
            {/* Simple Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                            ←
                        </button>
                    )}
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                            <img
                                src={(otherParticipant as any)?.profileImage || `https://ui-avatars.com/api/?name=${otherParticipant?.firstName}+${otherParticipant?.lastName}&background=10b981&color=fff`}
                                alt={`${otherParticipant?.firstName} ${otherParticipant?.lastName}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${otherParticipant?.firstName}+${otherParticipant?.lastName}&background=10b981&color=fff`;
                                }}
                            />
                        </div>
                        {isConnected && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                            {otherParticipant?.firstName} {otherParticipant?.lastName}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            {isConnected && <span className="text-emerald-600">Online</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-6 py-2 bg-gray-50"
            >
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                        <p>No messages yet</p>
                    </div>
                ) : (
                    messages.map((message, index) => {
                        const isMine = isMyMessage(message);
                        const showAvatar = index === 0 || messages[index - 1].senderEmail !== message.senderEmail;

                        return (
                            <div
                                key={message._id || index}
                                className={`flex gap-3 mb-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {!isMine && showAvatar && (
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md">
                                        <span className="text-white text-xs font-semibold">
                                            {message.senderName?.charAt(0) || 'U'}
                                        </span>
                                    </div>
                                )}
                                {!isMine && !showAvatar && <div className="w-9" />}

                                <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                                    <div
                                        className={`rounded-lg px-3 py-2 ${isMine
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-white text-gray-900 border border-gray-200'
                                            }`}
                                    >
                                        <div className="text-sm">{message.message}</div>
                                        <div className={`text-xs mt-1 flex items-center gap-1 ${isMine ? 'text-emerald-100' : 'text-gray-400'}`}>
                                            {isMine && (
                                                <span className="text-xs" title={message.isRead ? 'Read' : 'Sent'}>
                                                    {message.isRead ? '✓✓' : '✓'}
                                                </span>
                                            )}
                                            <span>{formatTime(message.timestamp)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                {otherPersonTyping && (
                    <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-semibold">
                                {otherParticipant?.firstName?.charAt(0) || 'U'}
                            </span>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Simple Input */}
            {role !== 'admin' && (
                <div className="p-4 border-t border-gray-200 bg-white">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={messageText}
                            onChange={(e) => {
                                setMessageText(e.target.value);
                                handleTyping(e);
                            }}
                            onBlur={stopTyping}
                            placeholder="Type a message..."
                            disabled={isSending}
                            className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                        />
                        <button
                            type="submit"
                            disabled={!messageText.trim() || isSending}
                            className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-50 text-sm font-medium"
                        >
                            {isSending ? 'Sending...' : 'Send'}
                        </button>
                    </form>
                </div>
            )}

            {role === 'admin' && (
                <div className="p-4 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
                    Read-only mode
                </div>
            )}
        </div>
    );
}


