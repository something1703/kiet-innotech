import type { CertificateType } from "./types";

/** What the file is called when it is saved. */
export const certificateFileNames: Record<CertificateType, string> = {
  dept_judge: "InnoTech26-Judge-Certificate.pdf",
  dept_participation: "InnoTech26-Participation-Certificate.pdf",
  dept_winner: "InnoTech26-Winner-Certificate.pdf",
  institute_judge: "InnoTech26-Institute-Judge-Certificate.pdf",
  institute_participation: "InnoTech26-Institute-Participation-Certificate.pdf",
  institute_winner: "InnoTech26-Institute-Winner-Certificate.pdf",
};

export const certificateLabels: Record<CertificateType, string> = {
  dept_judge: "Department judge",
  dept_participation: "Department participation",
  dept_winner: "Department winner",
  institute_judge: "Institute judge",
  institute_participation: "Institute participation",
  institute_winner: "Institute winner",
};
