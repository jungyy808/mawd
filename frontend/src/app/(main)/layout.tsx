import ServiceMenu from "@/components/nav/ServiceMenu";

// 서비스 메뉴(상단) + 본문. Figma 데스크톱 1180px 기준, 본문 여백 26px (모바일 16px).
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ServiceMenu />
      <main className="mx-auto w-full max-w-[1180px] flex-1 p-4 sm:p-[26px]">
        {children}
      </main>
    </>
  );
}
