import React, { useState } from 'react';
import type { EventConfig } from '@/types';
import type { AdminModuleItem } from '@/types/adminHub';
import { AllEventsModal } from './AllEventsModal';
import { AdminAreaHubModal } from '@/components/admin/AdminAreaHubModal';
import { AdminModuleOverviewModal } from '@/components/admin/AdminModuleOverviewModal';
import { KeyStakeholdersModal } from '@/components/admin/KeyStakeholdersModal';
import { KeynoteSessionModal } from '@/components/admin/KeynoteSessionModal';

interface MyEventsPanelProps {
  onClose: () => void;
  onCreateNew?: () => void;
  initialEventForHub?: EventConfig | null;
}

export const MyEventsPanel: React.FC<MyEventsPanelProps> = ({
  onClose,
  onCreateNew,
  initialEventForHub,
}) => {
  const [selectedEventForHub, setSelectedEventForHub] = useState<EventConfig | null>(
    initialEventForHub || null
  );
  const [selectedStakeholdersEvent, setSelectedStakeholdersEvent] = useState<EventConfig | null>(null);
  const [selectedKeynoteEvent, setSelectedKeynoteEvent] = useState<EventConfig | null>(null);
  const [selectedModuleForOverview, setSelectedModuleForOverview] = useState<{
    module: AdminModuleItem;
    event: EventConfig;
  } | null>(null);

  const handleCreateNew = () => {
    onClose();
    if (onCreateNew) {
      onCreateNew();
    } else {
      window.location.hash = '#/';
    }
  };

  const handleSelectAdmin = (event: EventConfig) => {
    setSelectedEventForHub(event);
  };

  const handleSelectStaff = (event: EventConfig) => {
    onClose();
    window.location.hash = `#/event/${event.publicKey}`;
  };

  const handleSelectBoothAdmin = (event: EventConfig) => {
    onClose();
    window.location.hash = `#/admin/${event.adminKey}`;
  };

  const handleSelectKeyStakeholders = (event: EventConfig) => {
    setSelectedStakeholdersEvent(event);
  };

  const handleSelectKeynote = (event: EventConfig) => {
    setSelectedKeynoteEvent(event);
  };

  const handleSelectModuleOverview = (module: AdminModuleItem, event: EventConfig) => {
    setSelectedModuleForOverview({ module, event });
  };

  // If Key Stakeholders modal is open
  if (selectedStakeholdersEvent) {
    return (
      <KeyStakeholdersModal
        event={selectedStakeholdersEvent}
        onBack={() => setSelectedStakeholdersEvent(null)}
        onClose={onClose}
      />
    );
  }

  // If Keynote / General Session modal is open
  if (selectedKeynoteEvent) {
    return (
      <KeynoteSessionModal
        event={selectedKeynoteEvent}
        onBack={() => setSelectedKeynoteEvent(null)}
        onClose={onClose}
        onManageStakeholders={() => {
          const currentEvt = selectedKeynoteEvent;
          setSelectedKeynoteEvent(null);
          setSelectedStakeholdersEvent(currentEvt);
        }}
      />
    );
  }

  // If a specific module overview is open
  if (selectedModuleForOverview) {
    return (
      <AdminModuleOverviewModal
        module={selectedModuleForOverview.module}
        event={selectedModuleForOverview.event}
        onBack={() => setSelectedModuleForOverview(null)}
        onClose={onClose}
      />
    );
  }

  // If an event was picked for the Admin Hub
  if (selectedEventForHub) {
    return (
      <AdminAreaHubModal
        event={selectedEventForHub}
        onSelectBoothAdmin={handleSelectBoothAdmin}
        onSelectKeyStakeholders={handleSelectKeyStakeholders}
        onSelectKeynote={handleSelectKeynote}
        onSelectModuleOverview={handleSelectModuleOverview}
        onBackToAllEvents={() => setSelectedEventForHub(null)}
        onClose={onClose}
      />
    );
  }

  // Primary All Events modal
  return (
    <AllEventsModal
      onClose={onClose}
      onCreateNew={handleCreateNew}
      onSelectAdmin={handleSelectAdmin}
      onSelectStaff={handleSelectStaff}
    />
  );
};
