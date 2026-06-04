export type Topic = "COVID-19" | "Dengue" | "Haze";
export type Urgency = "Low" | "Medium" | "High";
export type CaseDomain = "A" | "B" | "C";
export type Status =
  | "New"
  | "Received"
  | "Accepted"
  | "In Progress"
  | "Fulfilled"
  | "Unable To Fulfil"
  | "Rerouted";

export type HelpType =
  | "Supplies & Networks"
  | "Food & Meal Support"
  | "Welfare Check"
  | "Clinic Transport Help"
  | "Care Referral / Navigation";

export type ActivityLogEntry = {
  timestamp: string;
  action: string;
  actor?: string;
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
  caseDomain: CaseDomain;
  urgency: Urgency;
  status: Status;
  riskFactors: string[];
  helpTags: string[];
  assignedOrganisation: string;
  // Agency-specific operating unit that owns this request in the partner view.
  assignedUnit?: string;
  assignedTeam?: string;
  submittedAt: string;
  notes: string;
  recipient: Recipient;
  caregiver: Caregiver;
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
  orgNotes: {
    SGCares: string;
    AACSGO: string;
    SSOFSC: string;
    AICCare: string;
  };
};
