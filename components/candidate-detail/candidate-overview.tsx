import GeneralInformationCard from "@/components/candidate-detail/general-information-card";
import RecruitmentProgressCard from "@/components/candidate-detail/recruitment-progress-card";
import type {
  Candidate,
  UpdateCandidatePayload,
  UpdateCandidateStatusPayload,
} from "@/types/candidate";

// Overview tab body, shared by the drawer and the full page.
// "drawer" is the narrow side panel; "page" is the wide expanded view.
export default function CandidateOverview({
  candidate,
  layout,
  readOnly,
  onUpdateStatus,
  onUpdateInfo,
}: {
  candidate: Candidate;
  layout: "drawer" | "page";
  readOnly: boolean; // academy candidate: no Edit buttons
  onUpdateStatus: (payload: UpdateCandidateStatusPayload) => Promise<void>; // PATCH
  onUpdateInfo: (payload: UpdateCandidatePayload) => Promise<void>; // PUT
}) {
  return (
    <div className="space-y-5">
      <RecruitmentProgressCard
        candidate={candidate}
        layout={layout}
        readOnly={readOnly}
        onSave={onUpdateStatus}
      />
      <GeneralInformationCard
        candidate={candidate}
        layout={layout}
        readOnly={readOnly}
        onSave={onUpdateInfo}
      />
    </div>
  );
}
