# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고할 가이드를 제공합니다.

## 프로젝트 개요

**기획자와 AI의 협업을 통한 목업 개발**을 위해 설계된 Next.js 14 프로젝트입니다. 하드코딩된 데이터와 최소한의 복잡성으로 빠른 프로토타이핑을 위한 단순하고 직관적인 패턴에 중점을 둡니다.

## 개발 명령어

```bash
# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 시작
npm start

# 린팅 실행
npm run lint
```

개발 서버는 http://localhost:3000 에서 실행됩니다.

## 아키텍처 및 핵심 패턴

### 기술 스택
- **Core**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI 컴포넌트**: Radix UI 기반 커스텀 컴포넌트 (shadcn/ui 아님)
- **폰트**: Pretendard (한국어 타이포그래피)
- **상태관리**: useState (로컬), Zustand (전역 상태 필요시)
- **폼**: React Hook Form + Zod 검증

### 레이아웃 구조
- **헤더 전용 레이아웃**: 사이드바 없이 중앙 정렬된 네비게이션을 가진 간단한 헤더
- **전체 높이 페이지**: `min-h-[calc(100vh-65px)]`를 사용하여 적절한 높이 계산
- **헤더 컴포넌트**: `src/components/layout/header.tsx`에 위치

### 컴포넌트 시스템
- **커스텀 UI 컴포넌트**: `src/components/ui/`에 위치
- **Radix UI 기반**: 접근성을 위한 Radix 프리미티브 사용
- **스타일링**: 조건부 클래스를 위한 `cn()` 유틸리티와 Tailwind CSS
- **임포트 패턴**: `import { Button } from '@/components/ui/button'`

### 데이터 및 상태 패턴
- **하드코딩된 데이터**: 즉각적인 시각적 피드백을 위한 더미 데이터 배열 사용
- **로컬 상태**: 컴포넌트 레벨 상태를 위한 useState
- **전역 상태**: 컴포넌트 간 상태 공유가 필요할 때 Zustand 사용
- **복잡한 API 호출 없음**: 목업을 위한 로딩 상태, 에러 처리 지양

### 폴더 구조
```
src/
├── app/                    # Next.js App Router 페이지들
├── components/
│   ├── ui/                # Radix UI 기반 커스텀 컴포넌트
│   └── layout/            # 레이아웃 컴포넌트 (header)
├── lib/                   # 유틸리티 (cn 함수가 있는 utils.ts)
├── store/                 # Zustand 스토어 (전역 상태 필요시)
├── types/                 # TypeScript 타입 정의
└── hooks/                 # 커스텀 훅
```

## 중요한 가이드라인

### 코딩 패턴
**필독**: 일관된 개발 방식을 위해 `CODE_PATTERNS.md`의 패턴을 따르세요.

### 사용해야 할 것
- ✅ 즉각적인 결과를 위한 하드코딩된 더미 데이터
- ✅ 간단한 로컬 상태를 위한 useState
- ✅ 전역 상태를 위한 Zustand (꼭 필요한 경우만)
- ✅ `src/components/ui/`의 Radix UI 기반 커스텀 컴포넌트
- ✅ 스타일링을 위한 Tailwind CSS
- ✅ 폼을 위한 React Hook Form + Zod

### 사용하지 말아야 할 것
- ❌ 복잡한 API 호출이나 데이터 페칭
- ❌ Context API (대신 Zustand 사용)
- ❌ shadcn/ui (우리는 커스텀 Radix UI 컴포넌트 사용)
- ❌ 과도한 컴포넌트 엔지니어링
- ❌ 특별히 필요하지 않은 로딩/에러 상태

### 폰트 사용
프로젝트는 Pretendard 폰트를 사용합니다. 폰트 파일은 `public/fonts/`에 있으며 `globals.css`에서 `@font-face`로 로드됩니다.

## 개발 참고사항

- 컴포넌트는 하드코딩된 데이터로 즉시 사용 가능해야 합니다
- 복잡한 prop drilling보다는 컴포지션을 선호하세요
- 컴포넌트는 집중되고 과도하게 추상화되지 않게 유지하세요
- 자세한 코딩 가이드라인은 `CODE_PATTERNS.md`를 참조하세요