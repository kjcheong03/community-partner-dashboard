export type Topic = "COVID-19" | "Dengue" | "Haze";
export type Urgency = "Low" | "Medium" | "High";
export type Status =
  | "New"
  | "Received"
  | "Accepted"
  | "In Progress"
  | "Fulfilled"
  | "Unable To Fulfil"
  | "Rerouted";

export type HelpType =
  | "Medication Collection"
  | "Transport Support"
  | "Welfare Check"
  | "Food & Essentials"
  | "Masks & Hygiene"
  | "Advisory Assistance";

export type ActivityLogEntry = {
  timestamp: string;
  action: string;
  actor?: string;
};

export type MedicationCategory =
  | "Anticoagulant"
  | "Insulin"
  | "Controlled Drug"
  | "Antihypertensive"
  | "Antidiabetic"
  | "Respiratory"
  | "Cardiac"
  | "Other";

export type Medication = {
  name: string;
  dosage: string;
  category: MedicationCategory;
  // High-risk meds (warfarin, insulin, controlled drugs) need a clinical flag.
  highRisk?: boolean;
};

export type Recipient = {
  name: string;
  age: number;
  language: string;
  conditions: string[];
  allergies: string[];
  mobility: string;
};

export type Caregiver = {
  name: string;
  relationship: string;
  language: string;
  contactMethod: string;
};

export type HelpRequest = {
  id: string;
  area: string;
  topic: Topic;
  helpType: HelpType;
  urgency: Urgency;
  status: Status;
  riskFactors: string[];
  helpTags: string[];
  assignedOrganisation: string;
  assignedTeam?: string;
  pharmacyBranch?: string;
  // SG Cares volunteer centre this request is routed to (map/drawer assignment).
  assignedCentre?: string;
  submittedAt: string;
  notes: string;
  recipient: Recipient;
  caregiver: Caregiver;
  medications?: Medication[];
  activityLog: ActivityLogEntry[];
  // Final disposition once a request is closed (shown in AIC's incident log).
  outcome?: string;
  // AIC flags a case for long-term care follow-up (oversight action).
  flaggedForCareReview?: boolean;
};

export type EmergencyTopic = {
  id: string;
  topic: Topic;
  name: string;
  urgency: Urgency;
  advisorySummary: string;
  affectedAreas: string[];
  startedAt: string;
  // Plain-language note for volunteers on the ground (SG Cares context).
  volunteerNote: string;
  // Stock / branch-routing guidance for the pharmacy partner network.
  pharmacyNote: string;
};
