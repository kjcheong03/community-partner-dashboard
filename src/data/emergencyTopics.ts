import type { EmergencyTopic } from "@/lib/types";

export const emergencyTopics: EmergencyTopic[] = [
  {
    id: "TOPIC-COVID",
    topic: "COVID-19",
    name: "COVID-19 Resurgence (JN.1 wave)",
    urgency: "High",
    advisorySummary:
      "MOH reports rising COVID-19 cases. Vulnerable seniors advised to stay current on boosters, mask in crowded settings, and monitor for breathlessness.",
    affectedAreas: ["Tampines", "Bedok", "Queenstown", "Bukit Merah", "Kallang", "Toa Payoh"],
    startedAt: "2025-05-28T09:00:00",
    volunteerNote:
      "Expect more medication and grocery runs for seniors self-isolating at home. Confirm households have enough essentials for at least 5 days.",
    pharmacyNote:
      "High demand for antiviral collection, inhalers, and oximeter requests. Keep Tampines and Bedok branches stocked and cold-chain ready.",
  },
  {
    id: "TOPIC-DENGUE",
    topic: "Dengue",
    name: "Dengue Cluster Advisory (Aedes surge)",
    urgency: "Medium",
    advisorySummary:
      "NEA has flagged active dengue clusters. Residents urged to remove stagnant water; seniors with fever should be monitored for warning signs.",
    affectedAreas: ["Woodlands", "Yishun", "Sengkang", "Geylang", "Tampines"],
    startedAt: "2025-05-30T10:00:00",
    volunteerNote:
      "Expect more welfare checks for elderly living alone in affected sectors. Check for mosquito breeding in and around the home, and watch for persistent fever and dehydration during visits.",
    pharmacyNote:
      "Higher demand for paracetamol and fever-management supplies. Anticipate analgesic collection from Tampines, Hougang, and Yishun clusters.",
  },
];
