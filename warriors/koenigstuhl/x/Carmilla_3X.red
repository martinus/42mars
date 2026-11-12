;redcode-94x
;name Carmilla
;author inversed
;strategy One-hit scanning vampire
;assert CORESIZE==55440

; Defensive techniques employed:
; - Anti-trace:  fangs point to the pit indirectly,  making
;   it less vulnerable to { or } bombing.
; - Spl instead of jmp to clear, leaving one process in the
;   djn stream. If the clear is destroyed, there is still a
;   chance of a draw.

step    equ     5958
time    equ     3079
phaze   equ     step*time
dtrace  equ     2*step

safe    equ     16
djs     equ     -1
zclear  equ     (pit-cptr-2)
cptr    equ     (bptr-5)

gap1    equ     3
gap2    equ     9
gap3    equ     8
gap4    equ     149

org     start

bptr    dat       0     ,     safe
cs0     spl     # djs   ,     zclear
clear   mov     @ ref   ,   > cptr
        mov     @ ref   ,   > cptr
ref     djn       clear ,   { cs0

        for       gap1
        dat       0     ,     0
        rof

loop    add.x     inc   ,     ptr
        mov       ptr   ,   @ ptr
        jmz.f     loop  ,   * ptr
        mov       ptr   ,   * ptr
        mov.x     ptr   ,   * ptr
        jmz.f     loop  ,     pit
        spl       cs0   ,   < cptr
inc     djn.f   # step  ,   <-step

        for       gap2
        dat       0     ,     0
        rof

pit     djn     # 0     ,   # 0

        for       gap3
        dat       0     ,     0
        rof

ptr     jmp     @ phaze ,     pit+dtrace-phaze

        for       gap4
        dat       0     ,     0
        rof

atrace  jmp     @ 0     ,    -dtrace 
start   mov       atrace,   > setup
        mov       atrace,   @ setup
setup   jmp       loop+1,   < pit+dtrace

