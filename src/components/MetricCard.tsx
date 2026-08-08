import React from 'react';
import { motion } from 'motion/react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export default function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
  // Determine text color for value based on value content
  const valueColor = 
    value === 'ONLINE' || value === 'ACTIVE'
      ? 'text-emerald-500' 
      : value === 'OFFLINE' || value === 'FAILED'
      ? 'text-rose-500' 
      : 'text-slate-900';

  // Check if value is a numeric or financial stat to apply font-mono
  const isNumeric = typeof value === 'number' || /^[+\-]?\$?\d+/.test(String(value));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 transition-colors duration-200 hover:border-blue-500/30 hover:shadow-md cursor-default"
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-display">
            {title}
          </span>
          <h3 className={`text-2xl font-bold ${isNumeric ? 'font-mono' : 'font-display'} ${valueColor} mt-1.5 tracking-tight`}>
            {value}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-1 italic font-sans leading-tight">
              {subtitle}
            </p>
          )}
        </div>
        <div className="p-3 bg-slate-50 text-[#2563eb] rounded-xl border border-slate-100 shadow-sm">
          {icon}
        </div>
      </div>

      {trend && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-mono">
          <span className={`font-semibold ${trend.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
            {trend.value}
          </span>
          <span className="text-slate-400">vs last period</span>
        </div>
      )}
    </motion.div>
  );
}

