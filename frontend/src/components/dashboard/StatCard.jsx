import React from 'react';

const StatCard = ({ title, value, icon, trend, colorClass = 'bg-[#eaf2ff] text-[#1768d1]' }) => {
  return (
    <div className="card h-[110px] flex items-center p-5 gap-4 hover:border-[#1768d1] group transition-all">
      <div className={`w-12 h-12 rounded-[5px] flex items-center justify-center shrink-0 transition-colors border border-black/5 ${colorClass}`}>
        {React.cloneElement(icon, { size: 24, strokeWidth: 2.5 })}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-[700] text-[#64748b] uppercase tracking-widest truncate">{title}</p>
        <h3 className="text-[28px] font-[800] text-[#0f172a] leading-tight mt-1">{value}</h3>
      </div>
      {trend && (
        <div className="text-right">
          <span className={`text-[10px] font-[700] px-2 py-1 rounded-[5px] uppercase tracking-wider border ${
            trend.startsWith('+') || trend === 'Live Nodes' || trend === 'Live' ? 'text-[#0e7a42] bg-[#edfcf4] border-[#b7efcf]' : 'text-[#1768d1] bg-[#eaf2ff] border-[#b7efcf]'
          }`}>
            {trend}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
