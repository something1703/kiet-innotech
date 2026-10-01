/**
 * All static content for the InnoTech'26 landing page.
 * Source: "INNOTECH26 Budget Note and Proposal" and "Budget and Requirements" documents.
 * Keep copy changes here so components stay presentation-only.
 */

export const event = {
  name: "InnoTech'26",
  tagline: "Think Big, Build Smart, Act Sustainable",
  theme: "Building an Innovative, Secure and Sustainable Viksit Bharat @2047",
  finaleDate: "2026-10-30T09:00:00+05:30",
  /** After this the landing page says the event has concluded. */
  finaleEndDate: "2026-10-30T23:59:59+05:30",
  finaleLabel: "30 October 2026",
  venue: "KIET Deemed to be University, Delhi-NCR, Ghaziabad",
  organiser: "Department of Information Technology & CSE (Cyber Security)",
  website: "innotech.kiet.edu",
  address:
    "KIET Deemed to be University, Delhi-NCR, Meerut Road (NH-58), Ghaziabad, Uttar Pradesh 201206",
  mapUrl: "https://maps.google.com/?q=KIET+Group+of+Institutions+Ghaziabad",
  mapEmbedUrl:
    "https://www.google.com/maps?q=KIET+Group+of+Institutions+Ghaziabad&output=embed",
};

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "Categories", href: "#categories" },
  { label: "Timeline", href: "#timeline" },
  { label: "Prizes", href: "#prizes" },
  { label: "Judging", href: "#judging" },
  { label: "Rules", href: "#rules" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export const liveUpdates = [
  "Registrations open on 3 October 2026 and close on 12 October 2026",
  "No registration fee for any participant",
  "Department level evaluation: 22 to 24 October 2026",
  "Finalists will be declared on 26 October 2026",
  "Institute level Grand Finale on 30 October 2026 at KIET",
  "School students can participate in the two poster categories",
];

export const stats = [
  { value: 8, label: "Categories" },
  { value: 17, label: "Departments" },
  { value: 338000, label: "Prize pool", prefix: "₹", format: "lakh" as const },
  { value: 16, label: "External judges" },
  { value: 180, label: "Exhibition stalls" },
];

export const about = {
  title: "A platform for ideas that serve society",
  paragraphs: [
    "InnoTech'26 is the institute level technical event of KIET, organised by the Department of Information Technology & CSE (Cyber Security). It brings together Artificial Intelligence, Cyber Security, Start-ups and Innovative Projects on one stage.",
    "The event focuses on societal issues and challenges, and on solutions that map to the Sustainable Development Goals (SDGs) and the vision of Viksit Bharat @2047. Students present working projects, prototypes and posters to faculty and external industry judges.",
  ],
  highlights: [
    "Projects aligned with the Sustainable Development Goals",
    "Evaluation by faculty and external judges from the NCR region",
    "Start-up guidance and funding discussions with KIET TBI",
  ],
};

export const benefits = [
  {
    icon: "trophy",
    title: "Cash Prizes",
    text: "Prizes worth ₹3.38 lakh across department and institute levels, with trophies for winners.",
  },
  {
    icon: "rocket",
    title: "Start-up Support",
    text: "Discuss funding and start-up registration with the KIET Technology Business Incubator.",
  },
  {
    icon: "users",
    title: "Networking",
    text: "Connect with faculty, industry experts, registered start-ups and fellow innovators.",
  },
  {
    icon: "award",
    title: "Recognition",
    text: "Certificates for winners and e-certificates for participants, plus campus-wide exposure.",
  },
  {
    icon: "shield",
    title: "Expert Feedback",
    text: "Get your work reviewed against clear rubrics by experienced judges.",
  },
  {
    icon: "lightbulb",
    title: "Real Impact",
    text: "Turn ideas into solutions for real problems faced by society and industry.",
  },
] as const;

export const domains = [
  "Artificial Intelligence & Machine Learning",
  "Agentic AI & Generative AI",
  "Cyber Security, Privacy & Trustworthy AI",
  "IoT, Robotics & Automation",
  "Blockchain & Digital Transformation",
  "Renewable Energy & Sustainable Engineering",
  "Smart Cities, Infrastructure & Green Mobility",
  "Healthcare, Biomedical Devices & Biotechnology",
  "AR/VR, Digital Twins & Industry 4.0",
  "Big Data, Cloud, 5G/6G & Quantum Technologies",
  "Affordable Technology for Rural Development",
  "Disaster Management & Environmental Solutions",
  "Start-up & Revenue Generation Solutions",
];

export type RubricGroup =
  | "software"
  | "hardware"
  | "startup"
  | "genz"
  | "poster"
  | "cybershield";

export type Category = {
  number: number;
  title: string;
  summary: string;
  topics: string[];
  isPoster: boolean;
  openToSchools: boolean;
  firstYearOnly: boolean;
  rubric: RubricGroup;
};

export const categories: Category[] = [
  {
    number: 1,
    title: "Smart Solutions, Smarter Society",
    summary: "Software projects that make everyday services smarter.",
    topics: [
      "Web Services and Applications",
      "APIs and Utilities",
      "Mobile Applications",
      "E-Support and Chatbots",
      "Bioinformatics and Healthcare Solutions",
    ],
    isPoster: false,
    openToSchools: false,
    firstYearOnly: false,
    rubric: "software",
  },
  {
    number: 2,
    title: "AI Solutions for Automation",
    summary: "AI-driven projects that automate decisions and processes.",
    topics: [
      "AI Support and Intelligent Solutions",
      "Agentic AI and Automation",
      "Generative AI and LLM Applications",
      "AI-Based Decision Support Systems",
      "Intelligent Process Automation",
    ],
    isPoster: false,
    openToSchools: false,
    firstYearOnly: false,
    rubric: "software",
  },
  {
    number: 3,
    title: "Automation and Robotics",
    summary: "IoT, embedded systems and robotics built for the real world.",
    topics: [
      "IoT-Based Applications",
      "Robotics Solutions",
      "IR and Sensor-Based Applications",
      "Smart Manufacturing and Industrial Automation",
      "Image Processing and Computer Vision",
      "NLP-Based Intelligent Systems",
    ],
    isPoster: false,
    openToSchools: false,
    firstYearOnly: false,
    rubric: "hardware",
  },
  {
    number: 4,
    title: "From Concept to Reality",
    summary: "Emerging technology and hardware taken from idea to prototype.",
    topics: [
      "Drone Solutions",
      "Space Technology Solutions",
      "Electric Vehicle (EV) Solutions",
      "Medical Devices",
      "Green Energy and Clean Technology",
    ],
    isPoster: false,
    openToSchools: false,
    firstYearOnly: false,
    rubric: "hardware",
  },
  {
    number: 5,
    title: "Start Small, Scale Big, Sustain Always",
    summary: "Start-up ideas and business solutions presented as posters.",
    topics: [
      "Start-up Ideas",
      "Marketing Solutions",
      "Productivity and Production Solutions",
      "Revenue Generation Solutions",
      "Economic Growth and Business Solutions",
      "Registered Firms and MSME Solutions",
    ],
    isPoster: true,
    openToSchools: true,
    firstYearOnly: false,
    rubric: "startup",
  },
  {
    number: 6,
    title: "Gen Z to Budding Innovators",
    summary:
      "Prototypes and innovative solutions built entirely by first-year students.",
    topics: [
      "Working prototypes on any theme",
      "Innovative solutions to real problems",
      "All team members must be first-year students",
    ],
    isPoster: false,
    openToSchools: false,
    firstYearOnly: true,
    rubric: "genz",
  },
  {
    number: 7,
    title: "Creative Visions for a Sustainable Future",
    summary: "Creative ideas, posters and models for a better society.",
    topics: [
      "Civic Sense and Moral Values",
      "Humanity, Ethics, and Social Responsibility",
      "Infrastructure and Architectural Designs",
      "Smart Classrooms, Homes, Buildings, Cities and EVs",
      "Social and Environmental Solutions",
      "Green Energy and Sustainable Development",
      "Ideas without Software or Hardware Implementation",
    ],
    isPoster: true,
    openToSchools: true,
    firstYearOnly: false,
    rubric: "poster",
  },
  {
    number: 8,
    title: "CyberShield",
    summary: "Secure, trustworthy and quantum-safe technology.",
    topics: [
      "Threat and Intrusion Detection, Malware Analysis, Forensics",
      "Privacy-preserving and Explainable AI",
      "Post-quantum Cryptography and QKD",
      "Blockchain, Identity and Authentication",
      "Cybercrime and Fraud Prevention",
      "AI and Quantum-enabled Security",
    ],
    isPoster: false,
    openToSchools: false,
    firstYearOnly: false,
    rubric: "cybershield",
  },
];

export const participantTracks = [
  {
    title: "KIET Students",
    audience: "All 17 departments",
    steps: ["Register", "Department round", "Finale"],
    points: [
      "Register with your official @kiet.edu email",
      "Compete at department level from 22 to 24 October",
      "Top teams from each department move to the finale",
    ],
  },
  {
    title: "Other Colleges",
    audience: "Students from any college",
    steps: ["Register", "Finale"],
    points: [
      "Register with any valid email address",
      "Choose any one of the eight categories",
      "Teams go directly to the institute level finale",
    ],
  },
  {
    title: "School Students",
    audience: "Budding Engineers",
    steps: ["Register", "Finale"],
    points: [
      "Participate in the two poster categories (5 and 7)",
      "Teams go directly to the institute level finale",
      "Compete for the Best School Project/Poster award",
    ],
  },
];

export type Milestone = {
  title: string;
  dateLabel: string;
  start: string;
  end: string;
  description: string;
};

export const timeline: Milestone[] = [
  {
    title: "Registrations Open",
    dateLabel: "3 Oct 2026",
    start: "2026-10-03",
    end: "2026-10-03",
    description: "Individual registration begins. Team leaders can start forming teams.",
  },
  {
    title: "Registrations Close",
    dateLabel: "12 Oct 2026",
    start: "2026-10-12",
    end: "2026-10-12",
    description: "Last day to register and submit your team. Teams are locked after submission.",
  },
  {
    title: "Department Level",
    dateLabel: "22 - 24 Oct 2026",
    start: "2026-10-22",
    end: "2026-10-24",
    description: "KIET teams are evaluated by faculty from other departments using common rubrics.",
  },
  {
    title: "Finalists Declared",
    dateLabel: "26 Oct 2026",
    start: "2026-10-26",
    end: "2026-10-26",
    description: "Department finalists are announced for the institute level finale.",
  },
  {
    title: "Grand Finale",
    dateLabel: "30 Oct 2026",
    start: "2026-10-30",
    end: "2026-10-30",
    description: "Institute level exhibition, external jury evaluation and prize distribution.",
  },
];

export const institutePrizes = [
  {
    title: "Project Categories",
    categories: "Categories 1, 2, 3, 4, 6 and 8",
    first: 8000,
    second: 5000,
  },
  {
    title: "Poster Categories",
    categories: "Categories 5 and 7",
    first: 4000,
    second: 3000,
  },
  {
    title: "Best School Project",
    categories: "School project or poster",
    first: 5000,
    second: 3000,
  },
];

export const departmentPrizes = [
  { categories: "Categories 1, 2, 3, 4, 6 and 8", first: 2000 },
  { categories: "Categories 5 and 7", first: 1000 },
];

export const departments = [
  "CSE",
  "CS",
  "IT",
  "CSIT",
  "CSE(AI)",
  "CSE(AIML)",
  "CSE(DS)",
  "CSE(CS)",
  "EN",
  "EC",
  "ELCE",
  "ME",
  "VLSI",
  "AM",
  "MCA",
  "KSOM",
  "KSOP",
];

type Criterion = { title: string; parts?: string[] };

export const rubrics: Record<
  RubricGroup,
  { label: string; appliesTo: string; criteria: Criterion[] }
> = {
  software: {
    label: "Software",
    appliesTo: "Categories 1 and 2",
    criteria: [
      { title: "Project Showcasing", parts: ["Team Presentation Skills", "Project Understanding"] },
      { title: "Innovation & Novelty", parts: ["Originality of Project", "Employed Technology & AI Tools"] },
      { title: "Relevance & Application", parts: ["Significance for Society", "Practical Application to the Problem"] },
      { title: "Usability & Scalability", parts: ["Ease of Use", "Potential to Scale"] },
      { title: "Query Addressing" },
    ],
  },
  hardware: {
    label: "Hardware",
    appliesTo: "Categories 3 and 4",
    criteria: [
      { title: "Design & Build Quality", parts: ["Neatness & Safety", "Robustness of Hardware"] },
      { title: "Working Model", parts: ["Originality of Approach", "Novel Hardware Integration"] },
      { title: "Technology & AI Integration", parts: ["Sensors, IoT, Robotics Usage", "AI/Automation Potential"] },
      { title: "Future Scope & Impact", parts: ["Scalability / Commercial Feasibility", "Societal / Environmental Relevance"] },
      { title: "Query Addressing" },
    ],
  },
  startup: {
    label: "Start-up",
    appliesTo: "Category 5",
    criteria: [
      { title: "Uniqueness of Idea", parts: ["Novelty of Concept", "Differentiation from Existing Solutions"] },
      { title: "Market Feasibility", parts: ["Business Model Strength", "Target Audience Fit"] },
      { title: "Revenue & Sustainability", parts: ["Potential to Generate Profit", "Long-Term Sustainability"] },
      { title: "Societal / Economic Relevance", parts: ["Contribution to Society", "Contribution to Economy"] },
      { title: "Query Addressing" },
    ],
  },
  genz: {
    label: "Gen Z",
    appliesTo: "Category 6",
    criteria: [
      { title: "Concept & Originality", parts: ["Originality of Idea", "Understanding of the Problem"] },
      { title: "Working Prototype", parts: ["Functionality of Prototype", "Effort & Build Quality"] },
      { title: "Impact Value", parts: ["Relevance to Society / SDGs", "Potential to Inspire Change"] },
      { title: "Presentation & Teamwork", parts: ["Clarity of Explanation", "Team Coordination"] },
      { title: "Query Addressing" },
    ],
  },
  poster: {
    label: "Poster & Models",
    appliesTo: "Category 7",
    criteria: [
      { title: "Concept Innovation", parts: ["Originality of Idea", "Artistic Appeal & Creativity"] },
      { title: "Impact Value", parts: ["Relevance to Society / SDGs", "Potential to Inspire Change"] },
      { title: "Message Clarity", parts: ["Easy to Understand", "Logical Flow"] },
      { title: "Visual Design", parts: ["Neatness & Balance", "Artistic Appeal"] },
      { title: "Query Addressing" },
    ],
  },
  cybershield: {
    label: "CyberShield",
    appliesTo: "Category 8",
    criteria: [
      { title: "Threat Understanding", parts: ["Clarity of Threat Model", "Real-world Relevance"] },
      { title: "Security Design & Innovation", parts: ["Originality of Approach", "Use of Security Techniques & Tools"] },
      { title: "Implementation & Demo", parts: ["Working Demo", "Robustness Against Attacks"] },
      { title: "Impact & Compliance", parts: ["Societal / Organisational Impact", "Privacy, Ethical & Legal Compliance"] },
      { title: "Query Addressing" },
    ],
  },
};

export const teamRules = [
  "A team has 2 to 5 members.",
  "All members must be from the same college or school.",
  "KIET teams can have members from different courses and branches. The team belongs to the leader's department.",
  "A team can register for only one category.",
  "A student can be part of only one team.",
  "Once a team is submitted, members and category cannot be changed.",
  "If any member withdraws, the team is not considered further.",
  "KIET students must register with their official @kiet.edu email.",
  "There is no registration fee. No reimbursement is given for project materials.",
];

export const registrationSteps = [
  { title: "Create your account", text: "Every student registers individually and completes their profile." },
  { title: "Form a team", text: "The team leader creates a team and picks one category." },
  { title: "Add members", text: "The leader invites registered students from the same college or school." },
  { title: "Submit the team", text: "Once 2 to 5 members have joined, the leader submits and the team is locked." },
];

export const selectionNotes = [
  "One team per category is nominated from each department for the finale.",
  "CSE, CS, CSE(AI) and CSE(AIML) can nominate two teams each in Categories 1 to 4.",
  "Department level evaluation is done by faculty members of another department.",
  "Ties are broken by the Innovation / Originality score, then Query Addressing, then the panel chair's decision.",
];

export const attractions = [
  { icon: "rocket", title: "TBI Support", text: "Funding discussions and start-up registration guidance." },
  { icon: "building", title: "Registered Start-ups", text: "Start-ups from KIET TBI showcase and promote their products." },
  { icon: "cpu", title: "Centres of Excellence", text: "Projects and ideas from KIET's Centres of Excellence." },
  { icon: "code", title: "Technical Clubs", text: "Live projects from the technical clubs of the institute." },
  { icon: "shield", title: "CyberShield Zone", text: "Live security demos, a cyber-awareness corner and a mini CTF challenge." },
  { icon: "vote", title: "People's Choice Award", text: "Visitors vote for their favourite project by scanning a QR code." },
] as const;

export const gallery = [
  { src: "/images/kiet/campus-walkway.jpg", alt: "Covered walkway through the KIET campus gardens", wide: true },
  { src: "/images/kiet/infra-2.webp", alt: "KIET academic block surrounded by trees" },
  { src: "/images/kiet/ai-skills-lab.jpg", alt: "Students working in the AI Skills Lab", wide: true },
  { src: "/images/kiet/auditorium.webp", alt: "Students attending an event in the KIET auditorium" },
  { src: "/images/kiet/library.jpg", alt: "Students studying in the KIET library" },
  { src: "/images/kiet/infra-3.webp", alt: "Aerial view of the lawns between KIET buildings" },
  { src: "/images/kiet/seminar-hall.webp", alt: "Seminar in progress at the KIET CRPC hall" },
  { src: "/images/kiet/infra-1.jpg", alt: "Palm-lined courtyard on the KIET campus", wide: true },
  { src: "/images/kiet/sports.webp", alt: "Students playing cricket on the KIET ground" },
];

export const faqs = [
  {
    question: "Who can participate in InnoTech'26?",
    answer:
      "Students of KIET, students of other colleges, and school students. KIET and other college teams can choose any of the eight categories. School teams participate in the two poster categories (5 and 7).",
  },
  {
    question: "Is there a registration fee?",
    answer: "No. Registration is free for everyone.",
  },
  {
    question: "How many members can a team have?",
    answer:
      "A team has 2 to 5 members, and all members must be from the same college or school.",
  },
  {
    question: "Which email should I use to register?",
    answer:
      "KIET students must use their official @kiet.edu email. Students from other colleges and schools can use any valid email address.",
  },
  {
    question: "How do I form a team?",
    answer:
      "Every member first registers individually. The team leader then creates the team, chooses a category, adds the registered members and submits the team.",
  },
  {
    question: "Can I change my team or category after submitting?",
    answer:
      "No. Once a team is submitted, members and category cannot be changed. If any member withdraws, the team is not considered further.",
  },
  {
    question: "Do students from other colleges and schools go through the department round?",
    answer:
      "No. Teams from other colleges and schools go directly to the institute level Grand Finale on 30 October 2026.",
  },
  {
    question: "How are KIET finalists selected?",
    answer:
      "Each department nominates one team per category after the department level evaluation. CSE, CS, CSE(AI) and CSE(AIML) can nominate two teams in Categories 1 to 4.",
  },
  {
    question: "Will I be reimbursed for project materials?",
    answer:
      "No reimbursement is given for any items used in projects, posters or models.",
  },
];

export const coreTeam = [
  { name: "Dr. Pavi Saraswat", role: "Planning and Implementation Head" },
  { name: "Dr. Kamal Kant Sharma", role: "Evaluation & Jury Head" },
  { name: "Ms. Anjali Jain", role: "Media and Promotion Head" },
  { name: "Mr. Sagar Uniyal", role: "Website Coordinator" },
  { name: "Ms. Anupriya Pal", role: "Designing Manager" },
  { name: "Ms. Arushi Singh", role: "Technical Club Activity Coordinator" },
];
