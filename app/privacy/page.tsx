import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OPERATOR, PRIVACY } from "@/lib/site";

export const metadata: Metadata = { title: "개인정보처리방침" };

/*
 * 개인정보처리방침. 실제로 받는 정보(회원가입, 강사섭외 의뢰)와 동의 문구(components/privacy-consent.tsx)에 맞춘다.
 * 받는 항목·보관 기간·맡기는 회사가 바뀌면 이 화면도 함께 고친다.
 */
export default function PrivacyPage() {
  const o = OPERATOR;
  const p = PRIVACY;

  return (
    <article className="mx-auto w-full max-w-[760px]">
      <h1 className="text-[26px] font-bold tracking-tight text-ink md:text-[30px]">개인정보처리방침</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {o.name}(이하 &lsquo;회사&rsquo;)은 강사잇다 서비스(이하 &lsquo;서비스&rsquo;)를 운영하면서 「개인정보 보호법」에 따라 이용자의 개인정보를
        보호하고, 관련 고충을 신속하게 처리하기 위해 다음과 같이 개인정보처리방침을 둡니다.
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-card bg-white p-5 text-[15px] leading-relaxed text-ink md:p-8">
        <Section n={1} title="처리하는 개인정보 항목과 목적">
          <Table
            head={["구분", "항목", "목적"]}
            rows={[
              ["회원가입 (필수)", "이름, 연락처, 이메일, 비밀번호", "회원 확인, 공고 상세 정보 제공, 서비스 이용 관련 안내 및 문의 응대"],
              ["강사섭외 의뢰 (필수)", "담당자 이름, 연락처, 이메일", "강사 섭외 의뢰 확인 및 진행 상황 연락"],
              ["서비스 이용 중 자동 생성", "접속 IP, 접속 일시, 브라우저 정보, 로그인 유지 정보(쿠키)", "로그인 유지, 부정 이용 방지, 서비스 오류 확인"],
            ]}
          />
          <p className="mt-2 text-sm text-muted">
            비밀번호는 복원할 수 없는 방식(암호화)으로 저장되어 회사도 알 수 없습니다. 강사섭외 의뢰의 기관명·지역·필요한 분야 등은 기관에 관한 정보입니다.
            회사는 광고·홍보 메시지를 보내지 않습니다.
          </p>
        </Section>

        <Section n={2} title="보유 기간">
          <Bullets
            items={[
              "회원 정보: 회원 탈퇴 시까지",
              "강사섭외 의뢰 담당자 정보: 의뢰 처리 완료 후 1년까지",
              "다만 법령에 따라 보관해야 하는 경우에는 그 법령에서 정한 기간 동안 보관합니다.",
            ]}
          />
        </Section>

        <Section n={3} title="파기 절차와 방법">
          <Bullets
            items={[
              "회원이 탈퇴하면 계정과 회원 정보를 즉시 지웁니다.",
              "강사섭외 의뢰는 처리 완료 후 1년이 지나면 운영자가 지웁니다.",
              "전자 파일 형태의 정보는 되살릴 수 없는 방법으로 지웁니다. 종이로 출력한 정보는 분쇄하거나 소각합니다.",
            ]}
          />
        </Section>

        <Section n={4} title="제3자 제공">
          <p>회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 특별한 규정이 있는 경우에는 예외로 합니다.</p>
        </Section>

        <Section n={5} title="처리 위탁">
          <p>회사는 서비스 운영을 위해 다음 업체에 개인정보 처리 업무를 맡기고 있습니다.</p>
          <Table
            head={["맡는 업체", "맡기는 업무"]}
            rows={[
              ["Supabase, Inc.", "회원 계정·로그인 관리, 회원 정보와 의뢰 내용 저장"],
              ["Vercel, Inc.", "웹사이트 운영(호스팅), 접속 기록 처리"],
            ]}
          />
        </Section>

        <Section n={6} title="저장 위치와 국외 이전">
          <p>
            회원 정보와 강사섭외 의뢰 내용은 <b>{p.databaseRegion}</b>에 있는 서버에 저장되고, 웹사이트 서버도 같은 곳에서 처리합니다.
            다만 두 업체는 미국 회사이므로, 업체의 서비스 운영·보안·장애 대응 과정에서 개인정보가 국외에서 처리될 수 있습니다.
          </p>
          <Table
            head={["업체 (소재국)", "저장·처리 위치", "항목", "시기·방법"]}
            rows={[
              [<LinkText key="s" href="https://supabase.com/privacy">Supabase, Inc. (미국)</LinkText>, p.databaseRegion, "회원가입·의뢰 항목 전부", "가입·의뢰 시 네트워크로 전송"],
              [<LinkText key="v" href="https://vercel.com/legal/privacy-policy">Vercel, Inc. (미국)</LinkText>, `${p.databaseRegion}. 접속 기록 일부는 해외 서버`, "서비스 이용 중 전달되는 정보, 접속 기록", "서비스 이용 시 네트워크로 전송"],
            ]}
          />
          <Bullets
            items={[
              "이용 목적과 보유 기간은 위 1·2번과 같습니다. 업체 연락처는 업체 이름을 누르면 나오는 각 회사의 개인정보처리방침에서 확인할 수 있습니다.",
              "국외 처리를 원하지 않으면 회원가입·의뢰를 하지 않거나 회원 탈퇴를 할 수 있습니다. 이 경우 회원 전용 서비스를 이용할 수 없습니다.",
            ]}
          />
        </Section>

        <Section n={7} title="이용자의 권리와 행사 방법">
          <Bullets
            items={[
              "이용자는 언제든지 자신의 개인정보를 열람·정정·삭제하거나 처리를 멈추도록 요구할 수 있습니다.",
              <>
                요구는 아래 개인정보 보호책임자 이메일로 하시면 지체 없이 처리합니다. 회원 탈퇴는 로그인 후 사이트 맨 아래 &lsquo;회원 탈퇴&rsquo;에서 직접 할 수
                있습니다.
              </>,
            ]}
          />
        </Section>

        <Section n={8} title="안전성 확보 조치">
          <Bullets
            items={[
              "비밀번호 암호화 저장, 사이트와 이용자 사이 전송 구간 암호화(HTTPS)",
              "데이터베이스 접근 규칙: 회원은 자기 정보만, 운영자 명단에 있는 관리자만 전체 정보를 볼 수 있습니다.",
              "개인정보를 다루는 사람을 최소한으로 제한합니다.",
            ]}
          />
        </Section>

        <Section n={9} title="쿠키">
          <p>
            로그인 상태를 유지하기 위한 쿠키만 사용하며, 광고·분석용 쿠키는 쓰지 않습니다. 브라우저 설정에서 쿠키를 막을 수 있지만, 그러면 로그인이 필요한
            서비스를 이용할 수 없습니다.
          </p>
        </Section>

        <Section n={10} title="개인정보 보호책임자">
          <Table
            head={["구분", "내용"]}
            rows={[
              ["책임자", p.officer],
              ["연락처", <LinkText key="e" href={`mailto:${p.officerEmail}`}>{p.officerEmail}</LinkText>],
            ]}
          />
        </Section>

        <Section n={11} title="권익침해 구제 방법">
          <p>개인정보 침해에 대한 상담이나 신고가 필요하면 아래 기관에 문의할 수 있습니다.</p>
          <Bullets
            items={[
              "개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)",
              "개인정보침해신고센터: 118 (privacy.kisa.or.kr)",
              "대검찰청: 1301 (www.spo.go.kr)",
              "경찰청: 182 (ecrm.police.go.kr)",
            ]}
          />
        </Section>

        <Section n={12} title="시행일">
          <p>이 개인정보처리방침은 {p.effectiveDate}부터 적용합니다. 내용이 바뀌면 시행 전에 사이트에 알립니다.</p>
        </Section>
      </div>
    </article>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line pb-5 last:border-b-0 last:pb-0">
      <h2 className="mb-2 text-[17px] font-bold tracking-tight text-ink">
        <span className="nums">{n}.</span> {title}
      </h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** 휴대폰에서는 옆으로 밀어서 보는 표 */
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-line bg-bg">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line align-top last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2.5 ${j === 0 ? "font-semibold whitespace-nowrap" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinkText({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className="text-brand underline-offset-2 hover:underline"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
