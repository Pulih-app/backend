export const DEMO_PASSWORD = "PulihDemo123!";
export const DEMO_NOW = new Date("2026-07-16T02:00:00.000Z");
export const DEMO_LOCAL_START_DATE = "2026-07-16";

const demoUuid = (group: string, index: number) => `${group}-${String(index).padStart(12, "0")}`;

export const DEMO_IDS = {
  patientUser: "11111111-1111-4111-8111-111111111111",
  patientProfile: "11111111-1111-4111-8111-111111111112",
  psychologistUser: demoUuid("22222222-2222-4222-8222", 1),
  psychologistUsers: Array.from({ length: 12 }, (_, index) => demoUuid("22222222-2222-4222-8222", index + 1)),
  psychologistProfiles: Array.from({ length: 12 }, (_, index) => demoUuid("22222222-2222-4222-8333", index + 1)),
  practicePlaces: Array.from({ length: 12 }, (_, index) => demoUuid("22222222-2222-4222-8444", index + 1)),
  credentialFiles: Array.from({ length: 48 }, (_, index) => demoUuid("22222222-2222-4222-8555", index + 1)),
  bundles: Array.from({ length: 24 }, (_, index) => demoUuid("33333333-3333-4333-8333", index + 1)),
  slots: Array.from({ length: 168 }, (_, index) => demoUuid("33333333-3333-4333-8444", index + 1)),
  bookings: Array.from({ length: 12 }, (_, index) => demoUuid("33333333-3333-4333-8555", index + 1)),
  reviews: Array.from({ length: 12 }, (_, index) => demoUuid("33333333-3333-4333-8666", index + 1)),
  education: [
    "44444444-4444-4444-8444-444444444431",
    "44444444-4444-4444-8444-444444444432",
    "44444444-4444-4444-8444-444444444433",
    "44444444-4444-4444-8444-444444444434",
    "44444444-4444-4444-8444-444444444435",
    "44444444-4444-4444-8444-444444444436",
    "44444444-4444-4444-8444-444444444437",
    "44444444-4444-4444-8444-444444444438",
    "44444444-4444-4444-8444-444444444439",
    "44444444-4444-4444-8444-44444444443a",
    "44444444-4444-4444-8444-44444444443b",
    "44444444-4444-4444-8444-44444444443c",
    "44444444-4444-4444-8444-44444444443d",
    "44444444-4444-4444-8444-44444444443e",
    "44444444-4444-4444-8444-44444444443f",
    "44444444-4444-4444-8444-444444444440",
    "44444444-4444-4444-8444-444444444441",
    "44444444-4444-4444-8444-444444444442",
    "44444444-4444-4444-8444-444444444443",
    "44444444-4444-4444-8444-444444444444",
    "44444444-4444-4444-8444-444444444445",
    "44444444-4444-4444-8444-444444444446",
    "44444444-4444-4444-8444-444444444447",
    "44444444-4444-4444-8444-444444444448",
    "44444444-4444-4444-8444-444444444449",
    "44444444-4444-4444-8444-44444444444a",
    "44444444-4444-4444-8444-44444444444b",
    "44444444-4444-4444-8444-44444444444c",
    "44444444-4444-4444-8444-44444444444d",
    "44444444-4444-4444-8444-44444444444e",
    "44444444-4444-4444-8444-44444444444f",
  ],
  motivations: Array.from({ length: 35 }, (_, index) => demoUuid("55555555-5555-4555-8555", index + 31)),
  challenges: Array.from({ length: 70 }, (_, index) => demoUuid("66666666-6666-4666-8666", index + 31)),
  achievements: Array.from({ length: 12 }, (_, index) => demoUuid("77777777-7777-4777-8777", index + 31)),
  posts: Array.from({ length: 6 }, (_, index) => demoUuid("88888888-8888-4888-8888", index + 31)),
  comments: Array.from({ length: 12 }, (_, index) => demoUuid("99999999-9999-4999-8999", index + 31)),
} as const;

const demoPsychologists = [
  { name: "Dr. Maya Prameswari, M.Psi., Psikolog", email: "maya.prameswari@pulih.local", type: "general", channel: "chat", birth: "1988-04-12", city: "Jakarta", photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80", focus: ["addiction recovery", "habit building", "self-regulation"], price: 150000, duration: 60, start: "09:00:00" },
  { name: "Dr. Arga Wicaksana, M.Psi., Psikolog", email: "arga.wicaksana@pulih.local", type: "clinical", channel: "chat_and_meet", birth: "1984-11-03", city: "Bandung", photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=800&q=80", focus: ["clinical anxiety", "compulsive behavior", "relapse prevention"], price: 275000, duration: 60, start: "10:00:00" },
  { name: "Nadia Salsabila, M.Psi., Psikolog", email: "nadia.salsabila@pulih.local", type: "general", channel: "chat", birth: "1991-02-18", city: "Surabaya", photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=800&q=80", focus: ["stress management", "self-esteem", "daily routines"], price: 140000, duration: 45, start: "13:00:00" },
  { name: "Raka Mahendra, M.Psi., Psikolog Klinis", email: "raka.mahendra@pulih.local", type: "clinical", channel: "chat_and_meet", birth: "1986-07-25", city: "Yogyakarta", photo: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80", focus: ["trauma-informed care", "depression", "behavioral addiction"], price: 300000, duration: 75, start: "15:00:00" },
  { name: "Clara Winata, M.Psi., Psikolog", email: "clara.winata@pulih.local", type: "general", channel: "chat", birth: "1990-09-09", city: "Semarang", photo: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=800&q=80", focus: ["relationship boundaries", "mindfulness", "urge surfing"], price: 160000, duration: 60, start: "08:00:00" },
  { name: "Dimas Adhitama, M.Psi., Psikolog Klinis", email: "dimas.adhitama@pulih.local", type: "clinical", channel: "chat_and_meet", birth: "1982-01-30", city: "Denpasar", photo: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=800&q=80", focus: ["mood regulation", "CBT", "compulsion cycles"], price: 325000, duration: 60, start: "11:00:00" },
  { name: "Sinta Ayuningtyas, M.Psi., Psikolog", email: "sinta.ayuningtyas@pulih.local", type: "general", channel: "chat", birth: "1993-05-14", city: "Malang", photo: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80", focus: ["young adult adjustment", "confidence", "healthy coping"], price: 135000, duration: 45, start: "16:00:00" },
  { name: "Faris Nugroho, M.Psi., Psikolog Klinis", email: "faris.nugroho@pulih.local", type: "clinical", channel: "chat_and_meet", birth: "1987-12-21", city: "Makassar", photo: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=800&q=80", focus: ["addiction counseling", "anxiety", "family systems"], price: 290000, duration: 60, start: "14:00:00" },
  { name: "Alya Kirana, M.Psi., Psikolog", email: "alya.kirana@pulih.local", type: "general", channel: "chat", birth: "1992-08-07", city: "Medan", photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80", focus: ["self-compassion", "accountability", "habit recovery"], price: 145000, duration: 60, start: "12:00:00" },
  { name: "Bima Satriya, M.Psi., Psikolog Klinis", email: "bima.satriya@pulih.local", type: "clinical", channel: "chat_and_meet", birth: "1985-06-16", city: "Depok", photo: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?auto=format&fit=crop&w=800&q=80", focus: ["OCD spectrum", "relapse planning", "emotional regulation"], price: 310000, duration: 75, start: "17:00:00" },
  { name: "Meisya Hartono, M.Psi., Psikolog", email: "meisya.hartono@pulih.local", type: "general", channel: "chat", birth: "1989-03-28", city: "Tangerang", photo: "https://images.unsplash.com/photo-1551601651-2a8555f1a136?auto=format&fit=crop&w=800&q=80", focus: ["burnout", "healthy boundaries", "support systems"], price: 155000, duration: 60, start: "18:00:00" },
  { name: "Kenzo Pratama, M.Psi., Psikolog Klinis", email: "kenzo.pratama@pulih.local", type: "clinical", channel: "chat_and_meet", birth: "1983-10-10", city: "Bekasi", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80", focus: ["clinical assessment", "CBT", "addiction recovery"], price: 330000, duration: 60, start: "19:00:00" },
] as const;

export const demoUsers = [
  {
    id: DEMO_IDS.patientUser,
    email: "patient.demo@pulih.local",
    role: "patient" as const,
    status: "active",
  },
  ...demoPsychologists.map((psychologist, index) => ({
    id: DEMO_IDS.psychologistUsers[index],
    email: psychologist.email,
    role: "psychologist" as const,
    status: "active",
  })),
] as const;

export const demoProfiles = [
  {
    id: DEMO_IDS.patientProfile,
    userId: DEMO_IDS.patientUser,
    nickname: "Demo",
    recoveryReason: "Build a steady recovery routine and reduce compulsive behavior.",
    dailyCheckinTime: "20:00:00",
    answers: { goal: "90 clean days", supportNeed: "Daily structure and professional support" },
    dependencyLevel: "moderate",
    aiSummary: "Demo patient is focused on routine rebuilding, trigger awareness, and healthier coping habits.",
    onboardingCompletedAt: DEMO_NOW,
  },
] as const;

export const demoPsychologistProfiles = demoPsychologists.map((psychologist, index) => ({
  id: DEMO_IDS.psychologistProfiles[index],
  userId: DEMO_IDS.psychologistUsers[index],
  type: psychologist.type as "general" | "clinical",
  consultationChannel: psychologist.channel as "chat" | "chat_and_meet",
  approvalStatus: "approved" as const,
  fullName: psychologist.name,
  dateOfBirth: psychologist.birth,
  address: `${psychologist.city}, Indonesia`,
  photoUrl: psychologist.photo,
  bio: `${psychologist.name} supports ${psychologist.focus.join(", ")} with a warm, structured, evidence-informed counseling style. Sessions focus on practical recovery steps, trigger mapping, emotional regulation, and sustainable routines.`,
})) as const;

export const demoPracticePlaces = demoPsychologists.map((psychologist, index) => ({
  id: DEMO_IDS.practicePlaces[index],
  profileId: DEMO_IDS.psychologistProfiles[index],
  name: `${psychologist.city} Pulih Counseling Center`,
  address: `${psychologist.city}, Indonesia`,
  isActive: true,
})) as const;

export const demoCredentialFiles = demoPsychologists.flatMap((psychologist, index) => {
  const required = psychologist.type === "clinical" ? ["sipp", "ijazah", "strpk", "sippk"] : ["sipp", "ijazah", "str"];
  return required.map((documentType, offset) => ({
    id: DEMO_IDS.credentialFiles[index * 4 + offset],
    profileId: DEMO_IDS.psychologistProfiles[index],
    documentType: documentType as "sipp" | "ijazah" | "str" | "strpk" | "sippk",
    objectKey: `demo/psychologists/${psychologist.email.split("@")[0]}/${documentType}.pdf`,
    fileName: `${psychologist.email.split("@")[0]}-${documentType}.pdf`,
    contentType: "application/pdf",
    sizeBytes: 128000 + index * 4096 + offset * 512,
  }));
}) as const;

const sessionDate = (dayOffset: number, hour: number) => new Date(Date.UTC(2026, 6, 16 + dayOffset, hour - 7, 0, 0));
const timePlusMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

export const demoSessionBundles = demoPsychologists.flatMap((psychologist, index) => [0, 1].map((bundleOffset) => ({
  id: DEMO_IDS.bundles[index * 2 + bundleOffset],
  profileId: DEMO_IDS.psychologistProfiles[index],
  packageName: `${psychologist.duration}-minute ${psychologist.type === "clinical" ? "Clinical" : "General"} Counseling ${bundleOffset === 0 ? "Morning" : "Follow-up"}`,
  packageDurationMinutes: psychologist.duration,
  priceAmount: `${psychologist.price + bundleOffset * 25000}.00`,
  dateStart: sessionDate(bundleOffset * 7, 0),
  dateEnd: sessionDate(bundleOffset * 7 + 6, 0),
  dailyStartTime: bundleOffset === 0 ? psychologist.start : "19:00:00",
  dailyEndTime: bundleOffset === 0 ? timePlusMinutes(new Date(`2026-07-16T${psychologist.start}.000Z`), psychologist.duration).toISOString().slice(11, 19) : "21:00:00",
}))) as const;

export const demoSessionSlots = demoSessionBundles.flatMap((bundle, bundleIndex) => {
  const hour = Number(bundle.dailyStartTime.slice(0, 2));
  return Array.from({ length: 7 }, (_, dayOffset) => {
    const startsAt = sessionDate(dayOffset + (bundleIndex % 2) * 7, hour);
    return {
      id: DEMO_IDS.slots[bundleIndex * 7 + dayOffset],
      bundleId: bundle.id,
      profileId: bundle.profileId,
      sessionDate: sessionDate(dayOffset + (bundleIndex % 2) * 7, 0),
      startsAt,
      endsAt: timePlusMinutes(startsAt, bundle.packageDurationMinutes),
      status: "available" as const,
    };
  });
}) as const;

export const demoBookings = demoPsychologists.map((psychologist, index) => {
  const bundle = demoSessionBundles[index * 2];
  const slot = demoSessionSlots[index * 14];
  return {
    id: DEMO_IDS.bookings[index],
    patientUserId: DEMO_IDS.patientUser,
    psychologistProfileId: DEMO_IDS.psychologistProfiles[index],
    sessionSlotId: slot.id,
    consultationChannel: psychologist.channel as "chat" | "chat_and_meet",
    status: "completed" as const,
    scheduledStartAt: slot.startsAt,
    scheduledEndAt: slot.endsAt,
    priceAmount: bundle.priceAmount,
    packageNameSnapshot: bundle.packageName,
    packageDurationMinutesSnapshot: bundle.packageDurationMinutes,
    paymentExpiresAt: timePlusMinutes(DEMO_NOW, 60),
    complaint: "Demo consultation for recovery routine and relapse prevention planning.",
    meetLink: psychologist.channel === "chat_and_meet" ? "https://meet.google.com/demo-pulih" : null,
    confirmedAt: timePlusMinutes(slot.startsAt, -30),
    rescheduledAt: null,
    rescheduleReason: null,
  };
}) as const;

const demoReviewComments = [
  "Sesi sangat membantu, arahan praktis dan mudah diikuti.",
  "Psikolog mendengarkan dengan baik dan memberi rencana pemulihan yang jelas.",
  "Pendekatannya hangat, terstruktur, dan membuat saya lebih tenang.",
  "Saya jadi lebih paham pola trigger dan cara mengelolanya.",
] as const;

export const demoBookingReviews = demoPsychologists.map((_, index) => ({
  id: DEMO_IDS.reviews[index],
  bookingId: DEMO_IDS.bookings[index],
  patientUserId: DEMO_IDS.patientUser,
  psychologistProfileId: DEMO_IDS.psychologistProfiles[index],
  rating: index % 4 === 0 ? 4 : 5,
  comment: demoReviewComments[index % demoReviewComments.length],
})) as const;

export const demoEducationContents = [
  { id: DEMO_IDS.education[0], title: "Pornography Addiction: Causes, Symptoms, and Treatment", description: "Discusses addiction signs, brain changes, and medical and psychological treatment options.", url: "https://www.alodokter.com/kecanduan-pornografi-penyebab-gejala-dan-perawatan", thumbnail_url: null, type: "artikel" as const, category: "Impact of Pornography" },
  { id: DEMO_IDS.education[1], title: "6 Effects of Watching Porn You Should Not Ignore", description: "Summarizes impacts on responsibility, relationships, productivity, and mental health from excessive consumption.", url: "https://www.alodokter.com/dampak-buruk-yang-dapat-dialami-penggemar-video-porno", thumbnail_url: null, type: "artikel" as const, category: "Impact of Pornography" },
  { id: DEMO_IDS.education[2], title: "Brain Activity in Porn Addicts Resembles Drug Addicts", description: "Popular review of brain reward system response to repeated pornography consumption.", url: "https://tirto.id/aktivitas-otak-pecandu-pornografi-mirip-pecandu-narkoba-ch4R", thumbnail_url: null, type: "artikel" as const, category: "Impact of Pornography" },
  { id: DEMO_IDS.education[3], title: "Watching Porn Is Normal, But Watch Out for the Risks", description: "Explains reasonable consumption limits, addiction signs, and risks when the habit becomes excessive.", url: "https://hellosehat.com/mental/kecanduan/pria-suka-nonton-film-porno/", thumbnail_url: null, type: "artikel" as const, category: "Impact of Pornography" },
  { id: DEMO_IDS.education[4], title: "Signs of Pornography Addiction and How to Overcome It", description: "Guide to recognizing addiction symptoms and recovery steps you can apply gradually.", url: "https://hellosehat.com/mental/kecanduan/kecanduan-pornografi/", thumbnail_url: null, type: "artikel" as const, category: "Impact of Pornography" },
  { id: DEMO_IDS.education[5], title: "Erectile Dysfunction from Porn Addiction: Is It Possible?", description: "Discusses the link between excessive adult content exposure and risk of erectile and sexual dysfunction.", url: "https://www.klikdokter.com/gaya-hidup/perawatan-pria/disfungsi-ereksi-akibat-kecanduan-film-porno-mungkinkah", thumbnail_url: null, type: "artikel" as const, category: "Impact of Pornography" },
  { id: DEMO_IDS.education[6], title: "Men Addicted to Pornography at Risk of Impotence", description: "Explains the mechanism of reduced sexual stimulation sensitivity from excessive porn consumption.", url: "https://hellosehat.com/pria/penyakit-pria/kecanduan-pornografi-risiko-impoten/", thumbnail_url: null, type: "artikel" as const, category: "Impact of Pornography" },
  { id: DEMO_IDS.education[7], title: "Therapy for Teens Addicted to Pornography", description: "Discusses therapy options for teens, including behavior modification, psychotherapy, and family support.", url: "https://www.klikdokter.com/psikologi/kesehatan-mental/terapi-untuk-remaja-yang-kecanduan-pornografi", thumbnail_url: null, type: "artikel" as const, category: "Impact of Pornography" },
  { id: DEMO_IDS.education[8], title: "Strategies to Prevent and Overcome Porn Addiction", description: "Discusses prevention, CBT, social support, and healthy routines for recovery.", url: "https://www.klikdokter.com/psikologi/kesehatan-mental/menavigasi-lautan-digital-strategi-menarik-untuk-mencegah-dan-mengatasi-kecanduan-porno", thumbnail_url: null, type: "artikel" as const, category: "Recovery" },
  { id: DEMO_IDS.education[9], title: "Effects of Pornography Addiction on Mental Health", description: "Discusses impact on anxiety, mood, productivity, and daily relationship quality.", url: "https://www.halodoc.com/artikel/ini-efek-kecanduan-pornografi-pada-kesehatan-mental", thumbnail_url: null, type: "artikel" as const, category: "Recovery" },
  { id: DEMO_IDS.education[10], title: "Effect of Porn Addiction on Erectile Dysfunction", description: "Explains the link between brain response changes from porn content and erectile dysfunction.", url: "https://www.halodoc.com/artikel/efek-kecanduan-pornografi-pada-disfungsi-ereksi", thumbnail_url: null, type: "artikel" as const, category: "Recovery" },
  { id: DEMO_IDS.education[11], title: "Dopamine Detox: A Method to Overcome Addiction", description: "Explains the dopamine detox concept as a gradual instant stimulation reduction strategy.", url: "https://www.alodokter.com/dopamine-detox-pilihan-metode-untuk-mengatasi-kecanduan", thumbnail_url: null, type: "artikel" as const, category: "Recovery" },
  { id: DEMO_IDS.education[12], title: "Understanding Dopamine Detox: Benefits and How to Do It", description: "Discusses benefits, scientific limits, and practical steps for safe dopamine detox.", url: "https://www.halodoc.com/artikel/mengenal-dopamine-detox-manfaat-dan-cara-melakukannya", thumbnail_url: null, type: "artikel" as const, category: "Recovery" },
  { id: DEMO_IDS.education[13], title: "Effective Ways to Avoid PMO Addiction", description: "Preventive steps and early intervention guide so the porn-masturbation-orgasm cycle does not worsen.", url: "https://www.halodoc.com/artikel/cara-jitu-agar-tidak-kecanduan-pmo", thumbnail_url: null, type: "artikel" as const, category: "Recovery" },
  { id: DEMO_IDS.education[14], title: "7 Ways to Stop Masturbation and Break Free from Addiction", description: "Strategies for recognizing triggers, avoiding porn content, and seeking professional help when needed.", url: "https://www.alodokter.com/7-cara-berhenti-onani-supaya-lepas-dari-kecanduan", thumbnail_url: null, type: "artikel" as const, category: "Recovery" },
  { id: DEMO_IDS.education[15], title: "Partner Addicted to Pornography? Here's How to Handle It", description: "Communication tips, support, and healthy boundaries to help a partner break addictive patterns.", url: "https://www.alodokter.com/pasangan-kecanduan-pornografi-ini-cara-mengatasinya", thumbnail_url: null, type: "artikel" as const, category: "Recovery" },
  { id: DEMO_IDS.education[16], title: "First Steps to Quit Pornography Addiction", description: "Discusses the mindset shift from denial to recovery action.", url: "https://www.youtube.com/watch?v=a37iuykI9Io", thumbnail_url: "https://i.ytimg.com/vi/a37iuykI9Io/maxresdefault.jpg", type: "video" as const, category: "Mental Health" },
  { id: DEMO_IDS.education[17], title: "What Happens When You Stop Consuming Pornography", description: "Timeline explanation of physical-mental recovery after stopping addictive content exposure.", url: "https://www.youtube.com/watch?v=gJjsm2xcOy8", thumbnail_url: "https://i.ytimg.com/vi/gJjsm2xcOy8/maxresdefault.jpg", type: "video" as const, category: "Holistic Health" },
  { id: DEMO_IDS.education[18], title: "How to Manage Desires - Ustadz Adi Hidayat", description: "Spiritual and self-discipline perspective on managing urges.", url: "https://www.youtube.com/watch?v=TqZIsmrQ06o", thumbnail_url: "https://i.ytimg.com/vi/TqZIsmrQ06o/maxresdefault.jpg", type: "video" as const, category: "Spirituality" },
  { id: DEMO_IDS.education[19], title: "What Happens When Someone Is Addicted to Pornography?", description: "Scientific explanation of addiction impact on the brain and behavior.", url: "https://www.youtube.com/watch?v=Sq1s564ukTI", thumbnail_url: "https://i.ytimg.com/vi/Sq1s564ukTI/maxresdefault.jpg", type: "video" as const, category: "Mental Health" },
  { id: DEMO_IDS.education[20], title: "Discipline Tips for Building Habits", description: "Summary of habit design principles for sustainable behavior change.", url: "https://www.youtube.com/watch?v=uqGf4PWDOUw", thumbnail_url: "https://i.ytimg.com/vi/uqGf4PWDOUw/maxresdefault.jpg", type: "video" as const, category: "Personal Development" },
  { id: DEMO_IDS.education[21], title: "How to Reset Your Life in 7 Days", description: "Routine reset strategy to break destructive patterns and build a new direction.", url: "https://www.youtube.com/watch?v=gPdKGv9ZuAU", thumbnail_url: "https://i.ytimg.com/vi/gPdKGv9ZuAU/maxresdefault.jpg", type: "video" as const, category: "Personal Development" },
  { id: DEMO_IDS.education[22], title: "Secrets to Overcoming Laziness and Being Productive Again", description: "Practical techniques to start small actions when motivation drops.", url: "https://www.youtube.com/watch?v=WMfRHf5kjsE", thumbnail_url: "https://i.ytimg.com/vi/WMfRHf5kjsE/maxresdefault.jpg", type: "video" as const, category: "Productivity" },
  { id: DEMO_IDS.education[23], title: "How to Be So Productive It Feels Illegal", description: "Collection of productivity habits adaptable to recovery routines.", url: "https://www.youtube.com/watch?v=hSGt_rhu49U", thumbnail_url: "https://i.ytimg.com/vi/hSGt_rhu49U/maxresdefault.jpg", type: "video" as const, category: "Productivity" },
  { id: DEMO_IDS.education[24], title: "Keys to Happiness and Life Priority Focus", description: "Discusses priority selection so mental energy isn't wasted on unimportant things.", url: "https://www.youtube.com/watch?v=dAI12OGD04A", thumbnail_url: "https://i.ytimg.com/vi/dAI12OGD04A/maxresdefault.jpg", type: "video" as const, category: "Self-Awareness" },
  { id: DEMO_IDS.education[25], title: "How to Stop Overthinking", description: "Practical stoicism principles for managing excessive thoughts.", url: "https://www.youtube.com/watch?v=9qwR3GmR63I", thumbnail_url: "https://i.ytimg.com/vi/9qwR3GmR63I/maxresdefault.jpg", type: "video" as const, category: "Self-Awareness" },
  { id: DEMO_IDS.education[26], title: "How to Improve Focus and Learning Intelligence", description: "Structured learning strategies to strengthen thinking ability.", url: "https://www.youtube.com/watch?v=H-DeO-hnyTc", thumbnail_url: "https://i.ytimg.com/vi/H-DeO-hnyTc/maxresdefault.jpg", type: "video" as const, category: "Personal Development" },
  { id: DEMO_IDS.education[27], title: "Overcoming Loneliness", description: "Guide to building healthy social connections to reduce relapse risk.", url: "https://www.youtube.com/watch?v=0b9Qzow_lv0", thumbnail_url: "https://i.ytimg.com/vi/0b9Qzow_lv0/maxresdefault.jpg", type: "video" as const, category: "Mental Health" },
  { id: DEMO_IDS.education[28], title: "For Those Tired of Being an Adult, Watch This", description: "Discusses adult life pressures and steps to maintain emotional stability.", url: "https://www.youtube.com/watch?v=ZOQhVk_YuSY", thumbnail_url: "https://i.ytimg.com/vi/ZOQhVk_YuSY/maxresdefault.jpg", type: "video" as const, category: "Mental Health" },
  { id: DEMO_IDS.education[29], title: "Secrets to Becoming a Valuable Person", description: "Character development insight and courage to take personal responsibility.", url: "https://www.youtube.com/watch?v=E14rVsVJk0M", thumbnail_url: "https://i.ytimg.com/vi/E14rVsVJk0M/maxresdefault.jpg", type: "video" as const, category: "Personal Development" },
  { id: DEMO_IDS.education[30], title: "How to Quit Pornography Addiction - Practical Tips", description: "Step-by-step guide to gradually stop consuming adult content.", url: "https://www.youtube.com/watch?v=example1", thumbnail_url: "https://i.ytimg.com/vi/example1/maxresdefault.jpg", type: "video" as const, category: "Recovery" },
] as const;

export const demoDailyMotivations = [
  "Every day is a new opportunity to become a better version of yourself.",
  "You are stronger than you think. Every time you resist temptation, you are building character.",
  "Relapse is not the end; what matters is getting back up and learning from the pattern.",
  "Change begins with small decisions repeated every day.",
  "You are not alone in this fight; support is always available.",
  "Focus on today. One consistent day is a real victory.",
  "Recovery success is measured by how often you get back up after falling.",
  "Your brain is adapting. Be patient with the healing process.",
  "Every healthy decision today strengthens your future self.",
  "You deserve a clear mind and healthy relationships.",
  "Progress may not be visible, but the process is still working.",
  "Hard days are resilience training; you are strengthening your mind.",
  "Remember why you started: health, relationships, and a better future.",
  "Recovery is an act of self-care.",
  "Small victories today build big victories later.",
  "The past does not define your future.",
  "Urges will pass; what matters is your response when they come.",
  "Consistency builds a foundation that won't easily crumble.",
  "Don't compare your journey to others.",
  "When you want to give up, remember why you started.",
  "Your struggle today is building your resilience for tomorrow.",
  "Stay present, stay aware, keep choosing what is healthy.",
  "Negative thoughts are not commands; you can choose a new response.",
  "You don't need to be perfect to keep moving forward.",
  "The best investment is taking care of your mental health every day.",
  "Your support system sees your struggle and it matters.",
  "Recovery is a marathon, not a sprint. Slow but consistent.",
  "You have the ability to get through this difficult phase.",
  "Every time you withstand temptation, you build self-control.",
  "Today may be heavy, but you can still choose a healthy step.",
  "Small consistent rhythms are stronger than momentary motivation.",
  "One right decision in a tough moment can change the direction of your day.",
  "If you fail today, reset tonight, start again tomorrow morning.",
  "You grow every time you choose awareness over autopilot.",
  "Asking for help is a sign of strength, not weakness.",
] as const;

export const demoDailyChallenges = [
  { title: "Wake Up Early", description: "Wake up earlier and start the day with a plan of 3 healthy priorities.", content: "Wake up earlier and start the day with a plan of 3 healthy priorities." },
  { title: "Read Educational Content", description: "Read recovery-focused educational content for at least 15 minutes.", content: "Read recovery-focused educational content for at least 15 minutes." },
  { title: "Exercise 30 Minutes", description: "Exercise for 30 minutes to lower impulses and stress.", content: "Exercise for 30 minutes to lower impulses and stress." },
  { title: "Cold Shower", description: "Take a cold shower or do a quick physical reset technique.", content: "Take a cold shower or do a quick physical reset technique." },
  { title: "Contact Partner", description: "Reach out to your accountability partner and send a brief update.", content: "Reach out to your accountability partner and send a brief update." },
  { title: "Watch Recovery Material", description: "Watch or listen to 1 applicable recovery resource.", content: "Watch or listen to 1 applicable recovery resource." },
  { title: "Write Gratitude & Triggers", description: "Write 5 things you're grateful for and 3 main triggers today.", content: "Write 5 things you're grateful for and 3 main triggers today." },
  { title: "Block Trigger Apps", description: "Activate blocking on trigger apps for 24 hours.", content: "Activate blocking on trigger apps for 24 hours." },
  { title: "Write Personal Reasons", description: "Write your personal reasons for choosing a healthier life.", content: "Write your personal reasons for choosing a healthier life." },
  { title: "Tidy Workspace", description: "Tidy your workspace or room for 15 minutes.", content: "Tidy your workspace or room for 15 minutes." },
  { title: "Mindful Breathing", description: "Practice mindful breathing for 10 minutes when urges arise.", content: "Practice mindful breathing for 10 minutes when urges arise." },
  { title: "Kindness for Others", description: "Do one act of kindness for someone else today.", content: "Do one act of kindness for someone else today." },
  { title: "Identify 3 Triggers", description: "Identify your 3 biggest triggers and prepare backup responses.", content: "Identify your 3 biggest triggers and prepare backup responses." },
  { title: "Quality Time Without Devices", description: "Spend quality device-free time with family or friends.", content: "Spend quality device-free time with family or friends." },
  { title: "Clean Eating", description: "Maintain clean eating and avoid excessive trigger consumption.", content: "Maintain clean eating and avoid excessive trigger consumption." },
  { title: "Reflection Journaling", description: "Journaling reflection: progress, struggles, and tomorrow's plan.", content: "Journaling reflection: progress, struggles, and tomorrow's plan." },
  { title: "3 Targets for 7 Days", description: "Set 3 realistic targets for the next 7 days.", content: "Set 3 realistic targets for the next 7 days." },
  { title: "Self-Improvement Podcast", description: "Listen to a self-improvement podcast during routine activities.", content: "Listen to a self-improvement podcast during routine activities." },
  { title: "Meditate 10-15 Minutes", description: "Meditate for 10-15 minutes to reduce reactivity.", content: "Meditate for 10-15 minutes to reduce reactivity." },
  { title: "Vision Board", description: "Create a simple vision board about your healthy living goals.", content: "Create a simple vision board about your healthy living goals." },
  { title: "No Social Media for 1 Day", description: "Stay off social media for a full day.", content: "Stay off social media for a full day." },
  { title: "Positive Community", description: "Join positive community activities offline or online.", content: "Join positive community activities offline or online." },
  { title: "Stay Hydrated", description: "Drink enough water and maintain body energy throughout the day.", content: "Drink enough water and maintain body energy throughout the day." },
  { title: "Focus Playlist", description: "Create a focus playlist to use when urges increase.", content: "Create a focus playlist to use when urges increase." },
  { title: "Urge Emergency Routine", description: "When urge hits: breathe 5 minutes + 20 push-ups + change location.", content: "When urge hits: breathe 5 minutes + 20 push-ups + change location." },
  { title: "Reconnect Positively", description: "Reach out to one positive connection you haven't spoken to in a while.", content: "Reach out to one positive connection you haven't spoken to in a while." },
  { title: "Record Small Wins", description: "Record all the small wins since starting recovery.", content: "Record all the small wins since starting recovery." },
  { title: "Sleep Earlier", description: "Go to bed at least 30 minutes earlier than usual.", content: "Go to bed at least 30 minutes earlier than usual." },
  { title: "Change Negative Self-Talk", description: "Change one negative self-talk into a realistic affirmation.", content: "Change one negative self-talk into a realistic affirmation." },
  { title: "Outdoor 30 Minutes", description: "Spend 30 minutes outdoors to reset your mind.", content: "Spend 30 minutes outdoors to reset your mind." },
  { title: "Audit Browser History", description: "Audit your browser history and clean up trigger sources.", content: "Audit your browser history and clean up trigger sources." },
  { title: "Focus Mode 2x45 Minutes", description: "Use focus mode for 2 sessions x 45 minutes on main tasks.", content: "Use focus mode for 2 sessions x 45 minutes on main tasks." },
  { title: "Emotion Check-in 3 Times", description: "Do an emotion check-in 3 times: morning, afternoon, evening.", content: "Do an emotion check-in 3 times: morning, afternoon, evening." },
  { title: "Emergency Note", description: "Prepare an emergency note on your phone to read during crises.", content: "Prepare an emergency note on your phone to read during crises." },
  { title: "End-of-Day Evaluation", description: "Close the day with evaluation: what triggered, what response, what lesson.", content: "Close the day with evaluation: what triggered, what response, what lesson." },
  { title: "Digital Sunset", description: "Do a digital sunset: stop screens 60 minutes before sleep.", content: "Do a digital sunset: stop screens 60 minutes before sleep." },
  { title: "5 Replacement Activities", description: "Make a list of 5 replacement activities when urges appear.", content: "Make a list of 5 replacement activities when urges appear." },
  { title: "5-4-3-2-1 Grounding", description: "Practice the 5-4-3-2-1 grounding technique at least 2 times today.", content: "Practice the 5-4-3-2-1 grounding technique at least 2 times today." },
  { title: "Walk Without Phone", description: "Take a 20-minute walk without your phone to reset your mind.", content: "Take a 20-minute walk without your phone to reset your mind." },
  { title: "Clean Your Feed", description: "Clean up your social media feed from triggering accounts or keywords.", content: "Clean up your social media feed from triggering accounts or keywords." },
  { title: "Emotion Journal 10 Minutes", description: "Write a 10-minute journal about your most dominant emotion today.", content: "Write a 10-minute journal about your most dominant emotion today." },
  { title: "Pomodoro 3 Sessions", description: "Use the pomodoro technique for 3 sessions on important tasks today.", content: "Use the pomodoro technique for 3 sessions on important tasks today." },
  { title: "Plan Tomorrow", description: "Prepare tomorrow's plan tonight: 3 priorities and 1 digital boundary.", content: "Prepare tomorrow's plan tonight: 3 priorities and 1 digital boundary." },
  { title: "Update Support System", description: "Contact one support system person and send a brief progress update.", content: "Contact one support system person and send a brief progress update." },
  { title: "Healthy Self-Talk", description: "Practice healthy self-talk: change 3 negative thoughts into realistic sentences.", content: "Practice healthy self-talk: change 3 negative thoughts into realistic sentences." },
  { title: "4-7-8 Breathing", description: "Do 4-7-8 breathing exercises for 5 minutes when stress increases.", content: "Do 4-7-8 breathing exercises for 5 minutes when stress increases." },
  { title: "Rearrange Room", description: "Rearrange your room/workspace to reduce visual distractions.", content: "Rearrange your room/workspace to reduce visual distractions." },
  { title: "Morning Routine Checklist", description: "Create a morning routine checklist and complete at least 80%.", content: "Create a morning routine checklist and complete at least 80%." },
  { title: "Most Delayed Task", description: "Complete 1 most-delayed task (minimum 25 minutes).", content: "Complete 1 most-delayed task (minimum 25 minutes)." },
  { title: "Evening Gratitude", description: "Close the day with gratitude: write 3 good things that happened today.", content: "Close the day with gratitude: write 3 good things that happened today." },
  { title: "No Gadget 30 Minutes", description: "No gadgets for 30 minutes after waking so mornings are more intentional.", content: "No gadgets for 30 minutes after waking so mornings are more intentional." },
  { title: "Healthy Meal", description: "Prepare one healthy meal today to keep energy stable.", content: "Prepare one healthy meal today to keep energy stable." },
  { title: "3 Triggers + Response", description: "Write down 3 main triggers this week and 1 replacement response for each.", content: "Write down 3 main triggers this week and 1 replacement response for each." },
  { title: "Stretch 10 Minutes", description: "Stretch for 10 minutes whenever your mind starts to stall.", content: "Stretch for 10 minutes whenever your mind starts to stall." },
  { title: "Turn Off Notifications", description: "Turn off non-essential notifications during main focus hours.", content: "Turn off non-essential notifications during main focus hours." },
  { title: "Read Recovery Reasons", description: "Re-read your personal recovery reasons before sleeping tonight.", content: "Re-read your personal recovery reasons before sleeping tonight." },
  { title: "Positive Social Action", description: "Do 1 positive social action: greet, help, or appreciate someone.", content: "Do 1 positive social action: greet, help, or appreciate someone." },
  { title: "10-Minute Rule", description: "Use the 10-minute rule: start a difficult task for at least 10 minutes without breaks.", content: "Use the 10-minute rule: start a difficult task for at least 10 minutes without breaks." },
  { title: "Avoid Random Content", description: "Finish today without opening random content during vulnerable hours.", content: "Finish today without opening random content during vulnerable hours." },
  { title: "Emergency 3-Step Plan", description: "Write a 3-step emergency plan for facing sudden urges.", content: "Write a 3-step emergency plan for facing sudden urges." },
  { title: "Emotion Check Every 4 Hours", description: "Check your emotions every 4 hours and note mood changes.", content: "Check your emotions every 4 hours and note mood changes." },
  { title: "Learn a New Skill", description: "Spend 20 minutes learning a new skill as a replacement for scrolling.", content: "Spend 20 minutes learning a new skill as a replacement for scrolling." },
  { title: "Organize Digital Files", description: "Organize digital files/folders to reduce visual distractions.", content: "Organize digital files/folders to reduce visual distractions." },
  { title: "8 Glasses of Water", description: "Stay hydrated: drink water regularly throughout the day, at least 8 glasses.", content: "Stay hydrated: drink water regularly throughout the day, at least 8 glasses." },
  { title: "Afternoon Evaluation", description: "Do an afternoon evaluation: what triggered, what worked, what to improve.", content: "Do an afternoon evaluation: what triggered, what worked, what to improve." },
  { title: "App Limit 45 Minutes", description: "Set entertainment app limits to a maximum of 45 minutes today.", content: "Set entertainment app limits to a maximum of 45 minutes today." },
  { title: "Non-Screen Evening Activity", description: "Schedule a calming evening activity that doesn't involve screens.", content: "Schedule a calming evening activity that doesn't involve screens." },
  { title: "Share a Win", description: "Write down 1 small win today and share it with your accountability partner.", content: "Write down 1 small win today and share it with your accountability partner." },
  { title: "Stop-Breathe-Move", description: "When urges rise: stop, breathe, change location, then start a replacement activity.", content: "When urges rise: stop, breathe, change location, then start a replacement activity." },
  { title: "5-Minute Review", description: "End the day with a 5-minute review and a specific intention for tomorrow morning.", content: "End the day with a 5-minute review and a specific intention for tomorrow morning." },
] as const;

export const demoPhysicalChallenges = [
  { title: "Morning Activation", description: "Stretch your entire body for 10 minutes after waking up." },
  { title: "Brisk Walk", description: "Walk briskly for 20 minutes without your phone to reset energy and focus." },
  { title: "Push-up Set", description: "Complete 3 sets of push-ups (10 reps each) with controlled rest." },
  { title: "Squat Set", description: "Complete 3 sets of squats (15 reps each) for leg activation." },
  { title: "Core Challenge", description: "Hold a plank for a total of 3 minutes (can be divided into multiple sets)." },
  { title: "Mobility Break", description: "Take 3 mobility breaks @5 minutes each throughout the workday." },
  { title: "Light Cardio", description: "Jog or stationary bike for at least 15 minutes at light intensity." },
  { title: "Active Stairs", description: "Go up and down stairs for a total of 10 minutes instead of sitting long." },
  { title: "Cold Finish", description: "End your shower with 60 seconds of cold water to train impulse control." },
  { title: "Breath + Body", description: "Combine 5 minutes of focused breathing then 20 light burpees." },
  { title: "Sunlight Walk", description: "Get morning sunlight exposure while walking leisurely for 15 minutes." },
  { title: "Desk Reset", description: "Every 60 minutes of sitting, do 1 minute of active movement (stretch or squat)." },
  { title: "Evening Stretch", description: "Do a 12-minute evening stretching routine before bed." },
  { title: "Glute Bridge", description: "Complete 3 sets of glute bridges (15 reps each)." },
  { title: "Wall Sit", description: "Hold a wall sit for a total of 2 minutes, divided into 2-4 sets." },
  { title: "Lunge Flow", description: "Do alternating lunges for a total of 24 reps with controlled movement." },
  { title: "Low Impact HIIT", description: "Complete 10 minutes of low-impact HIIT (30 sec work, 30 sec rest)." },
  { title: "Hip Mobility", description: "Do hip mobility exercises for 8-10 minutes to reduce tension." },
  { title: "Shoulder Release", description: "Do shoulder and upper back drills for 10 minutes for better posture." },
  { title: "Night Walk", description: "Take a leisurely 15-minute walk after dinner to reduce stress." },
] as const;

export const demoAchievements = [
  { key: "first_check_in", title: "First Check-in", description: "Complete your first daily check-in.", criteria: { type: "check_in_count", target: 1 } },
  { key: "three_day_streak", title: "Three-day Streak", description: "Complete check-ins for three days.", criteria: { type: "streak", target: 3 } },
  { key: "five_journals", title: "Five Journals", description: "Write five private journal entries.", criteria: { type: "journal_count", target: 5 } },
  { key: "support_builder", title: "Support Builder", description: "Reach out to support and stay connected.", criteria: { type: "check_in_count", target: 7 } },
  { key: "steady_week", title: "Steady Week", description: "Keep a seven-day recovery streak alive.", criteria: { type: "streak", target: 7 } },
  { key: "routine_reset", title: "Routine Reset", description: "Show up after a rough day and start again.", criteria: { type: "check_in_count", target: 10 } },
  { key: "reflection_practice", title: "Reflection Practice", description: "Use reflection to learn from your progress.", criteria: { type: "journal_count", target: 10 } },
  { key: "safe_support", title: "Safe Support", description: "Use help early when the day feels heavier.", criteria: { type: "check_in_count", target: 14 } },
  { key: "resilience_marker", title: "Resilience Marker", description: "Keep returning to your routine after setbacks.", criteria: { type: "streak", target: 14 } },
  { key: "demo_ready", title: "Demo Ready", description: "Complete a complete recovery demo flow.", criteria: { type: "journal_count", target: 14 } },
  { key: "clear_mindset", title: "Clear Mindset", description: "Show consistent support-seeking over time.", criteria: { type: "check_in_count", target: 18 } },
  { key: "long_game", title: "Long Game", description: "Hold a longer streak through ordinary days.", criteria: { type: "streak", target: 21 } },
] as const;

export const demoCommunityPosts = [
  { id: DEMO_IDS.posts[0], userId: DEMO_IDS.patientUser, category: "story" as const, content: "Today I picked one simple routine and kept it. That felt enough for a good start." },
  { id: DEMO_IDS.posts[1], userId: DEMO_IDS.psychologistUser, category: "advice" as const, content: "Progress often looks like repeating the basics with more honesty and less shame." },
  { id: DEMO_IDS.posts[2], userId: DEMO_IDS.patientUser, category: "motivation" as const, content: "I used a grounding exercise instead of reacting automatically, and it changed the evening." },
  { id: DEMO_IDS.posts[3], userId: DEMO_IDS.psychologistUser, category: "help" as const, content: "If today feels heavy, make the next step tiny. Tiny still counts." },
  { id: DEMO_IDS.posts[4], userId: DEMO_IDS.patientUser, category: "question" as const, content: "Has anyone else found that short walks help with evening urges? I tried it and it worked." },
  { id: DEMO_IDS.posts[5], userId: DEMO_IDS.psychologistUser, category: "advice" as const, content: "Healthy recovery usually looks ordinary: sleep, food, support, and repetition." },
] as const;

export const demoCommunityComments = [
  { id: DEMO_IDS.comments[0], postId: DEMO_IDS.posts[0], userId: DEMO_IDS.psychologistUser, content: "This is exactly the kind of steady step that builds confidence." },
  { id: DEMO_IDS.comments[1], postId: DEMO_IDS.posts[0], userId: DEMO_IDS.patientUser, content: "Thank you for sharing this. It helps to hear a realistic win." },
  { id: DEMO_IDS.comments[2], postId: DEMO_IDS.posts[1], userId: DEMO_IDS.patientUser, content: "The reminder about honesty and less shame really landed." },
  { id: DEMO_IDS.comments[3], postId: DEMO_IDS.posts[2], userId: DEMO_IDS.psychologistUser, content: "Great example of choosing regulation before reaction." },
  { id: DEMO_IDS.comments[4], postId: DEMO_IDS.posts[3], userId: DEMO_IDS.patientUser, content: "Tiny steps are easier to trust on difficult days." },
  { id: DEMO_IDS.comments[5], postId: DEMO_IDS.posts[3], userId: DEMO_IDS.psychologistUser, content: "Exactly. Keep the goal small enough to keep going." },
  { id: DEMO_IDS.comments[6], postId: DEMO_IDS.posts[4], userId: DEMO_IDS.patientUser, content: "A calm reset can really change the rest of the day." },
  { id: DEMO_IDS.comments[7], postId: DEMO_IDS.posts[4], userId: DEMO_IDS.psychologistUser, content: "That is a strong example of interrupting the pattern early." },
  { id: DEMO_IDS.comments[8], postId: DEMO_IDS.posts[5], userId: DEMO_IDS.patientUser, content: "Ordinary habits are starting to feel more reliable than motivation." },
  { id: DEMO_IDS.comments[9], postId: DEMO_IDS.posts[5], userId: DEMO_IDS.psychologistUser, content: "That reliability is exactly what makes routines powerful." },
  { id: DEMO_IDS.comments[10], postId: DEMO_IDS.posts[2], userId: DEMO_IDS.patientUser, content: "Good reminder that regulation can happen before the reaction grows." },
  { id: DEMO_IDS.comments[11], postId: DEMO_IDS.posts[1], userId: DEMO_IDS.psychologistUser, content: "Less shame, more honesty, more support. That is the right direction." },
] as const;

export const demoCommunityLikes = [
  { postId: DEMO_IDS.posts[0], userId: DEMO_IDS.patientUser },
  { postId: DEMO_IDS.posts[0], userId: DEMO_IDS.psychologistUser },
  { postId: DEMO_IDS.posts[1], userId: DEMO_IDS.patientUser },
  { postId: DEMO_IDS.posts[1], userId: DEMO_IDS.psychologistUser },
  { postId: DEMO_IDS.posts[2], userId: DEMO_IDS.patientUser },
  { postId: DEMO_IDS.posts[2], userId: DEMO_IDS.psychologistUser },
  { postId: DEMO_IDS.posts[3], userId: DEMO_IDS.patientUser },
  { postId: DEMO_IDS.posts[3], userId: DEMO_IDS.psychologistUser },
  { postId: DEMO_IDS.posts[4], userId: DEMO_IDS.patientUser },
  { postId: DEMO_IDS.posts[5], userId: DEMO_IDS.psychologistUser },
] as const;
