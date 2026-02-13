import Link from 'next/link'

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* 로고 영역 */}
        <div className="flex items-center space-x-2">
          <Link href="/" className="text-xl font-bold text-gray-900">
            에이비딩
          </Link>
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="flex items-center space-x-6 flex-1 justify-center">
          <Link 
            href="/" 
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Home
          </Link>
          <Link 
            href="/page1" 
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Page1
          </Link>
          <Link 
            href="/page2" 
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Page2
          </Link>
          <Link
            href="/page3"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Page3
          </Link>
          <Link
            href="/chat"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Chat
          </Link>
        </nav>
        
        {/* 오른쪽 빈 공간 (균형을 위해) */}
        <div className="w-0"></div>
      </div>
    </header>
  )
}