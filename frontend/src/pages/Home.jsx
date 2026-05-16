import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight, MapPin, Bell, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-primary-600" size={32} />
          <span className="font-bold text-xl text-gray-900 tracking-tight">Elephant Alert <span className="text-primary-600">SL</span></span>
        </div>
        {isAuthenticated ? (
          <Link 
            to="/dashboard" 
            className="bg-primary-600 text-white px-6 py-2 rounded-full font-bold hover:bg-primary-700 transition"
          >
            Dashboard
          </Link>
        ) : (
          <Link 
            to="/login" 
            className="bg-primary-600 text-white px-6 py-2 rounded-full font-bold hover:bg-primary-700 transition"
          >
            Guard Login
          </Link>
        )}
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight">
            Protecting Communities, <br/> 
            <span className="text-primary-600">Preserving Nature.</span>
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
            A state-of-the-art elephant detection and alert system designed for the borders of Sri Lanka's national parks.
          </p>
          <div className="flex gap-4">
            <Link to={isAuthenticated ? "/dashboard" : "/login"} className="bg-primary-600 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-primary-700 transition shadow-lg shadow-primary-200">
              {isAuthenticated ? "Go to Dashboard" : "Get Started"} <ArrowRight size={20} />
            </Link>
            <button className="bg-white text-gray-700 border border-gray-200 px-8 py-4 rounded-xl font-bold hover:bg-gray-50 transition">
              Learn More
            </button>
          </div>
          <div className="flex items-center gap-6 pt-4">
            <div className="flex -space-x-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                  <img src={`/assets/images/user${i}.jpg`} alt="User" />
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 font-medium">Trusted by 800+ local residents</p>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 bg-primary-100 rounded-3xl -rotate-2"></div>
          <img 
            src="/assets/images/hero.jpg" 
            alt="Elephant in Sri Lanka" 
            className="relative rounded-3xl shadow-2xl object-cover h-[500px] w-full"
          />
        </div>
      </div>

      {/* Features */}
      <div className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-500 mt-2">Our three-step protection protocol</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            <FeatureCard 
              icon={<Smartphone className="text-blue-600" />}
              title="Detection"
              desc="Guards use mobile AI to detect elephant presence through camera feeds."
            />
            <FeatureCard 
              icon={<Bell className="text-amber-600" />}
              title="Alert"
              desc="Instant notifications are sent to the central dashboard and local Telegram groups."
            />
            <FeatureCard 
              icon={<MapPin className="text-green-600" />}
              title="Monitor"
              desc="Real-time map tracking allows authorities to manage the situation safely."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }) => (
  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
    <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
      {React.cloneElement(icon, { size: 28 })}
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
    <p className="text-gray-600 leading-relaxed">{desc}</p>
  </div>
);

export default Home;
