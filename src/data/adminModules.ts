import type { AdminModuleItem } from '@/types/adminHub';

export const ADMIN_MODULES: AdminModuleItem[] = [
  {
    id: 'expo-booths',
    title: 'Expo Booths',
    subtitle: 'Booth shift schedule & coverage',
    description: 'Manage hourly staffing shifts, capacity limits, real-time claim roster, and Google/Apple calendar exports.',
    iconName: 'Store',
    status: 'active',
    category: 'Operations',
    badgeText: 'Active Module',
    featureOverview: {
      headline: 'Full-Featured Live Booth Staffing Management',
      summary: 'Coordinate booth staffing across the entire exhibition floor. Allocate shifts, manage capacity targets, track understaffed hours, and sync schedules directly to calendar apps.',
      keyCapabilities: [
        'Interactive Shift Matrix with 30, 60, 90, and 120-minute slot durations',
        'Dynamic Target Hours calculator per staff representative based on total demand',
        'Staff self-service shift claiming with zero login required',
        'One-click export to Google Calendar and universal .ics files',
        'Multi-day conference support with custom venue operating hours'
      ],
      upcomingMilestones: [
        'Version 1.0 deployed with real-time sync and local persistence'
      ]
    }
  },
  {
    id: 'key-stakeholders',
    title: 'Key Stakeholders',
    subtitle: 'VIP directory & liaison contacts',
    description: 'Track booth leaders, keynote speakers, event committee leads, executive sponsors, and vendor coordinators.',
    iconName: 'Users',
    status: 'active',
    category: 'Operations',
    badgeText: 'Active Module',
    featureOverview: {
      headline: 'VIP, Executive & Staff Stakeholder Directory',
      summary: 'Centralize contact details, roles, arrival windows, and briefing requirements for every VIP, executive attendee, speaker, and team lead.',
      keyCapabilities: [
        'Contact cards with one-click phone, email, and WhatsApp dispatch',
        'Role-based classification (Executive Sponsor, Booth Captain, VIP Liaison)',
        'Arrival & departure flight tracker with ground transport notes',
        'Automated briefing packet delivery with read receipts',
        'On-site radio frequency and emergency channel directory'
      ],
      upcomingMilestones: [
        'Stakeholder schema design and contact import tool',
        'Executive liaison communication portal integration'
      ]
    }
  },
  {
    id: 'deadlines',
    title: 'Dead lines',
    subtitle: 'Milestones, cutoffs & countdowns',
    description: 'Automated countdown tracking for electrical orders, banner printing, freight arrival, and badge cutoffs.',
    iconName: 'Clock',
    status: 'coming_soon',
    category: 'Operations',
    badgeText: 'Planned Module',
    featureOverview: {
      headline: 'Critical Milestone & Vendor Cutoff Calendar',
      summary: 'Never miss an early-bird pricing cutoff, print deadline, or venue service order window. Keep your entire team aligned on deliverable dates.',
      keyCapabilities: [
        'Dynamic countdown clocks to key submission cutoffs',
        'Venue service deadlines: electrical, internet drops, lead retrieval, rigging',
        'Print & graphic design approvals for booth walls, banners, and flyers',
        'Automated reminder notifications to responsible team leads 7d, 3d, and 24h prior',
        'Risk flag indicators for overdue or high-criticality items'
      ],
      upcomingMilestones: [
        'Milestone timeline visualizer and calendar sync',
        'Automated vendor deadline templates for major convention centers'
      ]
    }
  },
  {
    id: 'sponsorship',
    title: 'Sponsorship',
    subtitle: 'Sponsor packages & deliverables',
    description: 'Manage Tier levels (Diamond, Platinum, Gold), contract deliverables, complimentary badges, and booth locations.',
    iconName: 'BadgeDollarSign',
    status: 'coming_soon',
    category: 'Commercial',
    badgeText: 'Planned Module',
    featureOverview: {
      headline: 'End-to-End Sponsor Tier & Deliverables Tracker',
      summary: 'Ensure every contractual commitment to sponsors is executed flawlessly, from high-res logo placements and badge quotas to speaking slots and booth sizing.',
      keyCapabilities: [
        'Sponsor tier tiering (Diamond, Platinum, Gold, Silver, Startup)',
        'Asset collection portal: vector logos, company bios, social tags',
        'Contract deliverable checklist with live fulfillment audit',
        'Complimentary staff pass and attendee invite allocation',
        'Post-event sponsor impact report generation with lead counts'
      ],
      upcomingMilestones: [
        'Sponsor self-service asset upload workflow',
        'Automated contract fulfillment validation'
      ]
    }
  },
  {
    id: 'swag',
    title: 'Swag',
    subtitle: 'Promotional merchandise & inventory',
    description: 'Track attendee giveaways, staff branded apparel sizing, box inventory counts, booth restock alerts, and shipping pallets.',
    iconName: 'Gift',
    status: 'coming_soon',
    category: 'Operations',
    badgeText: 'Planned Module',
    featureOverview: {
      headline: 'Swag & Branded Merchandise Inventory Hub',
      summary: 'Eliminate running out of premium giveaways on Day 1. Monitor real-time swag counts, staff apparel distributions, shipment tracking, and restock schedules.',
      keyCapabilities: [
        'Itemized inventory tracking (T-shirts, water bottles, socks, tech gadgets, stickers)',
        'Staff apparel size management (XS through 3XL) with distribution sign-off',
        'Daily burn-rate calculations and replenishment alerts',
        'Booth restock schedule from convention center storage lockers',
        'Post-event remainder audit and donation/return logistics'
      ],
      upcomingMilestones: [
        'Barcoded box check-in and QR code inventory scan',
        'Vendor order re-order triggers'
      ]
    }
  },
  {
    id: 'keynote-general-session',
    title: 'Keynote / General Session',
    subtitle: 'Mainstage run-of-show & speakers',
    description: 'Minute-by-minute cue sheets, teleprompter scripts, stage manager notes, presenter bios, and AV walk-throughs.',
    iconName: 'Mic',
    status: 'active',
    category: 'Programming',
    badgeText: 'Active Module',
    featureOverview: {
      headline: 'Mainstage Production Run-of-Show & Stage Cues',
      summary: 'Synchronize presenters, lighting, video playback, and audio cues for keynote sessions, awards ceremonies, and executive presentations.',
      keyCapabilities: [
        'Minute-by-minute run-of-show timing sheets with dynamic delay adjustments',
        'Speaker greenroom arrival tracking and wireless mic assignments',
        'Slide presentation version control and live presenter notes',
        'Stage manager cues: walk-in music, intro videos, teleprompter status',
        'Live stream & broadcast feed coordination with virtual attendees'
      ],
      upcomingMilestones: [
        'Live multi-user synced run-of-show timer',
        'Presenter stage-timer display view'
      ]
    }
  },
  {
    id: 'session-scheduling',
    title: 'Session Scheduling',
    subtitle: 'Breakout tracks & room capacities',
    description: 'Design track agendas, allocate workshop rooms, monitor room seating limits, and publish attendee timetables.',
    iconName: 'CalendarRange',
    status: 'coming_soon',
    category: 'Programming',
    badgeText: 'Planned Module',
    featureOverview: {
      headline: 'Multi-Track Agenda & Breakout Session Manager',
      summary: 'Build and optimize conference breakout agendas. Avoid speaker schedule conflicts, manage room fire-code capacities, and publish live session updates.',
      keyCapabilities: [
        'Multi-track drag-and-drop agenda grid with simultaneous rooms',
        'Speaker scheduling conflict auto-detection',
        'Room capacity metrics and attendance overflow warnings',
        'Audio/Visual equipment requirements per session (podium, lavs, projector)',
        'Direct export to attendee mobile app and printable pocket agendas'
      ],
      upcomingMilestones: [
        'Conflict resolution engine and room assignment builder',
        'Dynamic digital signage display feeds'
      ]
    }
  },
  {
    id: 'resources',
    title: 'Resources',
    subtitle: 'Exhibitor kits, floorplans & docs',
    description: 'Central repository for hall floor plans, exhibitor manuals, badge templates, WiFi credentials, and emergency maps.',
    iconName: 'FolderOpen',
    status: 'coming_soon',
    category: 'Logistics',
    badgeText: 'Planned Module',
    featureOverview: {
      headline: 'Central Document, Asset & Floorplan Repository',
      summary: 'A unified library containing every vital file needed by booth staff, contractors, and organizers during build-up, show days, and breakdown.',
      keyCapabilities: [
        'High-resolution interactive floor plans with zoom and booth locator',
        'Exhibitor service kit and order forms (Freeman, GES, venue services)',
        'Staff quick-reference cheat sheets: elevator codes, exhibitor WiFi passcodes, FAQs',
        'Lead retrieval scanner instructions and support hotlines',
        'Booth branding guidelines and approved product demo talk tracks'
      ],
      upcomingMilestones: [
        'Interactive SVG floor plan with booth search',
        'Offline PDF and document sync cache'
      ]
    }
  },
  {
    id: 'social-event',
    title: 'Social Event',
    subtitle: 'Receptions, dinners & networking',
    description: 'Coordinate opening night receptions, VIP dinner guest lists, after-parties, catering menus, and venue shuttles.',
    iconName: 'PartyPopper',
    status: 'coming_soon',
    category: 'Programming',
    badgeText: 'Planned Module',
    featureOverview: {
      headline: 'Evening Receptions, VIP Dinners & Networking Parties',
      summary: 'Manage evening networking events, cocktail receptions, and executive dinners without spreadsheet clutter. Track RSVPs, venues, and transit.',
      keyCapabilities: [
        'Guest list management with VIP invitation tiers and RSVP confirmation',
        'Venue selection details: address, capacity, dress code, security requirements',
        'Shuttle bus schedules with pickup loops from host hotels to venue',
        'Entertainment coordination: live band/DJ, sound permits, curfew management',
        'Food & beverage menu selection including open bar packages and dietary options'
      ],
      upcomingMilestones: [
        'Mobile QR code guest check-in scanner',
        'Venue capacity live counter'
      ]
    }
  },
  {
    id: 'budget',
    title: 'Budget',
    subtitle: 'Cost tracking, invoices & ROI',
    description: 'Comprehensive budget tracking, vendor quote comparison, purchase order sign-offs, and cost-per-lead analysis.',
    iconName: 'Calculator',
    status: 'coming_soon',
    category: 'Commercial',
    badgeText: 'Planned Module',
    featureOverview: {
      headline: 'Expo Financial Management & ROI Analysis',
      summary: 'Track projected vs. actual expenses across booth construction, venue rentals, electrical, travel, catering, and marketing. Keep leadership informed with live variance charts.',
      keyCapabilities: [
        'Expense categorization: Booth Space, Drayage, AV, Swag, Travel & Lodging',
        'Vendor quote side-by-side comparison and PO approval workflows',
        'Real-time budget vs. actual expenditure tracker with alert thresholds',
        'Cost-per-shift and cost-per-qualified-lead financial metrics',
        'Executive financial summary export for stakeholder post-mortems'
      ],
      upcomingMilestones: [
        'Automated receipt parsing and invoice management',
        'Multi-currency support and budget variance forecasting'
      ]
    }
  },
  {
    id: 'marketing',
    title: 'Marketing',
    subtitle: 'Campaigns, PR & signage',
    description: 'Coordinate social media blitzes, attendee newsletters, press room materials, booth directional banners, and press conferences.',
    iconName: 'Megaphone',
    status: 'coming_soon',
    category: 'Commercial',
    badgeText: 'Planned Module',
    featureOverview: {
      headline: 'Pre-Show Buzz, On-Site Signage & PR Campaigns',
      summary: 'Maximize foot traffic to your booth and attendance at your sessions. Coordinate pre-show outreach, social media blitzes, press releases, and directional banners.',
      keyCapabilities: [
        'Content calendar for LinkedIn, X, email newsletter, and customer invites',
        'On-site signage checklist: hanging banners, meter boards, booth graphics',
        'Media & analyst briefing schedule with embargoed press releases',
        'Booth traffic promotion campaigns (giveaways, product teasers, passport contests)',
        'Trackable UTM links and QR codes to measure marketing attribution'
      ],
      upcomingMilestones: [
        'Social media asset pack generator',
        'Media press room scheduling portal'
      ]
    }
  },
  {
    id: 'badging-registration',
    title: 'Badging & Registration',
    subtitle: 'Attendee check-in & badges',
    description: 'Track kiosk throughput, badge printing supply levels, VIP bypass lanes, and lead retrieval scanner distribution.',
    iconName: 'IdCard',
    status: 'coming_soon',
    category: 'Operations',
    badgeText: 'Suggested Module',
    featureOverview: {
      headline: 'Check-In Kiosks, Badge Printing & Staff Credentials',
      summary: 'Ensure frictionless arrivals for thousands of attendees. Monitor registration desk queues, badge printer ribbons, VIP check-in, and badge scanning hardware.',
      keyCapabilities: [
        'Real-time check-in counts and registration peak-hour throughput',
        'Exhibitor staff credential badge printing and badge reissue logs',
        'Lead retrieval scanner inventory and pairing status',
        'VIP and press registration bypass queue tracking',
        'Badge ribbon inventory alerts (card stock, lanyards, RFID sleeves)'
      ],
      upcomingMilestones: [
        'Live queue density monitoring',
        'Self-service check-in kiosk integration'
      ]
    }
  },
  {
    id: 'catering-hospitality',
    title: 'Catering & Hospitality',
    subtitle: 'Food, beverage & dietary needs',
    description: 'Manage exhibitor meal breaks, VIP greenroom refreshments, coffee station schedules, and allergen requirements.',
    iconName: 'Utensils',
    status: 'coming_soon',
    category: 'Logistics',
    badgeText: 'Suggested Module',
    featureOverview: {
      headline: 'Booth Catering, Staff Meals & Hospitality Suites',
      summary: 'Keep booth staff energized and hospitality suites stocked. Manage meal break delivery times, coffee stations, water restocks, and dietary restrictions.',
      keyCapabilities: [
        'Exhibitor booth catering schedules (morning pastries, afternoon espresso bar)',
        'Staff meal vouchers and lunch rotation scheduling across shifts',
        'Dietary requirement tracking (vegan, gluten-free, halal, kosher, nut allergy)',
        'VIP lounge beverage and snack inventory restocking',
        'Convention center catering minimum spend and banquet check reconciliation'
      ],
      upcomingMilestones: [
        'Staff meal order portal',
        'Real-time booth water & coffee delivery requests'
      ]
    }
  }
];

const MRU_STORAGE_KEY = 'expo_admin_mru_modules_v1';

export function getMruModuleIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MRU_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordModuleUsage(moduleId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getMruModuleIds();
    const updated = [moduleId, ...current.filter((id) => id !== moduleId)].slice(0, 20);
    localStorage.setItem(MRU_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[recordModuleUsage] Failed to save MRU module:', err);
  }
}
