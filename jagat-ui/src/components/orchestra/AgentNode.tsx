"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface AgentNodeProps {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: 'idle' | 'working' | 'done';
  x: number;
  y: number;
}

export function AgentNode({ name, description, icon: Icon, status, x, y }: AgentNodeProps) {
  const isWorking = status === 'working';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, x, y }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="absolute flex flex-col items-center w-64"
      style={{ left: 0, top: 0 }}
    >
      <motion.div
        animate={isWorking ? { y: [0, -4, 0] } : { y: 0 }}
        transition={{ repeat: isWorking ? Infinity : 0, duration: 2, ease: "easeInOut" }}
        className={`relative z-10 flex flex-col items-center bg-white border rounded-xl p-4 shadow-sm backdrop-blur-sm transition-colors duration-300 ${
          isWorking ? 'border-indigo-300 shadow-indigo-100/50' : 'border-gray-200'
        }`}
      >
        {/* Status Indicator Glow */}
        {isWorking && (
          <motion.div
            className="absolute inset-0 bg-indigo-50/50 rounded-xl -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          />
        )}
        
        <div className="flex items-center justify-between w-full mb-3">
          <div className="p-2 bg-gray-50 border border-gray-100 rounded-lg">
            <Icon className={`w-5 h-5 ${isWorking ? 'text-indigo-600' : 'text-gray-500'}`} />
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${
              status === 'working' ? 'bg-indigo-500' : 
              status === 'done' ? 'bg-emerald-500' : 'bg-gray-300'
            }`} />
            <span className="text-[10px] font-medium tracking-wider text-gray-500 uppercase">
              {status}
            </span>
          </div>
        </div>
        
        <div className="w-full text-left">
          <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
