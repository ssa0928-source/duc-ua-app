export function generateSettingRequest(hypothesis) {
  const rawId = hypothesis.id.replace('-', '') // H-03 → H03
  return `[DUC UA TF → 마케팅팀 세팅 요청서]

가설 ID: ${hypothesis.id}
가설명: ${hypothesis.title}

■ 소재 정보
- 소재명 형식: DUC_{날짜}_${rawId}_{소재컨셉}_UA_...

■ 세팅 요청사항
- 예산 배분: ABO (광고 세트별 동일 예산) 요청
- 타겟: 동일 타겟 적용
- 집행 기간: 최소 7일 이상
- 학습 완료 후 데이터 공유 요청

■ 확인 요청사항
- 광고 세트 구조
- 머신러닝 학습 완료 시점`
}
