;redcode-94
;assert 1
;name Carbonite Marcia
;author Stefan Kammann
;strategy Stealth Carbonite stone with single Marcia silk paper body

        org     start

;=== Marcia Constants ===
A0      EQU  3488
A1      EQU  1860
A2      EQU  3740
sDist  EQU  4000

;=== Boot ===
start   spl     sboot,      <1000

        spl     1,          <300
        mov     -1,         0
        spl     1,          <500
        spl     1,          <400

silk    spl     @0,         }A0
        mov.i   }-1,        >-1
        mov.i   bomb1,      >123
silk2   spl     @0,         }A1
        mov.i   }-1,        >-1
        mov.i   bomb1,      >1001
        mov.i   bomb,       }2042
        mov.i   {silk2,     <silk3
silk3   jmp     @0,         >A2
bomb   DAT.F  <2667,  #2667
bomb1   DAT.F  #1,     #1

        DAT.F  #1,     #1
        DAT.F  >-1,    #0
        SPL.A  #0,     #0
        DAT.F  >-1,    >1
        DAT.F  #1,     #1
        DAT.F  #0,     #0
        SPL.B  #0,     #0
        SPL.A  #0,     #0
        DAT.F  #0,     #0

;=== Stealth Carbonite Stone ===
sboot   mov     <src,       <dst
        mov     <src,       <dst
        mov     <src,       <dst
dst     mov     sdat,       *start+sDist+4
        mov     <src,       <dst
src     spl     @dst,       stone+4

sdat   DAT.F  <2667,  #2667
stone   spl     #0,         0
        mov     197,        1-3499*197
        add.ab  {0,         }0
        djn.f   -2,         <-3501

        end
