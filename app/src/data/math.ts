// 수학 (공학의 기초 이론) 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const MATH_CATEGORIES: CategoryDef[] = [
  { id: "ma-linalg", name: "선형대수", emoji: "🧮" },
  { id: "ma-calc", name: "미적분·해석", emoji: "∫" },
  { id: "ma-prob", name: "확률·통계", emoji: "🎲" },
  { id: "ma-eng", name: "공업수학", emoji: "📐" },
];

export const MATH_RAW: Record<string, RawTopic[]> = {
  "ma-linalg": [
    ["행렬", "Matrix (mathematics)", 1, "수나 식을 직사각형 모양으로 배열한 것"],
    ["벡터 공간", "Vector space", 1, "덧셈과 스칼라 곱이 정의된 벡터들의 집합"],
    ["행렬식", "Determinant", 1, "정사각행렬이 역행렬을 가지는지 알려 주는 값"],
    ["역행렬", "Invertible matrix", 1, "곱하면 단위행렬이 되는 짝 행렬"],
    ["가우스 소거법", "Gaussian elimination", 2, "행 연산으로 연립일차방정식을 푸는 방법"],
    ["선형 변환", "Linear map", 2, "덧셈과 스칼라 곱을 보존하는 함수"],
    ["고윳값과 고유벡터", "Eigenvalues and eigenvectors", 2, "변환해도 방향이 그대로인 벡터와 그 배율"],
    ["내적", "Dot product", 2, "두 벡터의 크기와 사잇각으로 정해지는 스칼라"],
    ["특잇값 분해", "Singular value decomposition", 3, "어떤 행렬이든 회전·늘림·회전으로 나누는 분해"],
    ["그람-슈미트 과정", "Gram–Schmidt process", 3, "벡터들을 서로 수직인 기저로 바꾸는 방법"],
  ],
  "ma-calc": [
    ["극한", "Limit (mathematics)", 1, "값이 어떤 수에 한없이 가까워지는 성질"],
    ["도함수", "Derivative", 1, "한 점에서 함수가 변하는 순간 변화율"],
    ["적분", "Integral", 1, "곡선 아래 넓이나 누적량을 구하는 계산"],
    ["미적분학의 기본 정리", "Fundamental theorem of calculus", 1, "미분과 적분이 서로 역연산이라는 정리"],
    ["연쇄 법칙", "Chain rule", 2, "합성함수를 미분하는 규칙"],
    ["테일러 급수", "Taylor series", 2, "함수를 한 점에서의 도함수로 이루어진 다항식 합으로 나타냄"],
    ["편미분", "Partial derivative", 2, "다변수 함수에서 한 변수만 바꾸며 미분"],
    ["중적분", "Multiple integral", 2, "여러 변수에 대해 넓이·부피를 적분"],
    ["그레이디언트", "Gradient", 3, "가장 빠르게 증가하는 방향을 가리키는 벡터"],
    ["발산 정리", "Divergence theorem", 3, "닫힌 곡면을 지나는 흐름과 내부 발산의 관계"],
  ],
  "ma-prob": [
    ["확률", "Probability", 1, "어떤 사건이 일어날 가능성을 0~1로 나타낸 값"],
    ["조건부 확률", "Conditional probability", 1, "어떤 사건이 일어났다는 조건에서의 확률"],
    ["기댓값", "Expected value", 1, "확률로 가중한 평균값"],
    ["분산", "Variance", 1, "값이 평균에서 얼마나 퍼져 있는지 나타내는 척도"],
    ["베이즈 정리", "Bayes' theorem", 2, "새로운 증거로 확률을 갱신하는 공식"],
    ["정규 분포", "Normal distribution", 2, "평균을 중심으로 좌우 대칭인 종 모양 분포"],
    ["이항 분포", "Binomial distribution", 2, "성공·실패 시행을 n번 했을 때 성공 횟수의 분포"],
    ["중심 극한 정리", "Central limit theorem", 2, "표본 평균의 분포가 정규 분포에 가까워지는 정리"],
    ["가설 검정", "Statistical hypothesis test", 3, "데이터로 가설을 받아들일지 판단하는 절차"],
    ["최대 가능도 방법", "Maximum likelihood estimation", 3, "관측 데이터가 나올 확률을 최대로 하는 모수 추정"],
  ],
  "ma-eng": [
    ["상미분 방정식", "Ordinary differential equation", 1, "한 변수의 함수와 그 도함수 사이의 방정식"],
    ["복소수", "Complex number", 1, "실수부와 허수부로 이루어진 수"],
    ["오일러 공식", "Euler's formula", 1, "지수 함수와 삼각 함수를 잇는 공식"],
    ["선형 미분 방정식", "Linear differential equation", 2, "미지 함수와 도함수가 일차로만 나오는 미분 방정식"],
    ["라플라스 변환", "Laplace transform", 2, "미분 방정식을 대수 방정식으로 바꾸는 적분 변환"],
    ["푸리에 급수", "Fourier series", 2, "주기 함수를 사인·코사인의 합으로 나타냄"],
    ["푸리에 변환", "Fourier transform", 2, "신호를 주파수 성분으로 분해하는 변환"],
    ["편미분 방정식", "Partial differential equation", 3, "여러 변수의 편도함수가 들어간 방정식"],
    ["뉴턴 방법", "Newton's method", 3, "접선을 이용해 방정식의 근을 반복 근사"],
    ["수치 적분", "Numerical integration", 3, "사다리꼴·심프슨 공식 등으로 적분값을 근사"],
  ],
};
