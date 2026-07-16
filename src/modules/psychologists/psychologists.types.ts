export const PSYCHOLOGIST_TYPES = ["general", "clinical"] as const;
export type PsychologistType = typeof PSYCHOLOGIST_TYPES[number];

export const CONSULTATION_CHANNELS = ["chat", "chat_and_meet"] as const;
export type ConsultationChannel = typeof CONSULTATION_CHANNELS[number];

export const APPROVAL_STATUSES = ["draft", "pending_review", "approved", "rejected"] as const;
export type ApprovalStatus = typeof APPROVAL_STATUSES[number];

export const CREDENTIAL_DOCUMENT_TYPES = ["sipp", "ijazah", "str", "strpk", "sippk"] as const;
export type CredentialDocumentType = typeof CREDENTIAL_DOCUMENT_TYPES[number];

export const REQUIRED_DOCUMENTS_BY_TYPE: Record<PsychologistType, CredentialDocumentType[]> = {
  general: ["sipp", "ijazah", "str"],
  clinical: ["strpk", "sippk", "ijazah", "str", "sipp"],
};

export function channelForType(type: PsychologistType): ConsultationChannel {
  return type === "clinical" ? "chat_and_meet" : "chat";
}
