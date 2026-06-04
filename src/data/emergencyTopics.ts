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
    orgNotes: {
      SGCares:
        "Expect more doorstep checks, supplies drops, and short-term meal deliveries for seniors self-isolating at home.",
      AACSGO:
        "Prioritise seniors living alone, repeated requests, and households with weak caregiver support for outreach follow-up.",
      SSOFSC:
        "Watch for households that need urgent food rations, supermarket vouchers, or hygiene products during isolation.",
      AICCare:
        "Expect more Meals on Wheels, non-emergency clinic transport, and AIC Link care-navigation requests.",
    },
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
    orgNotes: {
      SGCares:
        "Expect repellent, thermometer, and welfare-check requests in cluster areas. Volunteers should avoid entering homes unless needed.",
      AACSGO:
        "Prioritise seniors with fever symptoms, living-alone flags, or repeated failed contact attempts.",
      SSOFSC:
        "Prepare basic-needs triage for lower-income households that need repellent, thermometers, or food support during recovery.",
      AICCare:
        "Expect care-navigation and clinic transport requests for non-emergency follow-up appointments.",
    },
  },
];
