type CursorPathProps = {
  className: string
}

export function CustomCursorArt() {
  return (
    <svg viewBox="0 0 92 92" className="custom-cursor-svg">
      <g className="cursor-triangle-group">
        <CursorTriangle className="cursor-plane" />
      </g>
      <g className="cursor-glow">
        <Antenna className="cursor-robot-outline" />
        <RobotBody className="cursor-robot-outline" />
        <RobotPins className="cursor-robot-outline" />
        <RobotEyes className="cursor-robot-outline" />
      </g>
    </svg>
  )
}

function CursorTriangle({ className }: CursorPathProps) {
  return <path d="M8 8 L32 14 L14 32 Z" className={className} />
}

function Antenna({ className }: CursorPathProps) {
  return <rect x="32" y="26" width="12" height="12" className={className} />
}

function RobotBody({ className }: CursorPathProps) {
  return <rect x="18" y="50" width="56" height="34" className={className} />
}

function RobotPins({ className }: CursorPathProps) {
  return (
    <>
      <line x1="4" y1="67" x2="18" y2="67" className={className} />
      <line x1="74" y1="67" x2="88" y2="67" className={className} />
    </>
  )
}

function RobotEyes({ className }: CursorPathProps) {
  return (
    <>
      <rect x="32" y="58" width="8" height="16" className={className} />
      <rect x="52" y="58" width="8" height="16" className={className} />
    </>
  )
}
