import React, { useState, useRef, useEffect, useCallback } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { getRandomReply, formatFullLabel, isSameDay, distanceMinutes } from './types';
import type { ChatMessage, DisplayItem } from './types';

export default function ChatPage({
  addNotification,
}: {
  addNotification?: (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success',
  ) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '神经连接已建立。我是您的执行协助系统。当前区域环境读数正常。请问有什么可以帮您？',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location] = useState('新东京枢纽');
  const [weather] = useState({ icon: '晴', temp: 22, humidity: 45 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* live clock */
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  /* ---------- send ---------- */
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const delay = 800 + Math.random() * 1400;
    setTimeout(() => {
      const reply: ChatMessage = {
        role: 'assistant',
        content: getRandomReply(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);

      addNotification?.(
        '新讯息',
        '系统有一条新的回复待查看。',
        'info',
      );
    }, delay);
  }, [input, isTyping, addNotification]);

  /* ---------- copy ---------- */
  const handleCopy = useCallback(async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  /* ---------- build display list ---------- */
  const buildDisplayList = useCallback(
    (msgs: ChatMessage[]): DisplayItem[] => {
      if (msgs.length === 0) return [];

      const list: DisplayItem[] = [{ type: 'msg', msg: msgs[0], idx: 0 }];
      let globalIdx = 0;

      for (let i = 1; i < msgs.length; i++) {
        globalIdx++;
        const prev = msgs[i - 1].timestamp;
        const curr = msgs[i].timestamp;
        if (
          !isSameDay(prev, curr) ||
          distanceMinutes(prev, curr) > 5
        ) {
          list.push({ type: 'sep', label: formatFullLabel(curr), date: curr });
        }
        list.push({ type: 'msg', msg: msgs[i], idx: globalIdx });
      }

      return list;
    },
    [],
  );

  const displayItems = buildDisplayList(messages);

  /* ---------- keyboard ---------- */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col w-full glass-panel border-glow relative overflow-hidden">
        {/* HUD corner brackets */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-aether-cyan/30 pointer-events-none z-20" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-aether-cyan/30 pointer-events-none z-20" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-aether-cyan/20 pointer-events-none z-20" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-aether-cyan/20 pointer-events-none z-20" />

        <ChatHeader
          currentTime={currentTime}
          location={location}
          weather={weather}
        />

        <MessageList
          displayItems={displayItems}
          isTyping={isTyping}
          copiedIdx={copiedIdx}
          onCopy={handleCopy}
          messagesEndRef={messagesEndRef}
        />

        <InputArea
          input={input}
          setInput={setInput}
          isTyping={isTyping}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          isFocused={isFocused}
          setIsFocused={setIsFocused}
          optionsOpen={optionsOpen}
          setOptionsOpen={setOptionsOpen}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
