import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe,expect,it,vi} from "vitest";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";
import {WorkspaceChannelReadinessReview} from "./WorkspaceChannelReadinessReview";

function registered(...urls:string[]) {
  return addWorkspaceUrlTargets([],urls.join("\n"),1_000).targets;
}
describe("UI-R04-H — evidence review panel",()=>{
  it("shows blocked evidence status without exposing a grant or changing gates",async()=>{
    const user=userEvent.setup();
    const fetchSpy=vi.fn(async()=>{throw Error("Unexpected fetch");});
    vi.stubGlobal("fetch",fetchSpy);
    try {
      render(<WorkspaceChannelReadinessReview targets={registered(
        "https://youtube.com/@SomeCreator",
      )}/>);
      const review=screen.getByRole("region",{name:"채널 실조회 준비 상태"});
      expect(within(review).getByText("BLOCKED")).toBeInTheDocument();
      expect(within(review).getByText("0/8")).toBeInTheDocument();
      expect(within(review).getByText("POLICY_HOLD")).toBeInTheDocument();
      expect(within(review).getByText(/Google Cloud 계정·API 키/)).toBeInTheDocument();
      expect(within(review).queryByRole("button",{name:/승인|실행|발송/})).toBeNull();
      await user.click(within(review).getByRole("button",{name:"실조회 전 필수 증빙 8항목 보기"}));
      const list=within(review).getByRole("list",{name:"실조회 전 필수 증빙"});
      expect(within(list).getAllByRole("listitem")).toHaveLength(8);
      expect(within(review).getByText(/@somecreator/)).toBeInTheDocument();
      expect(within(review).getByText(/미지정 · 미승인/)).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not invent a first-call candidate when there are no channels",async()=>{
    render(<WorkspaceChannelReadinessReview targets={registered(
      "https://youtu.be/Ab0_-123xyz",
    )}/>);
    await userEvent.setup().click(screen.getByRole("button",{name:"실조회 전 필수 증빙 8항목 보기"}));
    expect(screen.getByText(/등록된 유효한 채널 조회 후보가 없습니다/)).toBeInTheDocument();
  });
});
