import React, { useState } from 'react';
import { Building, Link as LinkIcon, Truck, Store, UserCircle, MessageSquare } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import CompanyProfileForm from '../../components/settings/CompanyProfileForm';
import DeepSeekConfig from '../../components/settings/DeepSeekConfig';
import OpenAIConfig from '../../components/settings/OpenAIConfig';
import SuppliersPage from '../inventory/SuppliersPage';
import OutletsPage from './OutletsPage';
import UserProfileForm from '../../components/settings/UserProfileForm';
import ChatConfig from '../../components/settings/ChatConfig'; // Import ChatConfig

type SettingsTab = 'profile' | 'user_profile' | 'integrations' | 'chatbot' | 'suppliers' | 'outlets';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Navigation Items
  const tabs = [
    { id: 'profile', label: 'Profil Perusahaan', icon: Building, description: 'Kelola informasi dasar perusahaan' },
    { id: 'user_profile', label: 'Profil Pengguna', icon: UserCircle, description: 'Kelola akun dan password Anda' },
    { id: 'integrations', label: 'Integrasi AI', icon: LinkIcon, description: 'Konfigurasi API Key AI' },
    { id: 'chatbot', label: 'Konfigurasi Chatbot', icon: MessageSquare, description: 'Atur kepribadian asisten AI' }, // New Tab
    { id: 'suppliers', label: 'Data Supplier', icon: Truck, description: 'Manajemen daftar pemasok' },
    { id: 'outlets', label: 'Data Outlet', icon: Store, description: 'Manajemen cabang outlet' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <CompanyProfileForm />;
      case 'user_profile':
        return <UserProfileForm />;
      case 'integrations':
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
              <h4 className="text-blue-800 font-bold text-sm mb-1">Pusat Integrasi</h4>
              <p className="text-blue-600 text-xs">
                Hubungkan aplikasi dengan layanan AI untuk fitur otomatisasi seperti Kalkulator HPP dan OCR.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DeepSeekConfig />
              <OpenAIConfig />
            </div>
          </div>
        );
      case 'chatbot': // New Case
        return (
          <div className="animate-fade-in">
            <ChatConfig />
          </div>
        );
      case 'suppliers':
        return (
          <div className="animate-fade-in">
            <SuppliersPage />
          </div>
        );
      case 'outlets':
        return (
          <div className="animate-fade-in">
            <OutletsPage />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="pb-10 min-h-screen bg-gray-50">
      <PageHeader title="Pengaturan Sistem" />

      <div className="flex flex-col lg:flex-row gap-8 mt-6">
        
        {/* Left Sidebar Navigation */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-24">
            <div className="p-4 bg-gray-50/50 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Menu Pengaturan</h3>
            </div>
            <nav className="p-2 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={`
                      w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-left group
                      ${isActive 
                        ? 'bg-navbar-accent-1 text-white shadow-md shadow-navbar-accent-1/20' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-navbar-accent-1'
                      }
                    `}
                  >
                    <div className={`
                      p-2 rounded-lg mr-3 transition-colors
                      ${isActive ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-white group-hover:shadow-sm'}
                    `}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <span className="block font-semibold text-sm">{tab.label}</span>
                      <span className={`block text-[10px] mt-0.5 ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                        {tab.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
