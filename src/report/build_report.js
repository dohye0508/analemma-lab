const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType,
  ImageRun
} = require("docx");

const FONT = "맑은 고딕";
const PAGE_W = 11906;
const PAGE_H = 16838;

function h1(text) {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, font: FONT })],
  });
}
// "1./2." + short subtitle, bold 13pt
function topsub(text) {
  return new Paragraph({
    spacing: { before: 140, after: 40 },
    indent: { left: 227 },
    children: [new TextRun({ text, bold: true, size: 26, font: FONT })],
  });
}
// body paragraph under a topsub, 12pt regular
function topbody(text) {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: 454 },
    children: [new TextRun({ text, size: 24, font: FONT })],
  });
}
// "가./나." + short label, 12pt regular
function subsub(text) {
  return new Paragraph({
    spacing: { before: 80, after: 20 },
    indent: { left: 454 },
    children: [new TextRun({ text, size: 24, font: FONT })],
  });
}
// "1)/2)" body text under 가./나., 11pt
function subbody(text) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 680 },
    children: [new TextRun({ text, size: 22, font: FONT })],
  });
}
function topsubRed(text) {
  return new Paragraph({
    spacing: { before: 140, after: 40 },
    indent: { left: 227 },
    children: [new TextRun({ text, bold: true, size: 26, font: FONT, color: "C00000" })],
  });
}
function topbodyRed(text) {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: 454 },
    children: [new TextRun({ text, size: 24, font: FONT, color: "C00000" })],
  });
}
function topbodyMixed(parts) {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: 454 },
    children: parts.map(
      (p) => new TextRun({ text: p.text, size: 24, font: FONT, color: p.color || "000000" })
    ),
  });
}
function mathItem(label, body) {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: 454 },
    children: [
      new TextRun({ text: label + " ", bold: true, size: 24, font: FONT, color: "C00000" }),
      new TextRun({ text: body, size: 24, font: FONT, color: "C00000" }),
    ],
  });
}
function topsubGreen(text) {
  return new Paragraph({
    spacing: { before: 140, after: 40 },
    indent: { left: 227 },
    children: [new TextRun({ text, bold: true, size: 26, font: FONT, color: "1E7A34" })],
  });
}
function topbodyGreen(text) {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: 454 },
    children: [new TextRun({ text, size: 24, font: FONT, color: "1E7A34" })],
  });
}
function subsubGreen(text) {
  return new Paragraph({
    spacing: { before: 80, after: 20 },
    indent: { left: 454 },
    children: [new TextRun({ text, size: 24, font: FONT, color: "1E7A34" })],
  });
}
function subbodyGreen(text) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 680 },
    children: [new TextRun({ text, size: 22, font: FONT, color: "1E7A34" })],
  });
}
function mathItemGreen(label, body) {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: 454 },
    children: [
      new TextRun({ text: label + " ", bold: true, size: 24, font: FONT, color: "1E7A34" }),
      new TextRun({ text: body, size: 24, font: FONT, color: "1E7A34" }),
    ],
  });
}
function photo(text) {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: 680 },
    children: [
      new TextRun({ text, size: 22, font: FONT, italics: true, color: "666666" }),
    ],
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 1200, type: WidthType.DXA },
    shading: opts.header
      ? { type: ShadingType.CLEAR, fill: "D9E2F3" }
      : undefined,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text, font: FONT, size: 20, bold: !!opts.header }),
        ],
      }),
    ],
  });
}

const planetRows = [
  ["행성", "태양일(시간)", "공전주기(일)", "관측 간격(태양일 배수)", "관측 간격(시간)", "관측 횟수"],
  ["수성", "4224", "176", "0.02", "84.48", "50"],
  ["금성", "2802", "225", "0.04", "112.08", "49"],
  ["지구", "24", "365", "5", "120", "73"],
  ["화성", "24.66", "687", "10", "246.6", "67"],
  ["목성", "9.93", "4333", "50", "496.5", "210"],
  ["토성", "10.55", "10759", "200", "2110", "123"],
  ["천왕성", "17.24", "30687", "400", "6896", "107"],
  ["해왕성", "16.11", "60190", "800", "12888", "113"],
];
const colWidths = [1300, 1400, 1400, 1900, 1500, 1200];
const table = new Table({
  columnWidths: colWidths,
  width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  rows: planetRows.map(
    (r, ri) =>
      new TableRow({
        children: r.map((t, ci) => cell(t, { header: ri === 0, width: colWidths[ci] })),
      })
  ),
});

const path = require("path");
const imgBuf = fs.readFileSync(
  path.join(__dirname, "..", "..", "data", "single_latitude", "analemma_comparison.png")
);
const imgBufLat = fs.readFileSync(
  path.join(__dirname, "..", "..", "data", "by_latitude", "analemma_comparison_bylat.png")
);

const doc = new Document({
  sections: [
    {
      properties: { page: { size: { width: PAGE_W, height: PAGE_H } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: "2026학년도 2학기 지구과학 실험 수행평가_천문 모의실험 개발 양식",
              size: 18, font: FONT, color: "888888",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [
            new TextRun({
              text: "스텔라리움으로 살펴본 태양계 여덟 행성의 아날렘마",
              size: 32, bold: true, font: FONT,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 300 },
          children: [new TextRun({ text: "학번 :          이름 :", size: 22, font: FONT })],
        }),

        h1("Ⅰ. 실험 목표"),
        topsub("1. 실험 동기"),
        topbody(
          "지구에서는 매일 같은 시각에 태양의 위치를 표시하면 8자 모양의 아날렘마가 그려진다. 이 현상이 지구의 자전축 기울기와 공전 궤도의 이심률 때문에 나타난다는 것을 학습한 뒤, 자전축과 궤도 조건이 지구와 다른 행성에서는 아날렘마가 어떤 형태로 나타나는지 확인하고자 하였다."
        ),
        topsub("2. 실험 목적"),
        topbody(
          "스텔라리움을 이용해 수성부터 해왕성까지 8개 행성 각각에서 태양의 궤적을 구현하고, 8개 행성의 아날렘마 형태를 비교하여 자전축 기울기와 이심률이 아날렘마 형태에 미치는 영향을 분석한다."
        ),

        h1("Ⅱ. 관련 이론"),
        topsub("1. 아날렘마의 형성 원리"),
        topbody(
          "자전축이 기울어져 있어 계절에 따라 태양의 남중 고도가 달라지는 것과, 공전 궤도가 타원이라 태양과의 거리에 따라 공전 속도가 달라지면서 태양의 남중 시각이 매일 조금씩 어긋나는 것(균시차), 이 두 요인이 함께 작용하여 8자 모양의 궤적을 만든다."
        ),
        topsub("2. 지평좌표계: 방위각과 고도"),
        topbody(
          "스텔라리움에서 태양의 위치는 관측자를 기준으로 한 지평좌표계, 즉 방위각(정북을 0˚로 시계 방향으로 잰 각)과 고도(지평선을 기준으로 잰 각)로 나타난다. 아날렘마 그래프는 방위각을 가로축, 고도를 세로축으로 사용한다."
        ),
        topsub("3. 스텔라리움의 위치·시간 계산 원리"),
        topbodyMixed([
          {
            text: "관측자의 위도·경도와 소속 행성을 지정하면 그 지점에서 보이는 하늘을 계산하고, 날짜와 시각을 변경하면 그 순간의 천체 위치를 다시 계산한다. 이 두 기능을 이용하면 실제로 해당 행성에서 장기간 관측하지 않고도 아날렘마를 재현할 수 있다.",
          },
          {
            text: " 이때 스텔라리움은 단순화된 케플러 궤도가 아니라 각 행성의 궤도 요소를 반영한 정밀한 천체력(ephemeris)으로 태양의 위치를 계산하며, 본 실험에서는 이 계산 결과를 기록·시각화하였을 뿐 아래 4번의 수식으로 직접 재계산하지는 않았다.",
            color: "C00000",
          },
        ]),
        topsubRed("4. 아날렘마 형태를 결정하는 핵심 요인의 수식적 해석"),
        topbodyRed(
          "아래 수식은 스텔라리움의 실제 계산 과정이 아니라, Ⅳ장의 결과가 왜 그렇게 나타났는지를 설명하기 위해 단순화한 이론 모형이다."
        ),
        mathItem(
          "(1) 세로 폭(고도 변화):",
          "태양의 적위 δ는 자전축 기울기 ε와 궤도상 위치(황경) λ에 대해 sin(δ) = sin(ε)·sin(λ)로 나타난다. δ의 변화 폭이 곧 ε의 크기로 결정되므로, 자전축 기울기가 큰 행성일수록 아날렘마의 세로 폭이 커진다."
        ),
        mathItem(
          "(2) 가로 폭(균시차):",
          "태양이 뜨고 지는 시각이 매일 어긋나는 정도(균시차)는 궤도 이심률에 의한 성분과 자전축 기울기에 의한 성분이 합쳐져 나타난다. 즉 가로 폭·비대칭은 이심률만으로는 설명되지 않으며, 자전 속도(태양일 길이)의 영향도 함께 고려해야 한다."
        ),
        mathItemGreen(
          "(3) 관측 위도에 따른 투영:",
          "적위 δ와 시간각 H가 같아도, 이를 실제 하늘의 고도로 바꾸는 식 sin(alt) = sin(φ)sin(δ) + cos(φ)cos(δ)cos(H)에는 관측자 위도 φ가 직접 들어간다. 따라서 같은 행성·같은 날짜라도 위도가 다르면 아날렘마가 하늘에 투영되는 형태(세로 폭의 압축 정도, 기울어진 방향)가 달라진다."
        ),

        h1("Ⅲ. 실험 방법"),
        topsub("1. 스텔라리움 조작을 통한 현상 확인"),
        subsub("가. 관측 행성 및 위치 설정"),
        subbody("1) 위치 설정 창(F6)에서 관측 행성을 지구에서 화성 등으로 변경하고 위도·경도를 입력하였다."),
        photo("[사진 1: 위치 설정 창에서 관측 행성을 화성으로 변경하는 화면]"),
        subsub("나. 시간 변화에 따른 태양 이동 관찰"),
        subbody("1) 시간 조작 기능으로 날짜를 빠르게 진행시키며 태양이 하늘에서 이동하는 모습을 관찰하고, 지구에서 관측할 때와의 차이를 확인하였다."),
        photo("[사진 2: 시간을 빠르게 진행시켰을 때 태양이 이동하는 모습]"),

        topsub("2. 스크립트를 이용한 데이터 수집"),
        subsub("가. 관측 간격 설정"),
        subbody("1) 아날렘마는 매일 같은 시각에 관측해야 그려지므로, 그 기준을 각 행성의 태양일(태양이 남중한 뒤 다시 남중할 때까지 걸리는 시간)로 설정하였다. 8개 행성의 태양일과 공전 주기를 조사하여 관측 간격과 관측 횟수를 계산하였다(표 1)."),
        subsub("나. 자동 수집 스크립트 작성 및 실행"),
        subbody("1) 스크립트 콘솔(F1)에 자바스크립트 코드를 작성하여, 행성별로 기준 시각부터 태양일의 배수만큼 시간을 전진시키며 태양의 방위각·고도를 기록하도록 하였다."),
        photo("[사진 3: 스크립트 콘솔에 코드를 입력하고 실행하는 화면]"),
        subbody("2) 관측 위치를 변경한 직후 값을 곧바로 읽으면 이전 위치의 값이 기록되는 오류가 발생하여, 위치 변경 후 대기 시간을 추가하여 오류를 수정하였다."),
        photo("[사진 4: 8개 행성별로 저장된 결과 파일 목록]"),
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 680 },
          children: [
            new TextRun({
              text: "3) 이렇게 기록한 방위각·고도 값은 스텔라리움이 각 행성의 궤도 요소를 반영해 내부적으로 계산한 결과를 그대로 읽어온 것이며, 실험 과정에서 별도의 수식 계산을 수행하지는 않았다. Ⅱ장 4번의 수식은 이 결과가 왜 그런 모양으로 나타났는지를 사후에 설명하기 위한 이론적 모형이다.",
              size: 22,
              font: FONT,
              color: "C00000",
            }),
          ],
        }),
        table,
        new Paragraph({
          spacing: { before: 100, after: 100 },
          indent: { left: 454 },
          children: [new TextRun({ text: "표 1. 행성별 태양일·공전 주기와 관측 간격", size: 20, font: FONT })],
        }),

        topsub("3. 데이터 정리 및 그래프 작성"),
        subsub("가. 자료 정리"),
        subbody("1) 저장된 파일을 파이썬으로 불러와 행성별 표(csv)로 정리하고, 방위각이 0˚/360˚를 지날 때 그래프가 끊기지 않도록 각도를 이어 붙였다."),
        subsub("나. 비교 그래프 작성"),
        subbody("1) 8개 행성의 궤적을 하나의 그래프에 배치하여 비교하였다(그림 1)."),

        topsubGreen("4. 위도별 비교 실험"),
        subsubGreen("가. 관측 위도 설정"),
        subbodyGreen(
          "1) 자전축 기울기의 효과가 관측자 위도에 따라 어떻게 달라지는지 확인하기 위해, 위도를 0˚(적도)·30˚N·60˚N·89.9˚N(극 부근) 네 곳으로 바꿔가며 8개 행성 모두에 대해 동일한 방법으로 방위각·고도를 기록하였다. (정확히 90˚에서는 방위각이 정의되지 않아 89.9˚N으로 대체하였다.)"
        ),
        subsubGreen("나. 자료 정리"),
        subbodyGreen(
          "1) 행성별 파일 하나에 네 위도의 데이터를 구분하여 저장한 뒤, 파이썬으로 위도 열을 추가하여 하나의 표로 정리하고 위도별로 겹쳐 그렸다(그림 2)."
        ),

        h1("Ⅳ. 결과 및 해석"),
        topsub("1. 지구의 아날렘마"),
        topbody(
          "뚜렷한 8자 모양이 나타났다. 자전축 기울기(23.4˚)와 이심률(0.017)이 모두 상당한 크기이기 때문에 세로 방향(계절) 변화와 가로 방향(균시차) 변화가 함께 나타난 결과로 판단된다."
        ),
        topsub("2. 수성·금성의 아날렘마"),
        topbodyMixed([
          {
            text: "8자 모양이 아니라 좌우로 넓게 퍼진 U자 형태로 나타났다. 두 행성 모두 자전축 기울기가 0˚에 가까워 세로 방향 변화가 거의 없다. ",
          },
          {
            text: "다만 가로 방향 변화의 원인은 두 행성이 서로 다르다. 수성은 이심률(0.206)이 매우 커서 균시차의 이심률 성분이 크게 나타난 결과로 해석되지만, 금성은 이심률이 0.0068로 거의 원 궤도에 가까워 균시차만으로는 넓은 U자 형태를 설명하기 어렵다. 금성은 자전 주기(약 243일, 역행)가 공전 주기(225일)보다 길어 태양일이 매우 길어지고, 이로 인해 관측 간격이 성기게 나뉘면서 넓게 퍼진 궤적으로 나타난 것으로 판단된다.",
            color: "C00000",
          },
        ]),
        topsub("3. 화성~해왕성의 아날렘마"),
        topbody(
          "궤적의 한쪽이 벌어진 형태로 나타났다. 이는 오차가 아니라 각 행성의 공전 주기가 실험에서 설정한 관측 간격의 정확한 정수배가 아니기 때문에 나타나는 현상이며, 지구의 1년이 정확히 365일이 아니어서 윤년을 두는 것과 같은 원리이다."
        ),
        topsub("4. 자전축 기울기와 아날렘마 형태의 관계"),
        topbodyMixed([
          {
            text: "자전축 기울기가 큰 행성(화성, 토성, 해왕성 등)일수록 아날렘마의 세로 폭이 크게 나타났고, 자전축 기울기가 거의 없는 수성·금성은 세로 폭이 매우 좁게 나타났다. ",
          },
          {
            text: "세로 폭은 자전축 기울기에 의해 결정되는 반면, 가로 폭과 비대칭은 이심률과 자전 속도(태양일 길이)가 함께 작용한 균시차에 의해 결정된다는 것을 확인하였다(Ⅱ장 4번 참조).",
            color: "C00000",
          },
        ]),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          children: [
            new ImageRun({ type: "png", data: imgBuf, transformation: { width: 560, height: 280 } }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "그림 1. 8행성의 태양 방위각-고도 아날렘마 비교", size: 20, font: FONT })],
        }),

        topsubGreen("5. 위도에 따른 아날렘마 형태 변화"),
        topbodyGreen(
          "같은 행성이라도 관측 위도에 따라 아날렘마의 모양이 크게 달라졌다. 적도(0˚)에서는 태양이 거의 정점 부근을 지나가므로 궤적이 고도가 높은 쪽에 몰려 위아래로 눌린 형태로 나타났고, 위도가 30˚N, 60˚N으로 높아질수록 궤적이 아래로 내려오면서 8자 또는 U자 모양이 뚜렷하게 드러났다. 극 부근(89.9˚N)에서는 자전축 기울기가 있는 지구·화성·천왕성·해왕성 등이 폭이 좁고 눌린 루프 형태로 변형되었고, 자전축 기울기가 거의 없는 수성·목성 등은 고도 변화가 거의 사라져 일직선에 가까운 모습을 보였다. 이는 Ⅱ장 4번 (3)에서 다룬 것처럼 관측자 위도 φ가 δ, H와 함께 고도를 결정하기 때문으로, 같은 적위 변화라도 위도에 따라 하늘에 투영되는 형태가 달라짐을 확인하였다."
        ),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          children: [
            new ImageRun({ type: "png", data: imgBufLat, transformation: { width: 580, height: 290 } }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "그림 2. 위도(0˚/30˚N/60˚N/89.9˚N)에 따른 행성별 아날렘마 비교",
              size: 20,
              font: FONT,
              color: "1E7A34",
            }),
          ],
        }),

        h1("Ⅴ. 제언 및 발전 방향"),
        topsub("1. 궤적 미완결 문제의 개선 방안"),
        topbody(
          "화성 이후 행성에서 궤적이 닫히지 않는 현상은, 관측 간격을 공전 주기의 정확한 약수에 더 가깝게 재조정하거나 여러 해에 걸친 데이터를 위상에 맞추어 겹쳐 그리는 방법으로 보완할 수 있다."
        ),
        topsubGreen("2. 위도 실험 결과의 정량화"),
        topbodyGreen(
          "이번 실험에서는 위도(0˚/30˚N/60˚N/89.9˚N)에 따른 아날렘마 형태 변화를 정성적으로 확인하였다(Ⅳ장 5번). 향후에는 각 위도에서의 고도 변화 폭(최댓값-최솟값)과 방위각 변화 폭을 수치로 측정하여, 위도·자전축 기울기·이심률 세 변수가 아날렘마 형태에 미치는 영향을 정량적으로 비교하면 더 설득력 있는 결론을 얻을 수 있을 것이다."
        ),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(
    path.join(__dirname, "천문_모의실험_보고서.docx"),
    buf
  );
  console.log("written");
});
