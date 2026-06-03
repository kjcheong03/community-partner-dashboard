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

export type HelpRequest = {
  id: string;
  area: string;
  topic: Topic;
  helpType: HelpType;
  urgency: Urgency;
  status: Status;
  riskFactors: string[];
  assignedOrganisation: string;
  assignedTeam?: string;
  submittedAt: string;
  notes: string;
  activityLog: ActivityLogEntry[];
};
