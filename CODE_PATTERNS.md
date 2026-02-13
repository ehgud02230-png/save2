# 🎯 코드 패턴 가이드

## 📋 개요

**기획자와 AI가 협업하여 목업을 개발할 때** 사용할 **단순하고 직관적인** 코드 패턴 가이드입니다.  
**복잡한 아키텍처는 제거하고, UI/UX 재사용성에 집중**합니다.

---

## 📚 사용 기술스택

**Core:** Next.js 14, TypeScript, Tailwind CSS  
**UI:** Radix UI 기반 커스텀 컴포넌트, Lucide React  
**Font:** Pretendard  
**State:** useState (로컬), Zustand (전역)  
**Form:** React Hook Form + Zod

---

## 🎯 핵심 철학

### **1. 즉시 이해 가능한 코드**
- 기획자가 봐도 직관적
- 하드코딩 데이터로 즉시 확인
- 복잡한 패턴 배제

### **2. AI 친화적 패턴** 
- 기획자의 자연어 요청에 AI가 쉽게 적용 가능
- 일관된 구조로 학습 효과 극대화

---

## 📁 폴더 구조

```
src/
├── app/                    # Next.js App Router 페이지들
├── components/
│   ├── ui/                # Radix UI 기반 커스텀 컴포넌트
│   └── layout/            # 레이아웃 컴포넌트
├── lib/                   # 유틸리티 (utils.ts)
├── store/                 # 전역 상태 (Zustand 사용시)
├── types/                 # TypeScript 타입 정의
└── hooks/                 # 커스텀 훅
```

---

## 🎨 컴포넌트 작성 패턴

### **기본 컴포넌트 구조**
```tsx
interface UserCardProps {
  user: {
    id: number
    name: string
    email: string
    role: string
  }
  onEdit?: (id: number) => void
}

export function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-2">
        <h3 className="font-semibold">{user.name}</h3>
        <p className="text-sm text-gray-600">{user.email}</p>
        <p className="text-xs text-gray-500">{user.role}</p>
      </div>
      {onEdit && (
        <Button onClick={() => onEdit(user.id)} size="sm">
          편집
        </Button>
      )}
    </Card>
  )
}
```

---

## 📝 폼 패턴

### **React Hook Form + Zod**
```tsx
const schema = z.object({
  name: z.string().min(2, '2자 이상 입력하세요')
})

export function UserForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>이름</Label>
        <Input {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <Button type="submit">저장</Button>
    </form>
  )
}
```

---

## 🎨 스타일링 패턴

### **Tailwind CSS 순서**
```tsx
// 레이아웃 → 크기 → 간격 → 색상 → 상호작용
<div className="flex items-center w-full px-4 py-2 bg-white rounded-lg hover:bg-gray-50">
```

### **조건부 스타일링**
```tsx
import { cn } from "@/lib/utils"

// 버튼 variant 예시
<Button className={cn(
  "px-4 py-2 rounded-md font-medium",
  variant === "primary" && "bg-blue-500 text-white",
  variant === "secondary" && "bg-gray-200 text-gray-900",
  isDisabled && "opacity-50 cursor-not-allowed"
)} />
```

---

## 🎨 스타일링 패턴

### **Tailwind CSS 순서**
```tsx
// 레이아웃 → 크기 → 간격 → 색상 → 상호작용
<div className="flex items-center w-full px-4 py-2 bg-white rounded-lg hover:bg-gray-50">
```

### **조건부 스타일링**
```tsx
import { cn } from "@/lib/utils"

// 버튼 variant 예시
<Button className={cn(
  "px-4 py-2 rounded-md font-medium",
  variant === "primary" && "bg-blue-500 text-white",
  variant === "secondary" && "bg-gray-200 text-gray-900",
  isDisabled && "opacity-50 cursor-not-allowed"
)} />
```

---

## 🎨 아이콘 패턴 (Lucide React)

### **기본 아이콘 사용**
```tsx
import { User, Mail, Settings, ChevronRight, Search } from "lucide-react"

// 기본 크기 (24px)
<User />

// 커스텀 크기
<User className="w-4 h-4" />  // 16px
<User className="w-5 h-5" />  // 20px
<User className="w-6 h-6" />  // 24px
```

### **버튼과 아이콘 조합**
```tsx
// 아이콘 + 텍스트
<Button>
  <User className="w-4 h-4 mr-2" />
  사용자 관리
</Button>

// 아이콘만
<Button size="icon">
  <Settings className="w-4 h-4" />
</Button>
```

### **리스트 아이템에서 아이콘**
```tsx
<div className="flex items-center space-x-3">
  <Mail className="w-5 h-5 text-gray-500" />
  <span>이메일 설정</span>
  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
</div>
```

### **색상 적용**
```tsx
// 기본 회색
<User className="w-5 h-5 text-gray-500" />

// 강조 색상
<User className="w-5 h-5 text-blue-500" />

// 현재 텍스트 색상 상속
<User className="w-5 h-5" />
```

---

## 📱 반응형 패턴

### **Grid 레이아웃**
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {items.map(item => <Card key={item.id}>내용</Card>)}
</div>
```

### **Flex 레이아웃**
```tsx
<div className="flex flex-col sm:flex-row gap-4">
  <div className="flex-1">메인</div>
  <div className="w-full sm:w-64">사이드</div>
</div>
```

---

## 🚫 사용하지 않는 패턴

### **❌ 복잡한 데이터 페칭**
- Mock API 호출 없음
- useQuery, SWR 등 미사용
- 로딩/에러 상태 처리 최소화

### **❌ 복잡한 상태관리**  
- Redux 같은 과도한 상태관리 라이브러리 미사용
- Context API 미사용 (보일러플레이트가 많음)
- useState로 충분한 로컬 상태만
- 전역 상태가 필요하면 무조건 Zustand 사용

### **❌ 과도한 컴포넌트 분리**
- 너무 세분화된 컴포넌트 구조 지양
- 적당한 수준의 재사용성 추구

---

## ✅ 권장 패턴

### **✅ 하드코딩 데이터**
```tsx
const users = [
  { id: 1, name: "김철수", email: "kim@example.com" },
  { id: 2, name: "이영희", email: "lee@example.com" }
]
```

### **✅ 단순한 상태관리**
```tsx
const [searchTerm, setSearchTerm] = useState('')
const [selectedItem, setSelectedItem] = useState(null)
```

### **✅ Zustand 전역 상태** (전역 상태 필요시)
```tsx
// store/userStore.ts
import { create } from 'zustand'

interface UserStore {
  users: User[]
  selectedUser: User | null
  setUsers: (users: User[]) => void
  setSelectedUser: (user: User | null) => void
}

export const useUserStore = create<UserStore>((set) => ({
  users: [],
  selectedUser: null,
  setUsers: (users) => set({ users }),
  setSelectedUser: (user) => set({ selectedUser: user })
}))

// 컴포넌트에서 사용
const { users, setUsers } = useUserStore()
```

### **✅ 적절한 컴포넌트 분리**
```tsx
<UserList users={users} onEdit={handleEdit} />
<UserForm onSubmit={handleSubmit} />
```