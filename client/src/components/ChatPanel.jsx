import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getChatHistory } from '../services/api';
import { Send, Lock, Globe } from 'lucide-react';

export default function ChatPanel({ roomId, userId, userName, socket }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatType, setChatType] = useState('group');
  const [privateRecipient, setPrivateRecipient] = useState(null);
  const bottomRef = useRef(null);

  // Load chat history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await getChatHistory(roomId, 'group');
        setMessages(res.data.messages || []);
      } catch { /* ignore */ }
    };
    loadHistory();
  }, [roomId]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      setMessages(prev => [...prev, msg]);
    };
    socket.on('chat:message', handler);
    return () => socket.off('chat:message', handler);
  }, [socket]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback((e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    socket.emit('chat:send', {
      roomId,
      content: input.trim(),
      senderName: userName,
      senderId: userId,
      type: chatType,
      recipientId: privateRecipient?.userId,
      recipientName: privateRecipient?.userName
    });
    setInput('');
  }, [input, socket, roomId, userName, userId, chatType, privateRecipient]);

  const displayMessages = messages.filter(m => {
    if (chatType === 'group') return m.type === 'group' || !m.type;
    return m.type === 'private' && (m.senderId === userId || m.recipientId === userId);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Chat type toggle */}
      <div className="flex gap-1 p-3 border-b border-dark-800">
        <button onClick={() => setChatType('group')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${chatType === 'group' ? 'bg-primary-500/20 text-primary-400' : 'text-dark-400 hover:bg-dark-800'}`}>
          <Globe className="w-3.5 h-3.5" /> Group
        </button>
        <button onClick={() => setChatType('private')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${chatType === 'private' ? 'bg-accent-500/20 text-accent-400' : 'text-dark-400 hover:bg-dark-800'}`}>
          <Lock className="w-3.5 h-3.5" /> Private
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {displayMessages.length === 0 ? (
          <div className="text-center text-dark-500 text-sm py-8">No messages yet</div>
        ) : (
          displayMessages.map((msg, i) => {
            const isOwn = msg.senderId === userId;
            return (
              <div key={msg._id || i} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-dark-500 mb-1">
                  {isOwn ? 'You' : msg.senderName}
                  {msg.type === 'private' && <span className="text-accent-400 ml-1">(DM)</span>}
                </span>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${isOwn
                    ? 'bg-primary-600/20 text-primary-100 rounded-br-sm'
                    : 'bg-dark-800 text-dark-200 rounded-bl-sm'
                  }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-dark-600 mt-0.5">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 border-t border-dark-800">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            placeholder={chatType === 'private' ? 'Private message...' : 'Type a message...'}
            className="flex-1 px-3 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-colors" />
          <button type="submit"
            className="p-2.5 bg-primary-600 hover:bg-primary-500 rounded-xl transition-colors disabled:opacity-50"
            disabled={!input.trim()}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
