import React from 'react';

const StatCard = ({ title, value, icon, trend }) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-soft flex items-start justify-between group hover:border-primary-100 transition-all duration-300">
      <div>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg mt-3 inline-block uppercase tracking-wider ${
            trend.startsWith('+') || trend === 'Live' ? 'text-success-700 bg-success-50' : 'text-primary-700 bg-primary-50'
          }`}>
            {trend}
          </span>
        )}
      </div>
      <div className="p-3.5 bg-slate-50 rounded-xl group-hover:bg-primary-600 group-hover:text-white transition-all duration-500 shadow-sm border border-slate-100">
        {React.cloneElement(icon, { size: 20 })}
      </div>
    </div>
  );
};

export default StatCard;
