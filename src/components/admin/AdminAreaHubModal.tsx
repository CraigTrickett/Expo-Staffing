import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowLeft,
  ArrowUpDown,
  Search,
  ExternalLink,
  Sparkles,
  CheckCircle,
  Calendar,
  Layers,
  MapPin,
  Clock,
  Store,
  Users,
  BadgeDollarSign,
  Gift,
  Mic,
  CalendarRange,
  FolderOpen,
  PartyPopper,
  Calculator,
  Megaphone,
  Truck,
  IdCard,
  Utensils,
  ShieldAlert,
  ChevronRight,
  History,
} from 'lucide-react';
import type { EventConfig } from '@/types';
import type { AdminModuleItem, AdminModuleSortMode } from '@/types/adminHub';
import { ADMIN_MODULES, getMruModuleIds, recordModuleUsage } from '@/data/adminModules';
import { useModalA11y } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Store,
  Users,
  Clock,
  BadgeDollarSign,
  Gift,
  Mic,
  CalendarRange,
  FolderOpen,
  PartyPopper,
  Calculator,
  Megaphone,
  Truck,
  IdCard,
  Utensils,
  ShieldAlert,
};

interface AdminAreaHubModalProps {
  event: EventConfig;
  onSelectBoothAdmin: (event: EventConfig) => void;
  onSelectKeyStakeholders?: (event: EventConfig) => void;
  onSelectKeynote?: (event: EventConfig) => void;
  onSelectModuleOverview: (module: AdminModuleItem, event: EventConfig) => void;
  onBackToAllEvents: () => void;
  onClose: () => void;
}

export const AdminAreaHubModal: React.FC<AdminAreaHubModalProps> = ({
  event,
  onSelectBoothAdmin,
  onSelectKeyStakeholders,
  onSelectKeynote,
  onSelectModuleOverview,
  onBackToAllEvents,
  onClose,
}) => {
  const modalRef = useModalA11y(true, onClose);
  const [sortMode, setSortMode] = useState<AdminModuleSortMode>('alphabetical');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const mruIds = useMemo(() => getMruModuleIds(), [sortMode]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    ADMIN_MODULES.forEach((m) => set.add(m.category));
    return ['all', ...Array.from(set)];
  }, []);

  const filteredAndSortedModules = useMemo(() => {
    let list = ADMIN_MODULES.filter((m) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === 'all' || m.category === selectedCategory;
      return matchSearch && matchCategory;
    });

    if (sortMode === 'alphabetical') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === 'mru') {
      list.sort((a, b) => {
        const indexA = mruIds.indexOf(a.id);
        const indexB = mruIds.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.title.localeCompare(b.title);
      });
    }

    return list;
  }, [searchQuery, selectedCategory, sortMode, mruIds]);

  const handleCardClick = (module: AdminModuleItem) => {
    recordModuleUsage(module.id);
    if (module.id === 'expo-booths') {
      onSelectBoothAdmin(event);
    } else if (module.id === 'key-stakeholders' && onSelectKeyStakeholders) {
      onSelectKeyStakeholders(event);
    } else if (module.id === 'keynote-general-session' && onSelectKeynote) {
      onSelectKeynote(event);
    } else {
      onSelectModuleOverview(module, event);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-modal-title"
        className="bg-white border border-[#d8dce0] rounded max-w-4xl w-full max-h-[90vh] flex flex-col shadow-modus-3 focus:outline-hidden overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#d8dce0] bg-[#f8f9fa]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <button
                type="button"
                onClick={onBackToAllEvents}
                className="focus-ring p-2 rounded text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#b9dcf0] bg-white transition-colors cursor-pointer shrink-0 mt-0.5"
                title="Back to Events"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0063a3]">
                    Event Administration Hub
                  </span>
                  <span className="text-[#7c878e]">&bull;</span>
                  <span className="text-xs text-[#46535e]">Select an area to work on</span>
                </div>
                <h2 id="hub-modal-title" className="text-lg font-bold text-[#252a2e] mt-0.5">
                  {event.title}
                </h2>
                <div className="flex items-center gap-3 text-xs text-[#7c878e] mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {formatDate(event.startDate)} &ndash; {formatDate(event.endDate)}
                    </span>
                  </span>
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate max-w-xs">{event.location}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="focus-ring p-1.5 text-[#7c878e] hover:text-[#252a2e] hover:bg-[#e5e9ec] rounded transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls bar: Search, Sorting Toggle & Categories */}
          <div className="mt-4 pt-3 border-t border-[#e5e9ec] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-[#7c878e] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search event areas..."
                className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded pl-8 pr-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#7c878e] hover:text-[#252a2e]"
                >
                  &times;
                </button>
              )}
            </div>

            {/* View Mode & Order Controls */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <span className="text-[11px] font-semibold text-[#7c878e] flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" />
                <span>Order:</span>
              </span>

              {/* Toggle: Alphabetical vs Most Recently Used */}
              <div className="inline-flex rounded border border-[#d8dce0] bg-[#f1f3f6] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSortMode('alphabetical')}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                    sortMode === 'alphabetical'
                      ? 'bg-white text-[#0063a3] shadow-xs'
                      : 'text-[#46535e] hover:text-[#252a2e]'
                  }`}
                >
                  Alphabetical (A-Z)
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode('mru')}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                    sortMode === 'mru'
                      ? 'bg-white text-[#0063a3] shadow-xs'
                      : 'text-[#46535e] hover:text-[#252a2e]'
                  }`}
                  title="Most recently clicked modules appear first"
                >
                  <History className="w-3 h-3" />
                  <span>Recently Used</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-[#7c878e]">
            <span>
              Showing <span className="font-semibold text-[#252a2e]">{filteredAndSortedModules.length}</span>{' '}
              event management areas
            </span>
            <span className="text-[11px] text-[#46535e]">
              Click any card to launch or preview feature capabilities
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredAndSortedModules.map((module) => {
              const IconComp = iconMap[module.iconName] || Layers;
              const isActive = module.status === 'active';

              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => handleCardClick(module)}
                  className={`group relative text-left p-4 rounded border transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-[#f0f7fb] border-[#0063a3] hover:border-[#004f83] hover:shadow-modus-2 ring-1 ring-[#0063a3]/20'
                      : 'bg-white border-[#d8dce0] hover:border-[#0063a3] hover:shadow-modus-2 hover:bg-[#fafbfc]'
                  }`}
                >
                  <div>
                    {/* Top Row: Icon & Status Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div
                        className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${
                          isActive
                            ? 'bg-[#0063a3] text-white'
                            : 'bg-[#e5f2f8] text-[#0063a3] group-hover:bg-[#0063a3] group-hover:text-white'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>

                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-[#0063a3] text-white">
                          <CheckCircle className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-[#7c878e] bg-[#f1f3f6] border border-[#e5e9ec]">
                          {module.badgeText || 'Coming Soon'}
                        </span>
                      )}
                    </div>

                    {/* Card Title & Subtitle */}
                    <h3 className="text-sm font-bold text-[#252a2e] group-hover:text-[#0063a3] transition-colors leading-tight">
                      {module.title}
                    </h3>
                    <p className="text-[11px] font-semibold text-[#0063a3] mt-0.5">
                      {module.subtitle}
                    </p>

                    {/* Description */}
                    <p className="text-xs text-[#46535e] mt-1.5 line-clamp-2 leading-relaxed">
                      {module.description}
                    </p>
                  </div>

                  {/* Footer of Card */}
                  <div className="mt-3.5 pt-2.5 border-t border-[#e5e9ec] flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-[#7c878e] font-normal">{module.category}</span>
                    <span
                      className={`flex items-center gap-0.5 transition-transform group-hover:translate-x-0.5 ${
                        isActive ? 'text-[#0063a3] font-bold' : 'text-[#46535e] group-hover:text-[#0063a3]'
                      }`}
                    >
                      <span>{isActive ? 'Open Admin' : 'View Overview'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredAndSortedModules.length === 0 && (
            <div className="text-center py-12 text-xs text-[#7c878e]">
              No event areas matched your search. Try another query or clear filters.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#d8dce0] bg-[#f8f9fa] flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToAllEvents}
            className="focus-ring px-3 py-1.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#0063a3] border border-[#d8dce0] hover:border-[#0063a3] bg-white transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Events</span>
          </button>

          <span className="text-[11px] text-[#7c878e] hidden sm:inline">
            Expo Staffing Hub &bull; Trimble Modus Design
          </span>

          <button
            type="button"
            onClick={onClose}
            className="focus-ring px-4 py-1.5 rounded text-xs font-semibold bg-[#252a2e] hover:bg-[#1a1d20] text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
