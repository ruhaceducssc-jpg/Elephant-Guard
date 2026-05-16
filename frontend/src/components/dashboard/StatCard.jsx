import React from 'react';

const StatCard = ({ title, value, icon, trend }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
        {trend && (
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full mt-2 inline-block">
            {trend}
          </span>
        )}
      </div>
      <div className="p-3 bg-gray-50 rounded-lg">
        {React.cloneElement(icon, { size: 24 })}
      </div>
    </div>
  );
};

export default StatCard;
