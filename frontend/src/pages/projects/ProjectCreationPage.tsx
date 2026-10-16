import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { getRoute } from "../../app/routeDefinitions";
import {
  DEMO_COMPARISON_WINDOWS,
  DEMO_VIDEOS,
  EMPTY_PROJECT_DRAFT,
  NEXUS_DEMO_DRAFT,
  useProjectDemo,
  validateProjectDraft,
  type ProjectDraft,
  type ProjectDraftErrors,
} from "../../features/project-demo/ProjectDemoProvider";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";

const cloneDraft = (draft: ProjectDraft): ProjectDraft => ({
  ...draft,
  selectedVideoIds: [...draft.selectedVideoIds],
});

function FieldError({ children, id }: { children?: string; id: string }) {
  return children ? <p className="field-error" id={id}>{children}</p> : null;
}

export function ProjectCreationPage() {
  const navigate = useNavigate();
  const { createProject, resetDemo } = useProjectDemo();
  const [draft, setDraft] = useState<ProjectDraft>(() => cloneDraft(NEXUS_DEMO_DRAFT));
  const [errors, setErrors] = useState<ProjectDraftErrors>({});
  const [announcement, setAnnouncement] = useState("NEXUS 시즌2 데모 fixture가 입력되어 있습니다.");
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  function updateField<K extends keyof Omit<ProjectDraft, "selectedVideoIds">>(
    key: K,
    value: ProjectDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, observationPeriod: undefined }));
  }

  function updateVideo(slot: number, value: string) {
    setDraft((current) => {
      const selectedVideoIds = [...current.selectedVideoIds];
      selectedVideoIds[slot] = value;
      return { ...current, selectedVideoIds };
    });
    setErrors((current) => ({ ...current, selectedVideos: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateProjectDraft(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setAnnouncement("프로젝트를 만들 수 없습니다. 표시된 입력 오류를 확인해 주세요.");
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    const projectId = createProject(draft);
    setAnnouncement("인메모리 데모 프로젝트를 만들고 수집 대기 상태로 이동합니다.");
    navigate(getRoute("YU-05").href.replace(":projectId", projectId));
  }

  function clearForm() {
    setDraft(cloneDraft(EMPTY_PROJECT_DRAFT));
    setErrors({});
    setAnnouncement("양식을 비웠습니다. 아직 저장된 프로젝트는 없습니다.");
  }

  function cancelCreation() {
    resetDemo();
    setDraft(cloneDraft(NEXUS_DEMO_DRAFT));
    setErrors({});
    setAnnouncement("프로젝트 생성을 취소했습니다. 서버에 저장된 내용은 없습니다.");
  }

  const selectedCount = draft.selectedVideoIds.filter(Boolean).length;

  return (
    <ProductScreenFrame title="관측 프로젝트 생성">
      <div aria-live="polite" className="sr-only" role="status">{announcement}</div>

      {Object.keys(errors).length > 0 && (
        <div className="form-error-summary" ref={errorSummaryRef} role="alert" tabIndex={-1}>
          <strong>입력 내용을 확인해 주세요.</strong>
          <span>{Object.keys(errors).length}개 항목에 수정이 필요합니다.</span>
        </div>
      )}

      <div className="project-create-layout">
        <form className="project-form-card" noValidate onSubmit={handleSubmit}>
          <div className="section-heading-row">
            <div>
              <span className="simulation-pill">DEMO / IN-MEMORY</span>
              <h2>프로젝트 기본 정보</h2>
            </div>
            <button className="text-action" onClick={clearForm} type="button">양식 비우기</button>
          </div>

          <div className="project-field-grid">
            <label className="project-field project-field-wide">
              <span>프로젝트 이름 <b aria-hidden="true">*</b></span>
              <input
                aria-label="프로젝트 이름"
                aria-describedby={errors.projectName ? "project-name-error" : undefined}
                aria-invalid={Boolean(errors.projectName)}
                onChange={(event) => updateField("projectName", event.target.value)}
                value={draft.projectName}
              />
              <FieldError id="project-name-error">{errors.projectName}</FieldError>
            </label>

            <label className="project-field">
              <span>대상 게임 <b aria-hidden="true">*</b></span>
              <input
                aria-label="대상 게임"
                aria-describedby={errors.game ? "game-error" : undefined}
                aria-invalid={Boolean(errors.game)}
                onChange={(event) => updateField("game", event.target.value)}
                value={draft.game}
              />
              <FieldError id="game-error">{errors.game}</FieldError>
            </label>

            <label className="project-field">
              <span>사건 / 업데이트 <b aria-hidden="true">*</b></span>
              <input
                aria-label="사건 / 업데이트"
                aria-describedby={errors.eventName ? "event-name-error" : undefined}
                aria-invalid={Boolean(errors.eventName)}
                onChange={(event) => updateField("eventName", event.target.value)}
                value={draft.eventName}
              />
              <FieldError id="event-name-error">{errors.eventName}</FieldError>
            </label>

            <label className="project-field">
              <span>사건 날짜 <b aria-hidden="true">*</b></span>
              <input
                aria-label="사건 날짜"
                aria-describedby={errors.eventDate ? "event-date-error" : undefined}
                aria-invalid={Boolean(errors.eventDate)}
                onChange={(event) => updateField("eventDate", event.target.value)}
                type="date"
                value={draft.eventDate}
              />
              <FieldError id="event-date-error">{errors.eventDate}</FieldError>
            </label>

            <fieldset className="project-field observation-period">
              <legend>관측 기간 <b aria-hidden="true">*</b></legend>
              <div className="date-range">
                <label>
                  <span className="sr-only">관측 시작일</span>
                  <input
                    aria-label="관측 시작일"
                    aria-invalid={Boolean(errors.observationPeriod)}
                    onChange={(event) => updateField("observationStart", event.target.value)}
                    type="date"
                    value={draft.observationStart}
                  />
                </label>
                <span aria-hidden="true">~</span>
                <label>
                  <span className="sr-only">관측 종료일</span>
                  <input
                    aria-label="관측 종료일"
                    aria-invalid={Boolean(errors.observationPeriod)}
                    onChange={(event) => updateField("observationEnd", event.target.value)}
                    type="date"
                    value={draft.observationEnd}
                  />
                </label>
              </div>
              <FieldError id="observation-period-error">{errors.observationPeriod}</FieldError>
              <p className="field-hint">
                비교 기준: 사건 전 {DEMO_COMPARISON_WINDOWS.before.start}~{DEMO_COMPARISON_WINDOWS.before.end} · 사건 후 {DEMO_COMPARISON_WINDOWS.after.start}~{DEMO_COMPARISON_WINDOWS.after.end}
              </p>
            </fieldset>

            <label className="project-field project-field-wide">
              <span>분석 목적 <b aria-hidden="true">*</b></span>
              <textarea
                aria-label="분석 목적"
                aria-describedby={errors.analysisPurpose ? "purpose-error" : undefined}
                aria-invalid={Boolean(errors.analysisPurpose)}
                onChange={(event) => updateField("analysisPurpose", event.target.value)}
                rows={3}
                value={draft.analysisPurpose}
              />
              <FieldError id="purpose-error">{errors.analysisPurpose}</FieldError>
            </label>
          </div>

          <fieldset className="video-selection">
            <legend>선택 영상 <b aria-hidden="true">*</b></legend>
            <p>동일 영상 중복 없이 NEXUS 공식 채널의 데모 영상 3개를 선택합니다.</p>
            <div className="video-selection-list">
              {[0, 1, 2].map((slot) => (
                <label className="video-select-row" key={slot}>
                  <span>선택 영상 {slot + 1}</span>
                  <select
                    aria-label={`선택 영상 ${slot + 1}`}
                    aria-invalid={Boolean(errors.selectedVideos)}
                    onChange={(event) => updateVideo(slot, event.target.value)}
                    value={draft.selectedVideoIds[slot] ?? ""}
                  >
                    <option value="">영상을 선택해 주세요</option>
                    {DEMO_VIDEOS.map((video) => (
                      <option key={video.id} value={video.id}>
                        {video.title} · {video.publishedAt.slice(5).replace("-", ".")}
                      </option>
                    ))}
                  </select>
                  <span className="selected-badge">선택</span>
                </label>
              ))}
            </div>
            <FieldError id="selected-videos-error">{errors.selectedVideos}</FieldError>
          </fieldset>

          <div className="project-form-actions">
            <button className="secondary-action" onClick={cancelCreation} type="button">입력 취소</button>
            <button className="primary-action" type="submit">데이터 수집 시작 →</button>
          </div>
        </form>

        <aside className="project-summary-card" aria-label="프로젝트 요약">
          <span className="simulation-pill">SIMULATED DATA</span>
          <h2>수집 조건 요약</h2>
          <dl>
            <div><dt>YouTube 공식 채널</dt><dd>1개</dd></div>
            <div><dt>선택 영상</dt><dd>{selectedCount}개</dd></div>
            <div><dt>사건 기준</dt><dd>{draft.eventDate || "미입력"}</dd></div>
            <div><dt>저장 방식</dt><dd>메모리 전용</dd></div>
          </dl>
          <div className="comparison-window-note">
            <strong>동등 조건 검증 필요</strong>
            <p>전후 영상 수·게시 시점이 다르면 비교 가능 여부를 별도로 표시해야 합니다.</p>
          </div>
          <div className="authorization-policy-note">
            <strong>권한 정책 미확정</strong>
            <p>공개 데이터 관측 경로는 시뮬레이션 승인 없이 진행할 수 있습니다. 실제 OAuth 필요 여부는 이 화면에서 확정하지 않습니다.</p>
          </div>
        </aside>
      </div>
    </ProductScreenFrame>
  );
}
