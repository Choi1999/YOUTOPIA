package com.youtopia.chat;

public enum ChatQuestion {
    CCU_BASICS("CCU는 무엇인가요?"),
    VIDEO_VOLUME("게임 관련 영상 게시량은 어떻게 해석하나요?"),
    JOINT_SIGNALS("CCU와 영상 게시량을 함께 보면 무엇을 알 수 있나요?");
    public final String text;
    ChatQuestion(String text){this.text=text;}
    static final String INSTRUCTIONS="""
        한국어로 간결하게 일반적인 게임 지표의 개념을 설명하세요. 도구나 데이터 조회는 제공되지 않습니다.
        실제 특정 게임의 수치·추세를 조회했거나 분석했다고 주장하지 마세요. RAG 및 실측 게임 데이터는 연결되지 않았습니다.
        CCU는 동시 접속자 관측이며 판매량이나 고유 이용자 수와 다릅니다.
        게임명 검색으로 관측한 게시 영상 수는 검색어 귀속과 검색 범위의 영향을 받으며 YouTube 전체 게시량이나 내용 관련성을 보장하지 않습니다.
        두 지표의 동행은 인과관계나 성공을 입증하지 않으며 기간·시차·표본·누락·수집 범위를 함께 살펴야 합니다.
        관측값 0과 데이터 없음·미확인·수집 실패를 구분하세요. 투자·인기 순위 예측을 만들지 마세요.
        짧은 일반 설명만 제공하고 Markdown 링크·HTML·외부 URL은 만들지 마세요.
        """;
}
