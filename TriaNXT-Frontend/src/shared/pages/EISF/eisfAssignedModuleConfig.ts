import DOCUMENT_STATUS from "./Constants/documentStatus";

const statusCycle = [
  DOCUMENT_STATUS.APPROVED,
  DOCUMENT_STATUS.PENDING,
  DOCUMENT_STATUS.DRAFT,
];

function documents(category, names) {
  return names.map((documentName, index) => ({
    documentName,
    category,
    version: index === 0 ? "1.0" : `1.${index}`,
    status: statusCycle[index % statusCycle.length],
    uploadedBy: "Study Staff",
    approvedBy: index % statusCycle.length === 0 ? "Principal Investigator" : "-",
    modifiedDate: index % 2 === 0 ? "02-May-2026" : "15-Mar-2026",
    expiryDate: "-",
    fileName: `${documentName.replace(/[^a-z0-9]+/gi, "_")}.pdf`,
    fileSize: `${(0.8 + index * 0.3).toFixed(1)} MB`,
  }));
}

const EISF_ASSIGNED_MODULES = {
  participatingSiteTeam: {
    id: "1.0",
    title: "Participating Site Team",
    description: "Manage and maintain documents related to the participating site research team.",
    sections: [
      {
        id: "1.1",
        title: "Contact List",
        description: "Site Contact List (current and superseded) including Name, Role, Phone and Email for the PI, Sub-Is/AIs, SC, Research Nurse and other key team staff.",
        documents: documents("Contact List", [
          "Site Contact List - Current",
          "Site Contact List - Superseded",
        ]),
      },
      {
        id: "1.2",
        title: "Signature and Delegation of Duties Log",
        description: "Signature and Delegation of Duties Log completed and signed by all site staff assigned/involved with the study and signed and dated by the site Principal Investigator.",
        documents: documents("Delegation Log", [
          "Signature and Delegation of Duties Log",
        ]),
      },
      {
        id: "1.3",
        title: "CVs (Include Copies of Medical Licenses)",
        description: "Original Curriculum Vitae signed and dated within the last two years, along with copies of Medical Licenses where applicable.",
        documents: documents("CV", [
          "Investigator Short CV - PI",
          "Investigator Short CV - Sub-Investigator",
          "Medical License - PI",
        ]),
      },
      {
        id: "1.4",
        title: "GCP Training Certificates",
        description: "GCP training certificates from all staff listed in the delegation log. GCP training must be TransCelerate accredited and completed within the last three years.",
        documents: documents("Training", [
          "GCP Training Certificate - PI",
          "GCP Training Certificate - Study Coordinator",
        ]),
      },
      {
        id: "1.5",
        title: "EDC Training Certifications",
        description: "Copies of site staff EDC Training Certificates/Certifications and completed CRF Exercises/Knowledge Assessments, if applicable.",
        documents: documents("EDC Training", [
          "EDC Training Certificate",
          "CRF Knowledge Assessment",
        ]),
      },
      {
        id: "1.6",
        title: "Other Training Certificates",
        description: "Other training certificates from all site staff involved in the study.",
        documents: documents("Training", [
          "Other Training Certificate",
        ]),
      },
    ],
  },

  projectManagement: {
    id: "2.0",
    title: "Project Management",
    description: "Manage team communication, meeting minutes and significant correspondence relating to project management.",
    sections: [
      {
        id: "2.1",
        title: "Reserved - Sponsor-Investigator/CPI Maintained",
        description: "This section is deliberately left blank as it is maintained by the Sponsor-Investigator/CPI and not used by sites. This section should not contain any files.",
        documents: [],
      },
      {
        id: "2.2",
        title: "Team Communication",
        description: "Copies of meeting minutes, emails and all other significant correspondence relating to project management.",
        documents: documents("Communication", [
          "Team Meeting Minutes",
          "Project Management Email Correspondence",
          "Significant Correspondence",
        ]),
      },
    ],
  },

  protocol: {
    id: "3.0",
    title: "Protocol / Protocol Amendments",
    description: "Manage study protocols, amendments, non-compliance records, serious breaches and CAPAs.",
    sections: [
      {
        id: "3.1",
        title: "Site Protocol Version Tracker",
        description: "Site Protocol Version Tracker maintained by the Site Study Coordinator/Research Nurse to track approved protocol versions and subsequent amendments.",
        documents: documents("Version Tracker", [
          "Site Protocol Version Tracker",
        ]),
      },
      {
        id: "3.2",
        title: "Current HREC Approved Study Protocol signed by PI",
        description: "Current HREC/IRB and RGO approved and signed Final Protocol together with signed Protocol Signature Pages.",
        documents: documents("Protocol", [
          "Current Approved Study Protocol",
          "Signed Protocol Signature Page - PI",
          "Signed Protocol Signature Page - Sponsor",
        ]),
      },
      {
        id: "3.3",
        title: "Superseded Study Protocols signed by PI",
        description: "Superseded Protocol versions with signed Signature Pages. Ensure the first page is stamped 'Superseded' when filing.",
        documents: documents("Protocol", [
          "Superseded Study Protocol",
          "Superseded Signed Signature Page",
        ]),
      },
      {
        id: "3.4",
        title: "Local Site Non-Compliance Log",
        description: "Site-Specific Non-Compliance Log capturing deviations from GCP or the protocol.",
        documents: documents("Non-Compliance", [
          "Site Non-Compliance Log",
        ]),
      },
      {
        id: "3.5",
        title: "Non-Compliance Reports",
        description: "Non-Compliance Report Forms completed and signed by the Site Principal Investigator.",
        documents: documents("Non-Compliance", [
          "Non-Compliance Report Form",
        ]),
      },
      {
        id: "3.6",
        title: "Local Serious Breaches and CAPA Documents",
        description: "Site-specific CAPA plans, CAPA reviews and CAPA tracking log for serious breaches encountered at site.",
        documents: documents("CAPA", [
          "Site Corrective and Preventive Action Plan",
          "CAPA Plan Review",
          "Site CAPA Tracking Log",
        ]),
      },
      {
        id: "3.7",
        title: "Serious Breach Reports to Sponsor / RGO / Regulatory",
        description: "Copies of site-specific Serious Breach Reports and related correspondence submitted to Sponsor, local RGO or Regulatory Authorities.",
        documents: documents("Serious Breach", [
          "Serious Breach Report to Sponsor",
          "Serious Breach Report to RGO",
          "Serious Breach Correspondence",
        ]),
      },
      {
        id: "3.8",
        title: "Related Correspondence",
        description: "All significant correspondence relating to protocol development, protocol amendments, serious breaches and CAPAs.",
        documents: documents("Correspondence", [
          "Protocol Related Correspondence",
        ]),
      },
    ],
  },

  participantConsent: {
    id: "4.0",
    title: "Participant Information & Consent Forms",
    description: "Manage site-specific PGICF/PICF versions, translations, superseded copies and signed participant consent forms.",
    sections: [
      {
        id: "4.1",
        title: "Site-Specific PGICF & PICF Version Tracker",
        description: "Site-Specific PGICF & PICF Version Trackers to track version history and HREC/IRB, Regulatory and RGO approval dates.",
        documents: documents("Version Tracker", [
          "Site-Specific PICF Version Tracker",
          "Biobanking Consent PICF Tracker",
        ]),
      },
      {
        id: "4.2",
        title: "Site-Specific PGICF & PICFs - Current",
        description: "Current Site-Specific PGICF and/or PICF and any translations with translation certificates where applicable.",
        documents: documents("PICF", [
          "Current Site-Specific PICF",
          "Current Site-Specific PGICF",
          "PICF Translation",
          "Translation Certificate",
        ]),
      },
      {
        id: "4.3",
        title: "Other Approved Participant Information",
        description: "Site-specific authorised advertisements, participant diaries, telephone scripts, GP letters, templates, newsletters, cards and questionnaires.",
        documents: documents("Participant Info", [
          "Approved Advertisement",
          "Participant Diary",
          "Telephone Script",
          "GP Letter Template",
          "Participant Newsletter",
          "Quality of Life Questionnaire",
        ]),
      },
      {
        id: "4.4",
        title: "Site PGICF & PICFs - Superseded",
        description: "Superseded copies of Site-Specific PGICF & PICFs.",
        documents: documents("PICF", [
          "Superseded Site-Specific PICF",
          "Superseded Site-Specific PGICF",
        ]),
      },
      {
        id: "4.5",
        title: "Other Authorised Site-Specific Participant Information - Superseded",
        description: "Superseded copies of other authorised site-specific participant information (advertisements, diaries, scripts, GP letters, newsletters, cards, questionnaires).",
        documents: documents("Participant Info", [
          "Superseded Advertisement",
          "Superseded Participant Diary",
          "Superseded Questionnaire",
        ]),
      },
      {
        id: "4.6",
        title: "Signed PGICF & PICFs",
        description: "Signed and dated PGICF & PICFs. Best practice is to file these in the participant shadow files.",
        documents: documents("Signed Consent", [
          "Signed PICF",
          "Signed PGICF",
        ]),
      },
    ],
  },

  regulatory: {
    id: "5.0",
    title: "Regulatory",
    description: "Manage regulatory authorisations, supplementary regulatory forms and reserved sponsor-maintained sections.",
    sections: [
      {
        id: "5.1",
        title: "Regulatory Authorisation or Acknowledgement",
        description: "Current and superseded CTN/CTX and international regulatory authorisations from TGA, FDA IND, MHRA, Health Canada, MedSafe and related agencies.",
        documents: documents("Regulatory", [
          "CTN/CTX Authorisation - Current",
          "CTN/CTX Authorisation - Superseded",
          "FDA IND Authorisation",
          "MHRA Authorisation",
          "Regulatory Authority Correspondence",
        ]),
      },
      {
        id: "5.2",
        title: "Supplementary Documents",
        description: "Financial Disclosure Form (FDA 3454) and Statement of Investigator Form (FDA 1572) completed and signed by the Site PI, where applicable.",
        documents: documents("Regulatory Form", [
          "FDA 3454 Financial Disclosure Form",
          "FDA 1572 Statement of Investigator Form",
        ]),
      },
      {
        id: "5.3",
        title: "Reserved - Sponsor-Investigator/CPI Maintained",
        description: "This section is deliberately left blank as it is maintained by the Sponsor-Investigator/CPI and not used by sites. This section should not contain any files.",
        documents: [],
      },
    ],
  },

  ethics: {
    id: "6.0",
    title: "Ethics Committee / HREC / IRB / REB",
    description: "Manage ethics approval letters, submissions, committee composition, progress reports and related correspondence.",
    sections: [
      {
        id: "6.1",
        title: "Ethics Approval Letters",
        description: "EC/HREC/IRB/REB approval letters (current and superseded) for the original Protocol/PICF/IB and all subsequent amendments and project submissions.",
        documents: documents("Ethics Approval", [
          "Ethics Approval Letter - Current",
          "Ethics Approval Letter - Superseded",
          "Ethics Amendment Approval",
        ]),
      },
      {
        id: "6.2",
        title: "Ethics Submission Documents",
        description: "Initial and amendment ethics submissions including HREA responses, supporting documentation and additional project notifications.",
        documents: documents("Ethics Submission", [
          "Initial Ethics Application",
          "HREA Response Document",
          "Protocol Amendment Ethics Submission",
          "Additional Project Notification",
        ]),
      },
      {
        id: "6.3",
        title: "Ethics Committee Composition, Constitution & Statement of Compliance",
        description: "EC/HREC/IRB/REB committee constitution, composition and statement of compliance evidence documents.",
        documents: documents("Ethics Compliance", [
          "Ethics Committee Constitution",
          "Statement of Compliance",
        ]),
      },
      {
        id: "6.4",
        title: "Interim / Annual / Final Reports to Ethics Committee",
        description: "Evidence of submission and acknowledgment of receipt of Annual and Final Progress Reports submitted to EC/HREC/IRB/REB committees.",
        documents: documents("Ethics Report", [
          "Annual Progress Report - Ethics",
          "Annual Progress Report Acknowledgement",
          "Final Progress Report - Ethics",
          "Final Progress Report Acknowledgement",
        ]),
      },
      {
        id: "6.5",
        title: "Related Correspondence",
        description: "All significant correspondence to and from the EC/HREC/IRB/REB committee regarding initial and subsequent submissions.",
        documents: documents("Correspondence", [
          "Ethics Related Correspondence",
        ]),
      },
    ],
  },

  researchGovernance: {
    id: "7.0",
    title: "Research Governance Office (RGO)",
    description: "Manage RGO authorisation letters, submissions, progress reports and related correspondence.",
    sections: [
      {
        id: "7.1",
        title: "Governance Authorisation Letters",
        description: "Local Research Governance Office (RGO) approval/authorisation letters - current and superseded.",
        documents: documents("RGO Approval", [
          "RGO Authorisation Letter - Current",
          "RGO Authorisation Letter - Superseded",
        ]),
      },
      {
        id: "7.2",
        title: "RGO Submission Documentation",
        description: "Local RGO submissions and application documents including responses to local RGO questions/queries.",
        documents: documents("RGO Submission", [
          "Initial RGO Submission",
          "RGO Amendment Submission",
          "RGO Query Response",
        ]),
      },
      {
        id: "7.3",
        title: "Annual Project Progress Reports & Final Project Report",
        description: "Evidence of submission and acknowledgement of receipt of Annual Progress Reports and Final Project Report to the local RGO.",
        documents: documents("RGO Report", [
          "Annual Progress Report - RGO",
          "Annual Progress Report Acknowledgement - RGO",
          "Final Project Report - RGO",
          "Final Project Report Acknowledgement - RGO",
        ]),
      },
      {
        id: "7.4",
        title: "Related Correspondence",
        description: "All significant correspondence to and from the RGO regarding initial and subsequent submissions.",
        documents: documents("Correspondence", [
          "RGO Related Correspondence",
        ]),
      },
    ],
  },

  sop: {
    id: "8.0",
    title: "Study-Specific Procedures / SOPs",
    description: "Manage site-level manuals of procedures and trial-related standard operating procedures.",
    sections: [
      {
        id: "8.1",
        title: "Site-Level Manual of Procedures / Trial-Related SOPs - Current",
        description: "Site-Specific Manual of Procedures Document and site-specific trial-related SOPs - current version.",
        documents: documents("SOP", [
          "Site Manual of Procedures - Current",
          "Site-Specific Trial SOP - Current",
        ]),
      },
      {
        id: "8.2",
        title: "Site-Level Manual of Procedures / Trial-Related SOPs - Superseded",
        description: "Site-Specific Manual of Procedures Document and site-specific trial-related SOPs - superseded versions. Ensure the first page is stamped 'Superseded' when filing.",
        documents: documents("SOP", [
          "Site Manual of Procedures - Superseded",
          "Site-Specific Trial SOP - Superseded",
        ]),
      },
    ],
  },

  siteInitiation: {
    id: "9.0",
    title: "Site Initiation",
    description: "Manage site initiation meeting documentation, follow-up letters and site activation notifications.",
    sections: [
      {
        id: "9.1",
        title: "Site Initiation Meeting Documentation",
        description: "Essential Documents Request Letter, Site Initiation Booking Confirmation, Agenda, Presentation and Attendance Log for the Site Initiation Meeting.",
        documents: documents("Site Initiation", [
          "Essential Documents Request Letter",
          "Site Initiation Booking Confirmation Letter",
          "Site Initiation Agenda",
          "Site Initiation Presentation",
          "Site Initiation Attendance Log",
        ]),
      },
      {
        id: "9.2",
        title: "Site Initiation Follow Up Letter",
        description: "Site Initiation Follow-Up Letter to Site.",
        documents: documents("Site Initiation", [
          "Site Initiation Follow-Up Letter",
        ]),
      },
      {
        id: "9.3",
        title: "Site Activation Documentation / Letter",
        description: "Official Notification of Site Activation Letter.",
        documents: documents("Site Activation", [
          "Site Activation Notification Letter",
        ]),
      },
    ],
  },

  siteTraining: {
    id: "10.0",
    title: "Site Training",
    description: "Manage investigator meetings, presentations, training logs and other training resources.",
    sections: [
      {
        id: "10.1",
        title: "Investigator Meetings",
        description: "Investigator Meeting presentation slide set and Investigator Meeting Attendance Log signed by all attendees.",
        documents: documents("Investigator Meeting", [
          "Investigator Meeting Presentation",
          "Investigator Meeting Attendance Log",
        ]),
      },
      {
        id: "10.2",
        title: "Other Presentations",
        description: "Presentations other than the site-specific Site Initiation Visit presentation - for example, site re-training or study database training.",
        documents: documents("Training Presentation", [
          "Site Re-Training Presentation",
          "Study Database Training Presentation",
        ]),
      },
      {
        id: "10.3",
        title: "Site-Specific Training Log",
        description: "Site Staff Training Logs (individual and study team) and other training attestation forms completed and signed by site personnel.",
        documents: documents("Training Log", [
          "Individual Site Staff Training Log",
          "Study Team Training Log",
          "Training Attestation Form",
        ]),
      },
      {
        id: "10.4",
        title: "Other Training Resources",
        description: "Copies of other site-specific training resources/materials provided by the Sponsor.",
        documents: documents("Training Resource", [
          "Sponsor-Provided Training Material",
        ]),
      },
    ],
  },

  recruitment: {
    id: "11.0",
    title: "Participant Recruitment",
    description: "Manage participant recruitment records including pre-screening, screening, enrolment and participant ID logs.",
    sections: [
      {
        id: "11.1",
        title: "Pre-Screening Log",
        description: "Site-Specific Pre-Screening Log - current and superseded.",
        documents: documents("Recruitment Log", [
          "Site Pre-Screening Log - Current",
          "Site Pre-Screening Log - Superseded",
        ]),
      },
      {
        id: "11.2",
        title: "Consent, Screening & Enrolment Log",
        description: "Site-Specific Consent, Screening & Enrolment Log - current and superseded.",
        documents: documents("Recruitment Log", [
          "Consent, Screening & Enrolment Log - Current",
          "Consent, Screening & Enrolment Log - Superseded",
        ]),
      },
      {
        id: "11.3",
        title: "Participant ID Log",
        description: "Site-Specific Participant Registration Log - current and superseded.",
        documents: documents("Recruitment Log", [
          "Participant Registration Log - Current",
          "Participant Registration Log - Superseded",
        ]),
      },
      {
        id: "11.4",
        title: "Related Correspondence",
        description: "All significant correspondence relating to participant recruitment.",
        documents: documents("Correspondence", [
          "Participant Recruitment Correspondence",
        ]),
      },
    ],
  },

  randomization: {
    id: "12.0",
    title: "Participant Randomisation / Registration Procedures",
    description: "Manage randomisation, registration, unblinding and related correspondence documents.",
    sections: [
      {
        id: "12.1",
        title: "Randomisation / Registration User Manual",
        description: "Copy of trial-specific participant randomisation or registration user manual, current and superseded.",
        documents: documents("Randomisation", [
          "Randomisation / Registration User Manual - Current",
          "Randomisation / Registration User Manual - Superseded",
        ]),
      },
      {
        id: "12.2",
        title: "Records of Unblinding - Local Participants",
        description: "Copies of local participant unblinding records and reasons for unblinding during study conduct.",
        documents: documents("Unblinding", [
          "Local Participant Unblinding Record",
          "Unblinding Reason Documentation",
        ]),
      },
      {
        id: "12.3",
        title: "Related Correspondence",
        description: "Significant correspondence relating to participant randomisation and unblinding procedures to and from the Sponsor.",
        documents: documents("Correspondence", [
          "Randomisation Correspondence with Sponsor",
          "Unblinding Procedure Correspondence",
        ]),
      },
    ],
  },

  dataManagement: {
    id: "13.0",
    title: "Data Management - Forms & Procedures",
    description: "Manage CRFs, EDC account forms, source document plans and data-management correspondence.",
    sections: [
      {
        id: "13.1",
        title: "Blank Paper CRF - Current and Superseded",
        description: "Paper CRF files for printing, current and superseded. Completed CRFs are part of the ISF but filed separately.",
        documents: documents("CRF", ["Blank Paper CRF - Current", "Blank Paper CRF - Superseded"]),
      },
      {
        id: "13.2",
        title: "CRF Completion Guidelines",
        description: "CRF completion guidelines, current and superseded versions.",
        documents: documents("Guideline", ["CRF Completion Guidelines - Current", "CRF Completion Guidelines - Superseded"]),
      },
      {
        id: "13.3",
        title: "Completed EDC System Account Application Forms",
        description: "Completed and signed EDC account application forms for applicable study team members.",
        documents: documents("EDC", ["EDC System Account Application Form - PI", "EDC System Account Application Form - Study Coordinator"]),
      },
      {
        id: "13.4",
        title: "Source Document Plan - Current and Superseded",
        description: "Site-specific Source Document Plan completed, signed and dated by the Site Principal Investigator.",
        documents: documents("Source Document", ["Source Document Plan - Current", "Source Document Plan - Superseded"]),
      },
      {
        id: "13.5",
        title: "Related Correspondence",
        description: "Significant correspondence relating to data management to and from the Sponsor.",
        documents: documents("Correspondence", ["Data Management Correspondence"]),
      },
    ],
  },

  safety: {
    id: "14.0",
    title: "Safety Monitoring & Reporting",
    description: "Manage safety report forms, reference safety information, completed safety reports and correspondence.",
    sections: [
      {
        id: "14.1",
        title: "Blank Expedited Safety Report Forms",
        description: "Blank SAE forms, cover sheets, completion instructions and pregnancy-reporting forms where applicable.",
        documents: documents("Safety Form", ["Blank Expedited Safety Report Form", "SAE Report Cover Sheet", "SAE Completion Instructions", "Expedited Pregnancy Report Form"]),
      },
      {
        id: "14.2",
        title: "Reference Safety Information",
        description: "Reference safety information including Investigator Brochure, Product Information and IB version tracker.",
        documents: documents("Reference Safety", ["Reference Safety Information - Current", "Reference Safety Information - Superseded", "IB Version Tracker"]),
      },
      {
        id: "14.3",
        title: "Completed Expedited Safety Report Forms and Correspondence",
        description: "Completed initial and follow-up SAE reports signed by the Site Principal Investigator and sent to Sponsor.",
        documents: documents("Safety Report", ["Completed Initial SAE Report", "Completed Follow-up SAE Report", "SAE Correspondence to Sponsor"]),
      },
      {
        id: "14.4",
        title: "Safety Reports to RGO or Regulatory Authority",
        description: "Site-specific safety reports and related correspondence submitted to local RGO or Regulatory Authorities.",
        documents: documents("Regulatory Safety", ["Safety Notification to RGO", "Regulatory Authority Safety Correspondence"]),
      },
      {
        id: "14.5",
        title: "On-Site Procedure for Unblinding",
        description: "Site-specific emergency unblinding procedures for medical emergency or safety-reporting purposes.",
        documents: documents("Unblinding", ["Emergency Unblinding Manual - Current", "Emergency Unblinding Manual - Superseded"]),
      },
      {
        id: "14.6",
        title: "Related Correspondence",
        description: "Dear Investigator Letters, safety memos, safety notifications, SUSAR listings and other safety correspondence.",
        documents: documents("Correspondence", ["Dear Investigator Letter", "Safety Memo", "SUSAR Line Listing", "Safety Monitoring Correspondence"]),
      },
    ],
  },

  monitoring: {
    id: "15.0",
    title: "Study Quality Assurance, Monitoring, Audits & Inspections",
    description: "Manage site monitoring logs, monitoring visit correspondence, close-out, audit and inspection documentation.",
    sections: [
      {
        id: "15.1",
        title: "Reserved - Sponsor/CPI Maintained",
        description: "This section is deliberately left blank and should not contain site files.",
        documents: [],
      },
      {
        id: "15.2",
        title: "Site Monitoring Log",
        description: "Site-specific Site Monitoring and Visit Log recording site monitoring and audit visits.",
        documents: documents("Monitoring", ["Site Monitoring and Visit Log"]),
      },
      {
        id: "15.3",
        title: "Reserved - Sponsor/CPI Maintained",
        description: "This section is deliberately left blank and should not contain site files.",
        documents: [],
      },
      {
        id: "15.4",
        title: "Monitoring Visit Correspondence and Feedback",
        description: "Monitoring visit confirmation letters and monitoring visit follow-up letters.",
        documents: documents("Monitoring Correspondence", ["Monitoring Visit Confirmation Letter", "Monitoring Visit Follow Up Letter"]),
      },
      {
        id: "15.5",
        title: "Trial Close-Out",
        description: "Trial close-out report, close-out letter, archive agreement letter and close-out correspondence.",
        documents: documents("Close-Out", ["Trial Close-Out Report", "Trial Close-Out Letter", "Investigator Agreement to Archive Letter", "Close-Out Correspondence"]),
      },
      {
        id: "15.6",
        title: "Local Research Governance Audit Reports and Correspondence",
        description: "Audit reports and related correspondence for audits occurring at site.",
        documents: documents("Audit", ["Local Audit Report", "Audit Correspondence"]),
      },
      {
        id: "15.7",
        title: "Regulatory Inspections Reports and Correspondence",
        description: "Regulatory inspection reports and related inspection correspondence.",
        documents: documents("Inspection", ["Regulatory Inspection Report", "Regulatory Inspection Correspondence"]),
      },
    ],
  },

  laboratory: {
    id: "16.0",
    title: "Local Laboratory Documentation",
    description: "Manage laboratory manuals, accreditation certificates, reference ranges, biospecimen logs and lab correspondence.",
    sections: [
      { id: "16.1", title: "Research Sample Lab Manual", description: "Trial-specific Research Sample Lab Manual, current and superseded.", documents: documents("Laboratory", ["Research Sample Lab Manual - Current", "Research Sample Lab Manual - Superseded"]) },
      { id: "16.2", title: "Local Lab Certificates of Accreditation", description: "Local site laboratory accreditation certificate such as NATA or equivalent.", documents: documents("Accreditation", ["Local Lab Accreditation Certificate"]) },
      { id: "16.3", title: "Normal Local Lab Reference Ranges", description: "Local site laboratory reference ranges, current and superseded.", documents: documents("Reference Range", ["Local Lab Reference Ranges - Current", "Local Lab Reference Ranges - Superseded"]) },
      { id: "16.4", title: "Biospecimen Collection Log", description: "Biospecimen Collection Log updated as samples are collected, processed and stored.", documents: documents("Biospecimen", ["Biospecimen Collection Log - Current", "Biospecimen Collection Log - Superseded"]) },
      { id: "16.5", title: "Biospecimen Shipment Receipt Tracking", description: "Courier documents, invoices, receipts, declarations, consignment notes and import permits.", documents: documents("Shipment", ["Biospecimen Courier Shipping Document", "Biospecimen Shipment Receipt", "Biospecimen Import Permit"]) },
      { id: "16.6", title: "Biospecimen Storage Monitoring Documentation", description: "Site-specific biospecimen storage monitoring records such as freezer or liquid nitrogen logs.", documents: documents("Storage", ["Freezer Temperature Log", "Liquid Nitrogen Monitoring Log"]) },
      { id: "16.7", title: "Related Correspondence", description: "Significant correspondence relating to biospecimen research aspects of the study.", documents: documents("Correspondence", ["Laboratory Correspondence with Sponsor"]) },
    ],
  },

  supplies: {
    id: "17.0",
    title: "Supplies / Shipping Records",
    description: "Manage records for provision and receipt of study supplies excluding investigational product or devices.",
    sections: [
      {
        id: "17.1",
        title: "Documentation Relating to Provision of Study Supplies",
        description: "Correspondence, documentation and receipts for study supplies such as paper CRFs, diaries and blood collection tubes.",
        documents: documents("Supplies", ["Study Supplies Provision Correspondence", "Study Supplies Receipt", "Paper CRF Supply Record", "Blood Collection Tube Supply Record"]),
      },
    ],
  },

  legal: {
    id: "18.0",
    title: "Legal Documentation",
    description: "Manage clinical trial agreements, other agreements and related legal correspondence.",
    sections: [
      { id: "18.1", title: "Fully Executed Clinical Trial Agreement", description: "Clinical Trial Agreement with site, fully executed.", documents: documents("Agreement", ["Fully Executed Clinical Trial Agreement"]) },
      { id: "18.2", title: "Other Agreements", description: "Material Transfer Agreements, Data Sharing Agreements, Insurance/Indemnity and Expressions of Interest.", documents: documents("Agreement", ["Material Transfer Agreement", "Data Sharing Agreement", "Insurance / Indemnity", "Expression of Interest"]) },
      { id: "18.3", title: "Related Correspondence", description: "Significant correspondence relating to agreements pertaining to the study.", documents: documents("Correspondence", ["Legal Agreement Correspondence"]) },
    ],
  },

  finance: {
    id: "19.0",
    title: "Finance Documentation",
    description: "Manage invoices, receipts, budget correspondence and per-patient payment documentation.",
    sections: [
      { id: "19.1", title: "Invoices / Receipts", description: "Site-specific invoices and receipts including per-patient payment requests made to Sponsor.", documents: documents("Finance", ["Site Invoice", "Site Receipt", "Per Patient Payment Request"]) },
      { id: "19.2", title: "Related Correspondence", description: "Correspondence about study budget, invoice tracking and per-patient payments.", documents: documents("Correspondence", ["Budget Correspondence", "Invoice Tracking Correspondence", "Per Patient Payment Correspondence"]) },
    ],
  },

  otherCommunication: {
    id: "20.0",
    title: "Other Communication",
    description: "Manage newsletters from Sponsor-Investigator and other general sponsor correspondence.",
    sections: [
      { id: "20.1", title: "Newsletters from Sponsor-Investigator", description: "Newsletters received from the Sponsor to participating sites.", documents: documents("Newsletter", ["Sponsor Newsletter"]) },
      { id: "20.2", title: "Other General Correspondence", description: "Other significant general correspondence received from Sponsor.", documents: documents("Correspondence", ["General Sponsor Correspondence"]) },
    ],
  },

  archiving: {
    id: "21.0",
    title: "Archiving",
    description: "Manage archiving details and correspondence relating to trial archiving.",
    sections: [
      { id: "21.1", title: "Archiving Details", description: "Investigator Agreement to Archive Trial Documents Form completed and signed by Site Investigator and Sponsor.", documents: documents("Archiving", ["Investigator Agreement to Archive Trial Documents Form"]) },
      { id: "21.2", title: "Related Correspondence", description: "Significant correspondence regarding trial archiving to and from Sponsor.", documents: documents("Correspondence", ["Trial Archiving Correspondence"]) },
    ],
  },

  investigationalProduct: {
    id: "22.0",
    title: "Investigational Product (Drug / Device Trials Only)",
    description: "Manage pharmacy manuals, IP shipment, accountability, storage, returns, destruction and IP correspondence.",
    sections: [
      { id: "22.1", title: "Instructions for Handling IP and Trial Related Materials", description: "Pharmacy Manual and Drug Order Form, current and superseded.", documents: documents("IP Handling", ["Pharmacy Manual - Current", "Pharmacy Manual - Superseded", "Drug Order Form - Current", "Drug Order Form - Superseded"]) },
      { id: "22.2", title: "Documentation of IP Shipment", description: "Shipping records of investigational product to site, if applicable.", documents: documents("IP Shipment", ["IP Shipping Record", "Drug Receipt Record"]) },
      { id: "22.3", title: "Documentation of IP Dispensing, Accountability and Inventory", description: "Bulk and individual drug accountability logs, current and superseded.", documents: documents("IP Accountability", ["Bulk Drug Accountability Log - Current", "Individual Drug Accountability Log - Current", "Bulk Drug Accountability Log - Superseded", "Individual Drug Accountability Log - Superseded"]) },
      { id: "22.4", title: "Documentation of IP Storage Monitoring", description: "IP storage facility monitoring records such as freezer and fridge temperature logs.", documents: documents("IP Storage", ["Fridge Temperature Log", "Freezer Temperature Log", "IP Storage Maintenance Log"]) },
      { id: "22.5", title: "Documentation of IP Quarantine, Returns and Destruction", description: "IP deviation reports, quarantine records, company assessments, returns and drug destruction forms.", documents: documents("IP Disposition", ["IP Deviation Report", "IP Quarantine Record", "Drug Company Assessment", "IP Return Form", "Drug Destruction Form"]) },
      { id: "22.6", title: "Related Correspondence", description: "Significant correspondence relating to investigational product to and from Sponsor.", documents: documents("Correspondence", ["Investigational Product Correspondence"]) },
    ],
  },
};

export default EISF_ASSIGNED_MODULES;
